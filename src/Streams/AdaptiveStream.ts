import { PassThrough, Readable } from "node:stream";
import { TEN_MB } from "../Constants";
import Innertube, { Constants, Types, Utils } from "youtubei.js";
import { getInnertube } from "../utils";
import { Track } from "discord-player";
import { createJsonLikeDebug, getVideoId } from "./common";
import { createLiveStream } from "./LiveStream";
import { cache } from "../Cache/DownloadCache";
import { getWebPoMinter } from "../Token/tokenGenerator";

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

const RELIABLE_CLIENTS: { client: Types.InnerTubeClient, requirePoToken: boolean, requireDecipher: boolean }[] = [
    {
        client: "ANDROID_VR",
        requirePoToken: false,
        requireDecipher: false
    },
    {
        client: "MWEB",
        requirePoToken: true,
        requireDecipher: true
    },
    {
        client: "WEB_EMBEDDED",
        requirePoToken: true,
        requireDecipher: true
    }
] as const;

const RELIABLE_CLIENTS_STR: Types.InnerTubeClient[] = ["ANDROID_VR", "MWEB", "WEB_EMBEDDED"];

export async function createAdaptiveStream(info: Track, debug: (msg: string) => unknown) {
    const tube = await getInnertube();
    debug("[YouTube]: Started adaptive attempting stream extraction for " + createJsonLikeDebug(info));

    const id = getVideoId(info.url);

    if (info.live) {
        debug("[YouTube]: Detected video as live video; streaming live.");
        return await createLiveStream(id);
    }

    const key = cache.buildAdaptiveCacheKey(id);
    const item = cache.get(key);

    if (item && RELIABLE_CLIENTS_STR.includes(item.client)) {
        try {
            debug('[YouTube]: Cache hit for ' + createJsonLikeDebug(info) + ". Streaming URL from cache.")
            const stream = await AdaptiveStreamFmt.createStream(item.url, item.cpn, item.size);
            return stream;
        } catch (error) {
            debug('[YouTube]: Cache failed to stream for ' + createJsonLikeDebug(info) + ". Falling back to default behavior. See the following error(s).")
            debug(error);
        }
    }

    let poToken: string | undefined = undefined;
    let firstRun = true;

    for (const client of RELIABLE_CLIENTS) {
        if (!firstRun) {
            await wait(500)
        } else {
            firstRun = false;
        }

        debug(`[YouTube]: Attempting to stream from ${client.client}.`)

        if (client.requirePoToken && !poToken) {
            const accountInfo = await tube.account.getInfo();
            const dataSyncId = accountInfo?.contents?.contents[0]?.endpoint?.payload?.supportedTokens?.[2]?.datasyncIdToken?.datasyncIdToken ?? tube.session.context.client.visitorData;
            const minter = await getWebPoMinter(tube);

            poToken = await minter.mint(dataSyncId);
        }

        const videoInfo = await tube.getBasicInfo(id, {
            client: client.client,
            po_token: poToken
        });

        let format: ReturnType<typeof videoInfo.chooseFormat> | undefined = undefined;

        try {
            format = videoInfo.chooseFormat({
                format: "any",
                quality: "best",
                type: "audio",
                po_token: poToken
            });
        } catch {
            // no-op
        }

        if (!format || !format.url || !format.content_length) {
            debug(`[YouTube] No matching formats found. Skipping ${client.client}`)
            continue;
        }

        const url = client.requireDecipher ? await format.decipher(tube.session.player) : format.url!;

        debug(`[YouTube]: Found adaptive format on client ${client.client}. { url: ${url} }`);

        try {
            const stream = await AdaptiveStreamFmt.createStream(url, videoInfo.cpn, format.content_length);
            debug(`[YouTube]: Stream extraction successful with client ${client.client}.`);
            return stream;
        } catch {
            debug(`[YouTube]: Stream extraction failed for client ${client.client}.`);
            continue;
        }
    }
}

export class AdaptiveStreamFmt {
    static async createStream(url: string, cpn: string, size: number) {
        const abortController = new AbortController();
        const tube = await getInnertube();

        const chunks = await tube.session.http.fetch_function(`${url}&cpn=${cpn}&range=0-${Math.min(size, TEN_MB)}`, {
            headers: Constants.STREAM_HEADERS,
            signal: abortController.signal
        })

        if (!chunks.ok) throw new Error('Initial stream extraction failed.');

        if (size < TEN_MB) {
            const stream = new Readable({
                destroy: () => {
                    abortController.abort();
                }
            });

            (async () => {
                for await (const chunk of Utils.streamToIterable(chunks.body)) {
                    stream.push(Buffer.from(chunk));
                }
                stream.push(null);
            })()

            return stream;
        } else {
            let start = TEN_MB;
            let end = TEN_MB * 2;
            let isEnded = false;
            let abortController2: AbortController;

            return new Readable({
                async read() {
                    if (!chunks.bodyUsed) {
                        for await (const chunk of Utils.streamToIterable(chunks.body)) {
                            this.push(Buffer.from(chunk));
                        }
                    } else {
                        if (end >= size) {
                            isEnded = true;
                            end = size;
                        }

                        abortController2 = new AbortController();

                        const u = `${url}&cpn=${cpn}&range=${start}-${end}`;

                        const audioChunks = await tube.session.http.fetch_function(u, {
                            headers: Constants.STREAM_HEADERS,
                            signal: abortController2.signal
                        })

                        if (!audioChunks.body || !audioChunks.ok) throw new Error(`Downloading of video failed at ${(start / size) * 100}%`);

                        for await (const chunks of Utils.streamToIterable(audioChunks.body)) {
                            this.push(Buffer.from(chunks));
                        }

                        if (isEnded) this.push(null);

                        start = end + 1;
                        end += TEN_MB;
                    }
                },
                destroy() {
                    abortController2?.abort();
                }
            });
        }
    }
}