import type Innertube from "youtubei.js/agnostic";
import type { BaseExtractor, Track } from "discord-player";
import type { OAuth2Tokens } from "youtubei.js/agnostic";
import type { DownloadOptions } from "youtubei.js/dist/src/types";
import type { VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import type { Video, CompactVideo, PlaylistVideo } from "youtubei.js/dist/src/parser/nodes";

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

export async function streamFromYT(query: Track, innerTube: Innertube, options: YTStreamingOptions = { overrideDownloadOptions: DEFAULT_DOWNLOAD_OPTIONS }) {
    let id = new URL(query.url).searchParams.get("v")
    // VIDEO DETECTED AS YT SHORTS OR youtu.be link
    if(!id) id = query.url.split("/")[-1].split("?")[0]
    const videoInfo = await innerTube.getBasicInfo(id,"ANDROID")
    const format = videoInfo.chooseFormat(options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS)
    return format.decipher(innerTube.session.player)
}