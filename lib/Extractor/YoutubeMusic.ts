import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, Playlist, QueryType, SearchQueryType, Track, Util } from "discord-player";
import type Innertube from "youtubei.js";
import { YoutubeiExtractor } from "./Youtube";
import { extractSearchQueryType, isYoutubeMusic } from "../common/isYoutubeMusic";
import { YTNodes } from "youtubei.js";

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
            case "playlist": {
                const plURL = new URL(query)
                const plID = plURL.searchParams.get("list")
                if(!plID) throw new Error("That is not a valid youtube playlist")
                let playlistInfo = await this.innertube.music.getPlaylist(plID)

                if(!playlistInfo.header?.is(YTNodes.MusicResponsiveHeader)) throw new Error("Error: MusicResponsiveHeader not found (no metadata queries)")
                
                const playlistMeta = playlistInfo.header.as(YTNodes.MusicResponsiveHeader)

                const playlist = new Playlist(this.context.player, {
                    title: playlistMeta.title.text || "UNKNOWN PLAYLIST",
                    thumbnail: playlistMeta.thumbnail?.contents.at(0)?.url || "https://upload.wikimedia.org/wikipedia/commons/d/d8/YouTubeMusic_Logo.png",
                    tracks: [],
                    type: "playlist",
                    author: {
                        name: playlistMeta.strapline_text_one.text!,
                        url: "retrouser955://discord-player-youtubei/no-playlist-author-url"
                    },
                    id: plID,
                    url: query,
                    source: "youtube",
                    description: playlistMeta.description?.description.text!
                })

                const tracks = this.#mapPlaylistTracks(playlistInfo, context, playlist)

                while(playlistInfo.has_continuation) {
                    playlistInfo = await playlistInfo.getContinuation();

                    tracks.push(...this.#mapPlaylistTracks(playlistInfo, context, playlist))
                }

                playlist.tracks = tracks

                return {
                    playlist,
                    tracks
                }
            }
        }
    }

    #mapPlaylistTracks(playlistInfo: Awaited<ReturnType<Innertube['music']['getPlaylist']>>, context: ExtractorSearchContext, playlist: Playlist): Track[] {
        if(!playlistInfo.contents) return []
        const tracks = playlistInfo.contents?.filterType(YTNodes.MusicResponsiveListItem).map(v => {
            const duration = Util.buildTimeCode(Util.parseMS((v.duration?.seconds || 0) * 1000))
            const raw = {
                duration_ms: (v.duration?.seconds || 0) * 1000,
                live: false,
                duration
            }

            return new Track(this.context.player, {
                title: v.title!,
                duration,
                author: v.artists?.map((v) => v.name).join(", "),
                requestedBy: context.requestedBy,
                url: `https://music.youtube.com/watch?v=${v.id}`,
                raw,
                playlist,
                source: "youtube",
                requestMetadata: async () => raw,
                metadata: raw,
                live: false
            })
        })

        return tracks
    }
}