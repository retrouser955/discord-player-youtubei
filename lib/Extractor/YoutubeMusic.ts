import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, QueryType, SearchQueryType, Track, Util } from "discord-player";
import type Innertube from "youtubei.js";
import { YoutubeiExtractor } from "./Youtube";
import { extractSearchQueryType, isYoutubeMusic } from "../common/isYoutubeMusic";

export type YoutubeMusicExtractorOptions = {
    youtubeiExtractor: YoutubeiExtractor
}

export class YoutubeMusicExtractor extends BaseExtractor<YoutubeMusicExtractorOptions> {
    public static identifier: string = "com.retrouser955.discord-player.discord-player-ytmusic";

    innertube!: Innertube

    async activate(): Promise<void> {
        if(!this.options.youtubeiExtractor) throw new Error("ERR_DEP_EXTRACTOR: Cannot use youtube music extractor without youtubei extractor")
        this.innertube = this.options.youtubeiExtractor.innerTube
    }

    async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
        return isYoutubeMusic(query) || ([QueryType.AUTO_SEARCH, QueryType.AUTO] as SearchQueryType[]).some(r => r === type)
    }

    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        const type = extractSearchQueryType(query)

        switch(type) {
            case "track": {
                const trackID = new URL(query).searchParams.get("v")
                if(!trackID) throw new Error("unable to find the videoId from the given track")

                const info = await this.innertube.music.getInfo(trackID)

                const trackConstruct = new Track(this.context.player, {
                    requestedBy: context.requestedBy,
                    title: info.basic_info.title || "UNKNOWN MUSIC",
                    description: info.basic_info.short_description,
                    thumbnail: (info.basic_info.thumbnail || [])[0]?.url,
                    duration: Util.buildTimeCode(Util.parseMS(info.basic_info.duration || 0)),
                    author: info.basic_info.channel?.name,
                    views: info.basic_info.view_count || 0,
                    url: `https://music.youtube.com/watch?v=${info.basic_info.id}`,
                    source: "youtube",
                    queryType: "youtubeVideo",
                    live: false
                })

                return {
                    playlist: null,
                    tracks: [trackConstruct]
                }
            }
        }
    }
}