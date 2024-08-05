import type Innertube from "youtubei.js/agnostic";
import type { BaseExtractor, Track } from "discord-player";
import type { OAuth2Tokens } from "youtubei.js/agnostic";
import type { DownloadOptions } from "youtubei.js/dist/src/types";
import { YoutubeiExtractor } from "../Extractor/Youtube";
import type { ExtractorStreamable } from "discord-player";
import { createReadableFromWeb } from "./webToReadable";

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

export async function streamFromYT(query: Track, innerTube: Innertube, options: YTStreamingOptions = { overrideDownloadOptions: DEFAULT_DOWNLOAD_OPTIONS }): Promise<ExtractorStreamable> {
    const context = YoutubeiExtractor.getStreamingContext()

    let id = new URL(query.url).searchParams.get("v")
    // VIDEO DETECTED AS YT SHORTS OR youtu.be link
    if(!id) id = query.url.split("/").at(-1)?.split("?").at(0)!
    const videoInfo = await innerTube.getBasicInfo(id, context.useClient)

    if(videoInfo.basic_info.is_live) return videoInfo.streaming_data?.hls_manifest_url!

    const download = await videoInfo.download(options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS)
    
    const stream = createReadableFromWeb(download)

    return stream
}