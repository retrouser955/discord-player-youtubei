import type Innertube from "youtubei.js/agnostic";
import type { BaseExtractor } from "discord-player";
import type { OAuth2Tokens } from "youtubei.js/agnostic";
import type { DownloadOptions } from "youtubei.js/dist/src/types";

export interface YTStreamingOptions {
    extractor?: BaseExtractor<object>;
    authentication?: OAuth2Tokens;
    overrideDownloadOptions?: DownloadOptions;
}

const DEFAULT_DOWNLOAD_OPTIONS: DownloadOptions = {
    quality: "best",
    format: "mp4",
    type: "audio"
}

export async function streamFromYT(query: string, innerTube: Innertube, options: YTStreamingOptions = { overrideDownloadOptions: DEFAULT_DOWNLOAD_OPTIONS }) {
    const ytId = query.includes("shorts") ? query.split("/").at(-1)!.split("?")[0]! : new URL(query).searchParams.get("v")!

    const streamData = await innerTube.getStreamingData(ytId, options.overrideDownloadOptions)

    const decipheredStream = streamData.decipher(innerTube.session.player)

    if (!decipheredStream) throw new Error("Unable to get stream data from video.")

    return decipheredStream
}