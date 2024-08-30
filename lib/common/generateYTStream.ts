import type Innertube from "youtubei.js/agnostic";
import { Constants as YoutubeiConsts } from "youtubei.js";
import type { BaseExtractor, Track } from "discord-player";
import type { OAuth2Tokens } from "youtubei.js/agnostic";
import type { DownloadOptions, InnerTubeClient } from "youtubei.js/dist/src/types";
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

    if((["IOS", "ANDROID", "TV_EMBEDDED"] as InnerTubeClient[]).includes(context.useClient)) {
        const downloadURL = videoInfo.chooseFormat(options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS)
        const controller = new AbortController()
        const download = await innerTube.session.http.fetch_function(`${downloadURL.url!}&cpn=${videoInfo.cpn}`, {
            method: "GET",
            headers: YoutubeiConsts.STREAM_HEADERS,
            signal: controller.signal
        })

        return createReadableFromWeb(download.body!, context.highWaterMark)
    }

    const download = await videoInfo.download(options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS)
    
    const stream = createReadableFromWeb(download, context.highWaterMark)

    return stream
}