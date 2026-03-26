import { Readable } from 'stream';
import { decipherLiveStreamUrl, getInnertube } from '../utils';
import { getWebPoMinter, invalidateWebPoMinter } from '../Token/tokenGenerator';
import { Platform, Types, Constants, Utils } from 'youtubei.js';

Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
    const properties = [];
    if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
    if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    return new Function(code)();
};

const MAX_RETRY_ATTEMPTS = 10;

/**
 * Robust Live Stream handler.
 * Supports: SegmentTemplate (Standard), SegmentList (HLS-like), and BaseURL+Sequence (Legacy/Raw).
 */
class SequenceBasedLiveStream extends Readable {
    private videoId: string;
    private dashUrl: string;
    private innertube: any;
    
    // Stream State
    private manifestUrl: string;
    private baseUrl: string = ''; 
    private segmentTemplate: string = ''; 
    private currentSequence: number = -1;
    private isFetching: boolean = false;
    private retryCount: number = 0;
    private isEnded: boolean = false;

    constructor(
        manifestUrl: string,
        videoId: string,
        dashUrl: string,
        innertube: any
    ) {
        super();
        this.manifestUrl = manifestUrl;
        this.videoId = videoId;
        this.dashUrl = dashUrl;
        this.innertube = innertube;
    }

    async _read(): Promise<void> {
        if (this.isFetching || this.isEnded) return;
        this.isFetching = true;

        try {
            // Initialize parsing on the first read
            if (this.currentSequence === -1) {
                await this.initializeStreamInfo();
            }

            let pushMore = true;
            // Fetch loop: keep getting segments until the internal buffer is full
            while (pushMore && !this.destroyed && !this.isEnded) {
                pushMore = await this.fetchNextSegment();
            }
        } catch (error) {
            if (!this.destroyed) {
                console.error('[LiveStream] Fatal error:', error);
                this.destroy(error instanceof Error ? error : new Error(String(error)));
            }
        } finally {
            this.isFetching = false;
        }
    }

    /**
     * Parses the DASH manifest to find the Live Edge.
     */
    private async initializeStreamInfo(): Promise<void> {
        console.log('[LiveStream] Fetching and parsing manifest...');
        
        const response = await this.innertube.session.http.fetch_function(this.manifestUrl, {
            headers: Constants.STREAM_HEADERS,
        });

        if (!response.ok) throw new Error(`Failed to fetch manifest: ${response.status}`);
        const xml = await response.text();

        // --- 1. Find the BaseURL ---
        // Supports standard <BaseURL> and namespaced <dash:BaseURL>
        const baseUrlMatch = xml.match(/<(\w+:)?BaseURL>([^<]+)<\/(\w+:)?BaseURL>/);
        if (baseUrlMatch) {
            this.baseUrl = baseUrlMatch[2];
            console.log('[LiveStream] Found BaseURL.');
        }

        // --- 2. Find the Start Number ---
        // This is the sequence number of the first segment in the list
        const startNumberMatch = xml.match(/startNumber="(\d+)"/);
        let startSeq = startNumberMatch ? parseInt(startNumberMatch[1]) : 0;

        // --- 3. Check for SegmentTemplate (Preferred) ---
        // Look for media template string (e.g., "sq/$Number$")
        const templateMatch = xml.match(/<(\w+:)?SegmentTemplate[^>]*media="([^"]+)"/);
        if (templateMatch) {
            this.segmentTemplate = templateMatch[2];
        }

        // --- 4. Calculate Live Edge using Timeline or SegmentList ---
        // We need to count how many segments exist to find the END (Live)
        
        // Check for SegmentTimeline
        const timelineMatch = xml.match(/<(\w+:)?SegmentTimeline>([\s\S]*?)<\/(\w+:)?SegmentTimeline>/);
        
        // Check for SegmentList (alternative to timeline)
        const listMatch = xml.match(/<(\w+:)?SegmentList>([\s\S]*?)<\/(\w+:)?SegmentList>/);

        let totalSegments = 0;

        if (timelineMatch) {
            const timelineStr = timelineMatch[2];
            // <S d="..." r="N" /> means 1 segment + N repeats
            const segments = timelineStr.match(/<(\w+:)?S [^>]*>/g) || [];
            for (const seg of segments) {
                const rMatch = seg.match(/r="(\d+)"/);
                const r = rMatch ? parseInt(rMatch[1]) : 0;
                totalSegments += (1 + r);
            }
        } else if (listMatch) {
            // Count <SegmentURL> tags
            const listStr = listMatch[2];
            const segmentUrls = listStr.match(/<(\w+:)?SegmentURL/g) || [];
            totalSegments = segmentUrls.length;
        }

        // --- 5. Set the Start Sequence ---
        if (totalSegments > 0) {
            // Start 3 segments from the end to ensure we have a buffer and don't hit 404s
            this.currentSequence = startSeq + totalSegments - 3;
            console.log(`[LiveStream] Calculated Live Edge: ${this.currentSequence} (Start: ${startSeq}, Segments: ${totalSegments})`);
        } else {
            // Fallback: If no timeline/list found, trust startSeq.
            // Note: For some DVR streams, startSeq is 0 (beginning of time). 
            // If this happens, we might need a different strategy, but usually YouTube updates startNumber.
            this.currentSequence = startSeq;
            console.warn(`[LiveStream] No timeline found. Starting at sequence ${this.currentSequence}`);
        }

        if (!this.baseUrl && !this.segmentTemplate) {
            console.error('[LiveStream] XML Preview:', xml.substring(0, 500));
            throw new Error('Manifest parsing failed: No BaseURL and no SegmentTemplate found.');
        }
    }

    private async fetchNextSegment(): Promise<boolean> {
        let segmentUrl = '';

        if (this.segmentTemplate) {
            // Option A: We have a template (e.g. sq/$Number$)
            segmentUrl = this.segmentTemplate
                .replace(/\$Number\$/g, this.currentSequence.toString())
                .replace(/\$Time\$/g, (Date.now() * 1000).toString());
            
            // Handle relative URLs
            if (!segmentUrl.startsWith('http')) {
                if (this.baseUrl) {
                    segmentUrl = this.baseUrl + segmentUrl;
                } else {
                    const manifestBase = this.manifestUrl.substring(0, this.manifestUrl.lastIndexOf('/') + 1);
                    segmentUrl = manifestBase + segmentUrl;
                }
            }
        } else {
            // Option B: We only have BaseURL. Append 'sq' parameter.
            // This handles the URL you provided.
            const separator = this.baseUrl.includes('?') ? '&' : '?';
            segmentUrl = `${this.baseUrl}${separator}sq=${this.currentSequence}`;
        }

        // AbortController to prevent hanging requests
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

        try {
            const response = await this.innertube.session.http.fetch_function(segmentUrl, {
                headers: Constants.STREAM_HEADERS,
                signal: controller.signal
            });
            clearTimeout(timeout);

            // 403 Forbidden: URL expired -> Regenerate Manifest
            if (response.status === 403) {
                console.log('[LiveStream] 403 Forbidden. Refreshing manifest...');
                await this.handle403Error();
                return true; // Retry immediately
            }

            // 404 Not Found: We are ahead of the server (Live Edge)
            if (response.status === 404) {
                // Wait briefly for the segment to be generated
                await new Promise(r => setTimeout(r, 1500));
                return true; // Retry same sequence
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (!response.body) throw new Error('No body');

            this.retryCount = 0;
            
            // Push audio data
            for await (const chunk of Utils.streamToIterable(response.body)) {
                this.push(Buffer.from(chunk));
            }

            // Increment sequence for next loop
            this.currentSequence++;
            return true;

        } catch (error) {
            clearTimeout(timeout);
            const msg = error instanceof Error ? error.message : String(error);
            
            if (msg.includes('aborted')) {
                console.log('[LiveStream] Fetch timed out, retrying...');
                return true;
            }

            console.error(`[LiveStream] Error fetching seq ${this.currentSequence}:`, msg);
            await new Promise(r => setTimeout(r, 1000));
            return true;
        }
    }

    private async handle403Error(): Promise<void> {
        if (this.retryCount++ > MAX_RETRY_ATTEMPTS) throw new Error('Max retries reached');

        const newManifest = await generateManifestUrl(this.dashUrl, this.videoId, this.innertube);
        if (newManifest) {
            this.manifestUrl = newManifest;
            // Re-parse to get fresh BaseURL signatures, but keep our place in the stream (currentSequence)
            const savedSeq = this.currentSequence;
            this.currentSequence = -1; 
            await this.initializeStreamInfo();
            
            // Restore sequence if we had one
            if (savedSeq > 0) this.currentSequence = savedSeq;
        }
    }
}

/**
 * Entry Point
 */
export async function createLiveStream(videoId: string): Promise<Readable | null> {
    console.log(`[LiveStream] Starting live stream for video: ${videoId}`);

    try {
        const innertube = await getInnertube();
        const videoInfo = await innertube.getBasicInfo(videoId);

        if (videoInfo.playability_status?.status !== 'OK') {
            throw new Error(`Cannot play: ${videoInfo.playability_status?.reason}`);
        }

        const dashUrl = videoInfo.streaming_data?.dash_manifest_url;
        if (!dashUrl) {
            console.error('[LiveStream] No DASH manifest URL found');
            return null;
        }

        // Generate Signed Manifest URL
        const manifestUrl = await generateManifestUrl(dashUrl, videoId, innertube);
        if (!manifestUrl) return null;

        return new SequenceBasedLiveStream(manifestUrl, videoId, dashUrl, innertube);

    } catch (error) {
        console.error('[LiveStream] Fatal error:', error);
        return null;
    }
}

// Helper: Generate Signed URL
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
        if (attempt < MAX_RETRY_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 1000));
            return generateManifestUrl(dashUrl, videoId, innertube, attempt + 1);
        }
        return null;
    }
}