/**
 * Now you might be questioning some programming choices used here.
 * But, I originally planned to make this a remote module.
 * Basically, user would download this at runtime and integrate it into the extractor.
 * But, I realized that it would be unsafe because I don't like the idea of remote code execution.
 */
import type { Track } from "discord-player";
import type { DownloadUrlCache } from "../Cache/DownloadCache";
import type { Readable } from "node:stream";
import Innertube, { Constants } from "youtubei.js";
import type { getWebPoMinter, invalidateWebPoMinter } from "../Token/tokenGenerator";
import { AdaptiveStream } from "./AdaptiveStream";
import { createSabrStream } from "./ServerAbrStream";
import { getVideoId } from "./common";
import { createLiveStream } from "./LiveStream";

type VideoStreamerFunction = (videoInfo: Track) => Promise<Readable>;
type InnertubeClient = Parameters<Innertube['getBasicInfo']>[1]['client'];

const wait = (ms: number) => new Promise((res) => setInterval(res, ms));

const RELIABLE_CLIENTS: { client: InnertubeClient, requirePoToken: boolean, requireDecipher: boolean }[] = [
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

const RELIABLE_CLIENTS_STR: InnertubeClient[] = ["ANDROID_VR", "MWEB", "WEB_EMBEDDED"];

async function createAdaptiveStream(
    video: Track,
    tube: Innertube,
    cache: DownloadUrlCache,
    getMinter: typeof getWebPoMinter
) {
    const videoId = getVideoId(video.url);

    const itemKey = cache.buildAdaptiveCacheKey(videoId);
    const item = cache.get(itemKey);

    //--- Handling of Live Streams ---
    const videoInfo = await tube.getBasicInfo(videoId);
    if (videoInfo.basic_info.is_live) {
        const stream = createLiveStream(videoId);
        return stream;
    }
    //--- End of Live Stream Handling ---

    if (item && RELIABLE_CLIENTS_STR.includes(item.client)) {
        return new AdaptiveStream(tube, item.url, item.cpn, item.size);
    }

    let poToken: string | undefined = undefined;
    let firstRun = true;

    for (const client of RELIABLE_CLIENTS) {
        if(!firstRun) {
            await wait(500)
        } else {
            firstRun = false;
        }
        try {
            if (client.requirePoToken && !poToken) {
                const accountInfo = await tube.account.getInfo();
                const dataSyncId = accountInfo?.contents?.contents[0]?.endpoint?.payload?.supportedTokens?.[2]?.datasyncIdToken?.datasyncIdToken ?? tube.session.context.client.visitorData;
                const minter = await getMinter(tube);

                poToken = await minter.mint(dataSyncId);
            }

            const info = await tube.getBasicInfo(getVideoId(video.url), {
                client: client.client,
                po_token: poToken
            })

            const format = info.chooseFormat({
                format: "any",
                quality: "best",
                type: "audio",
                po_token: poToken
            });

            if(!format.url || !format.content_length) continue;
            const url = client.requireDecipher ? await format.decipher(tube.session.player) : format.url!;

            // check if req will go through
            const willGoThrough = await tube.session.http.fetch_function(url, {
                headers: Constants.STREAM_HEADERS,
                method: "HEAD"
            })

            if(!willGoThrough.ok) continue;

            const stream = new AdaptiveStream(tube, url, info.cpn, format.content_length);

            return stream;
        } catch {
            continue;
        }
    }
}

export function createStreamFunction(
    innertube: Innertube,
    cache: DownloadUrlCache,
    getMinter: typeof getWebPoMinter,
    invMinter: typeof invalidateWebPoMinter
): VideoStreamerFunction {
    return async (info) => {
        try {
            const stream = await createAdaptiveStream(info, innertube, cache, getMinter);
            return stream;
        } catch {
            // no-op
        }

        try {
            const stream = createSabrStream(innertube, getMinter, invMinter, info, cache);
            return stream;
        } catch {
            
        }
    }
}