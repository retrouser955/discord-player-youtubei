import type { YoutubeExtractor } from "../Classes/Youtube";
import { YoutubeTrack } from "../Classes/YoutubeTrack";
import { YOUTUBE_LOGO, YOUTUBE_REGEX } from "../Constants";
import { buildVideoUrl, getInnertube } from "../utils";
import { QueryType, Util } from "discord-player";

export function extractVideoId(vid: string) {
    if (!YOUTUBE_REGEX.test(vid)) throw new Error("Invalid youtube url");
    
    let id = new URL(vid).searchParams.get("v");
    // VIDEO DETECTED AS YT SHORTS OR youtu.be link
    if (!id) id = vid.split("/").at(-1)?.split("?").at(0)!;
    
    return id;
}

export async function getVideo(videoId: string, ext: YoutubeExtractor) {
    const yt = await getInnertube();
    const metadata = await yt.getBasicInfo(videoId)

    const duration = Util.buildTimeCode(
        Util.parseMS((metadata.basic_info.duration ?? 0) * 1000),
    );

    const ytTrack = new YoutubeTrack(ext.context.player, {
        author: metadata.basic_info.author,
        description: metadata.basic_info.short_description,
        title: metadata.basic_info.title,
        duration,
        url: buildVideoUrl(metadata.basic_info.id!),
        source: "youtube",
        queryType: QueryType.YOUTUBE_VIDEO,
        thumbnail: metadata.basic_info.thumbnail?.at(0)?.url || YOUTUBE_LOGO,
        views: metadata.basic_info.view_count
    });

    return ytTrack;
}