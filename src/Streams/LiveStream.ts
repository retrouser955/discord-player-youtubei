/**
 * Notice: 
 * This should work for live streams pretty nicely
 * I was debating between whether or not I should use ffmpeg but ultimate decided not to
 * Theres still a lot desired from this code, currently its still kinda messy, but should do fine performance-wise
 * 
 * Note to brrrbot:
 * "Please tidy this up"
 * 
 * From: brrrbot
 */

import { Readable } from 'stream';
import { decipherLiveStreamUrl, getInnertube } from '../utils';
import { getWebPoMinter, invalidateWebPoMinter } from '../Token/tokenGenerator';
import { Platform, Types, Constants, Utils } from 'youtubei.js';
import { MAX_LIVESTREAM_RETRY_ATTEMPT } from '../Constants';

Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
    const properties = [];
    if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
    if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    return new Function(code)();
};

class SequenceBasedLiveStream extends Readable {
    constructor(manifestUrl: string, videoId: string, dashUrl: string, innertube: any) {
        let isEnded: boolean = false;
        let isFetching: boolean = false;
        let retryCount: number = 0;
        let currentSequence: number = -1;
        let baseUrl: string = '';
        let segmentTemplate: string = '';
        let segmentUrlPrefix: string = '';
        let segmentUrlSuffix: string = '';
        let useTemplate: boolean = false;
        let abortController: AbortController;

        async function initializeStreamInfo(): Promise<void> {
            const response = await innertube.session.http.fetch_function(manifestUrl, {
                headers: Constants.STREAM_HEADERS,
            });

            if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
            const xml = await response.text();

            const baseUrlMatch = xml.match(/<(\w+:)?BaseURL>([^<]+)<\/(\w+:)?BaseURL>/);
            if (baseUrlMatch) baseUrl = baseUrlMatch[2];

            const startNumberMatch = xml.match(/startNumber="(\d+)"/);
            let startSeq = startNumberMatch ? parseInt(startNumberMatch[1]) : 0;

            const templateMatch = xml.match(/<(\w+:)?SegmentTemplate[^>]*media="([^"]+)"/);
            if (templateMatch) segmentTemplate = templateMatch[2];

            const timelineMatch = xml.match(/<(\w+:)?SegmentTimeline>([\s\S]*?)<\/(\w+:)?SegmentTimeline>/);
            const listMatch = xml.match(/<(\w+:)?SegmentList>([\s\S]*?)<\/(\w+:)?SegmentList>/);

            let totalSegments = 0;

            if (timelineMatch) {
                const segments = timelineMatch[2].match(/<(\w+:)?S [^>]*>/g) || [];
                for (const seg of segments) {
                    const rMatch = seg.match(/r="(\d+)"/);
                    totalSegments += 1 + (rMatch ? parseInt(rMatch[1]) : 0);
                }
            } else if (listMatch) {
                totalSegments = (listMatch[2].match(/<(\w+:)?SegmentURL/g) || []).length;
            }

            currentSequence = totalSegments > 0 ? startSeq + totalSegments - 3 : startSeq;

            if (!baseUrl && !segmentTemplate) {
                throw new Error('Manifest parsing failed: No BaseURL and no SegmentTemplate found.');
            }

            if (segmentTemplate) {
                useTemplate = true;
                let resolvedTemplate = segmentTemplate;
                if (!resolvedTemplate.startsWith('http')) {
                    resolvedTemplate = baseUrl
                        ? baseUrl + resolvedTemplate
                        : manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1) + resolvedTemplate;
                }
                const numberIdx = resolvedTemplate.indexOf('$Number$');
                if (numberIdx !== -1) {
                    segmentUrlPrefix = resolvedTemplate.substring(0, numberIdx);
                    segmentUrlSuffix = resolvedTemplate.substring(numberIdx + '$Number$'.length);
                } else {
                    segmentUrlPrefix = resolvedTemplate;
                    segmentUrlSuffix = '';
                }
            } else {
                useTemplate = false;
                const separator = baseUrl.includes('?') ? '&' : '?';
                segmentUrlPrefix = `${baseUrl}${separator}sq=`;
                segmentUrlSuffix = '';
            }
        }

        async function handle403Error(): Promise<void> {
            if (retryCount++ > MAX_LIVESTREAM_RETRY_ATTEMPT) throw new Error('Max retries reached');

            const newManifest = await generateManifestUrl(dashUrl, videoId, innertube);
            if (newManifest) {
                manifestUrl = newManifest;
                const savedSeq = currentSequence;
                currentSequence = -1;
                await initializeStreamInfo();
                if (savedSeq > 0) currentSequence = savedSeq;
            }
        }

        async function fetchNextSegment(self: Readable): Promise<boolean> {
            const segmentUrl = segmentUrlPrefix + currentSequence + segmentUrlSuffix;

            abortController = new AbortController();
            const timeout = setTimeout(() => abortController.abort(), 8000);

            try {
                const response = await innertube.session.http.fetch_function(segmentUrl, {
                    headers: Constants.STREAM_HEADERS,
                    signal: abortController.signal,
                });
                clearTimeout(timeout);

                if (response.status === 403) {
                    await handle403Error();
                    return true;
                }

                if (response.status === 404) {
                    await new Promise<void>((resolve, reject) => {
                        const t = setTimeout(resolve, 1500);
                        abortController.signal.addEventListener('abort', () => { clearTimeout(t); reject(); });
                    });
                    return true;
                }

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                if (!response.body) throw new Error('No body');

                retryCount = 0;

                for await (const chunk of Utils.streamToIterable(response.body)) {
                    if (self.destroyed) return false;
                    self.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }

                currentSequence++;
                return true;

            } catch (error) {
                clearTimeout(timeout);
                const msg = error instanceof Error ? error.message : String(error);
                if (msg.includes('aborted')) return false;
                await new Promise<void>((resolve, reject) => {
                    const t = setTimeout(resolve, 1000);
                    abortController.signal.addEventListener('abort', () => { clearTimeout(t); reject(); });
                });
                return true;
            }
        }

        super({
            highWaterMark: 512 * 1024,
            async read() {
                if (isFetching || isEnded) return;
                isFetching = true;

                try {
                    if (currentSequence === -1) {
                        await initializeStreamInfo();
                    }

                    let pushMore = true;
                    while (pushMore && !this.destroyed && !isEnded) {
                        pushMore = await fetchNextSegment(this);
                    }
                } catch (error) {
                    if (!this.destroyed) {
                        this.destroy(error instanceof Error ? error : new Error(String(error)));
                    }
                } finally {
                    isFetching = false;
                }
            },
            destroy(error, callback) {
                isEnded = true;
                abortController?.abort(error);
                callback(error);
            }
        });
    }
}

export async function createLiveStream(videoId: string): Promise<Readable | null> {
    try {
        const innertube = await getInnertube();
        const videoInfo = await innertube.getBasicInfo(videoId);

        if (videoInfo.playability_status?.status !== 'OK') {
            throw new Error(`Cannot play: ${videoInfo.playability_status?.reason}`);
        }

        const dashUrl = videoInfo.streaming_data?.dash_manifest_url;
        if (!dashUrl) return null;

        const manifestUrl = await generateManifestUrl(dashUrl, videoId, innertube);
        if (!manifestUrl) return null;

        return new SequenceBasedLiveStream(manifestUrl, videoId, dashUrl, innertube);

    } catch (error) {
        return null;
    }
}

async function generateManifestUrl(
    dashUrl: string,
    videoId: string,
    innertube: any,
    attempt: number = 1
): Promise<string | null> {
    try {
        invalidateWebPoMinter();
        const minter = await getWebPoMinter(innertube);
        const poToken = await minter.mint(videoId);
        const url = await decipherLiveStreamUrl(dashUrl, innertube.session.player, poToken);
        return url.toString();
    } catch (error) {
        if (attempt < MAX_LIVESTREAM_RETRY_ATTEMPT) {
            await new Promise(r => setTimeout(r, 1000));
            return generateManifestUrl(dashUrl, videoId, innertube, attempt + 1);
        }
        return null;
    }
}