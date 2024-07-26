import type { CompactVideo, Video } from "youtubei.js/dist/src/parser/nodes";
import { YoutubeiExtractor } from "../Extractor/Youtube";
import { Track, Util } from "discord-player";
import type { User } from "discord.js";

export async function getHomeFeedVideos(requestedBy?: User) {
    const instance = YoutubeiExtractor.instance

    if(!instance) throw new Error("ERR INVALID INVOKCATION: you have not registered the extractor")

    const tube = instance.innerTube

    const home = await tube.getHomeFeed()

    const videos = home.videos.filter(v => ['CompactVideo', 'Video'].includes(v.type)) as (CompactVideo|Video)[]

    return videos.map((v) => {
        const durationMs = v.duration.seconds * 1000
        const duration = Util.buildTimeCode(Util.parseMS(durationMs))
        const raw = {
            duration,
            durationMs,
            live: v.is_live
        }

        return new Track(instance.context.player, {
            duration,
            title: v.title.text || "UNKNOWN TITLE",
            raw,
            metadata: raw,
            async requestMetadata() {
                return raw
            },
            author: v.author.name,
            requestedBy,
            thumbnail: v.thumbnails[0].url,
            url: `https://youtube.com/watch?v${v.id}`,
            queryType: "youtubeVideo",
            source: "youtube"
        })
    })
}