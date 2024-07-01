import { BaseExtractor, ExtractorStreamable, Track, SearchQueryType, QueryType, ExtractorInfo, ExtractorSearchContext, Playlist, Util, GuildQueueHistory } from "discord-player";
import Innertube, { UniversalCache, type OAuth2Tokens } from "youtubei.js";
import { type DownloadOptions } from "youtubei.js/dist/src/types";
import { Readable } from "node:stream"
import { YouTubeExtractor, YoutubeExtractor } from "@discord-player/extractor";
import { type CompactVideo, type Video } from "youtubei.js/dist/src/parser/nodes";
import { type VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import { type YTNode } from "youtubei.js/dist/src/parser/helpers";

export interface YoutubeiOptions {
    authentication?: OAuth2Tokens;
    overrideDownloadOptions?: DownloadOptions;
    createStream?: (q: string, extractor: BaseExtractor<object>) => Promise<string | Readable>;
    signOutOnDeactive?: boolean;
}

export interface YTStreamingOptions {
    extractor?: BaseExtractor<object>;
    authentication?: OAuth2Tokens;
    demuxable?: boolean;
    overrideDownloadOptions?: DownloadOptions;
}

const DEFAULT_DOWNLOAD_OPTIONS: DownloadOptions = {
    quality: "best",
    format: "mp4",
    type: "audio"
}

async function streamFromYT(query: string, innerTube: Innertube, options: YTStreamingOptions = { demuxable: false, overrideDownloadOptions: DEFAULT_DOWNLOAD_OPTIONS }) {
    const ytId = query.includes("shorts") ? query.split("/").at(-1)!.split("?")[0]! : new URL(query).searchParams.get("v")!

    if (options.demuxable) {
        const readable = await innerTube.download(ytId, options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS)

        // @ts-expect-error
        const stream = Readable.fromWeb(readable)

        return {
            $fmt: options.overrideDownloadOptions?.format ?? "mp4",
            stream
        }
    }

    const streamData = await innerTube.getStreamingData(ytId, options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS)

    if (!streamData.url) throw new Error("Unable to get stream data from video.")

    return streamData.url
}

export class YoutubeiExtractor extends BaseExtractor<YoutubeiOptions> {
    public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";
    public innerTube!: Innertube
    public _stream!: (q: string, extractor: BaseExtractor<object>) => Promise<ExtractorStreamable>

    async activate(): Promise<void> {
        this.protocols = ['ytsearch', 'youtube']

        this.innerTube = await Innertube.create({
            cache: new UniversalCache(true, `${process.cwd()}/.dpy`)
        })
        if (this.options.authentication) {
            try {
                await this.innerTube.session.signIn(this.options.authentication)
                this.context.player.debug(`Signed into YouTube TV API using client name: ${this.innerTube.session.client_name}`)
            } catch (error) {
                this.context.player.debug(`Unable to sign into Innertube:\n\n${error}`)
            }
        }

        if (typeof this.options.createStream === "function") {
            this._stream = this.options.createStream
        } else {
            this._stream = (q, _) => {
                return streamFromYT(q, this.innerTube, {
                    overrideDownloadOptions: this.options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS,
                    demuxable: this.supportsDemux
                })
            }
        }
    }

    async deactivate(): Promise<void> {
        this.protocols = []
        if (this.options.signOutOnDeactive && this.innerTube.session.logged_in) await this.innerTube.session.signOut()
    }

    async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
        if (typeof query !== 'string') return false;
        // prettier-ignore
        return ([
            QueryType.YOUTUBE,
            QueryType.YOUTUBE_PLAYLIST,
            QueryType.YOUTUBE_SEARCH,
            QueryType.YOUTUBE_VIDEO,
            QueryType.AUTO,
            QueryType.AUTO_SEARCH
        ] as SearchQueryType[]).some((r) => r === type);
    }

    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        if (context.protocol === 'ytsearch') context.type = QueryType.YOUTUBE_SEARCH;
        query = query.includes('youtube.com') ? query.replace(/(m(usic)?|gaming)\./, '') : query;
        if (!query.includes('list=RD') && YouTubeExtractor.validateURL(query)) context.type = QueryType.YOUTUBE_VIDEO;

        switch (context.type) {
            case QueryType.YOUTUBE_PLAYLIST: {
                const playlistUrl = new URL(query)
                const plId = playlistUrl.searchParams.get("list")!
                const playlist = await this.innerTube.getPlaylist(plId)

                const pl = new Playlist(this.context.player, {
                    title: playlist.info.title ?? "UNKNOWN PLAYLIST",
                    thumbnail: playlist.info.thumbnails[0].url,
                    description: playlist.info.description ?? playlist.info.title ?? "UNKNOWN DESCRIPTION",
                    type: "playlist",
                    author: {
                        name: playlist.channels[0].author.name,
                        url: playlist.channels[0].author.url
                    },
                    tracks: [],
                    id: plId,
                    url: query,
                    rawPlaylist: playlist,
                    source: "youtube"
                })

                pl.tracks = (playlist.videos as Video[]).map((vid) => this.buildTrack(vid, context, pl))

                return {
                    playlist: pl,
                    tracks: pl.tracks
                }
            }
            case QueryType.YOUTUBE_VIDEO: {
                const videoId = new URL(query).searchParams.get("v")!
                const vid = await this.innerTube.getInfo(videoId)

                return {
                    playlist: null,
                    tracks: [
                        new Track(this.context.player, {
                            title: vid.basic_info.title ?? "UNKNOWN TITLE",
                            thumbnail: vid.basic_info.thumbnail?.at(0)?.url,
                            description: vid.basic_info.short_description,
                            author: vid.basic_info.channel?.name,
                            requestedBy: context.requestedBy,
                            url: `https://youtube.com/watch?v=${vid.basic_info.id}`,
                            views: vid.basic_info.view_count,
                            duration: Util.buildTimeCode(Util.parseMS((vid.basic_info.duration ?? 0) * 1000)),
                            raw: vid,
                            source: "youtube",
                            queryType: "youtubeVideo",
                            metadata: vid,
                            async requestMetadata() {
                                return vid
                            },
                        })
                    ]
                }
            }
            default: {
                const search = await this.innerTube.search(query, {
                    type: "video"
                })
                const videos = (search.videos?.filter((v) => v.type === "Video") as Video[])

                return {
                    playlist: null,
                    tracks: videos.map((v) => this.buildTrack(v, context))
                }
            }
        }
    }

    buildTrack(vid: Video, context: ExtractorSearchContext, pl?: Playlist) {
        const track = new Track(this.context.player, {
            title: vid.title.text ?? "UNKNOWN YOUTUBE VIDEO",
            thumbnail: vid.best_thumbnail?.url ?? vid.thumbnails[0]?.url ?? "",
            description: vid.description ?? vid.title ?? "UNKNOWN DESCRIPTION",
            author: vid.author?.name ?? "UNKNOWN AUTHOR",
            requestedBy: context.requestedBy,
            url: `https://youtube.com/watch?v=${vid.id}`,
            views: parseInt(vid.view_count?.text ?? "0"),
            duration: vid.duration?.text ?? 0,
            raw: vid,
            playlist: pl,
            source: "youtube",
            queryType: "youtubeVideo",
            metadata: vid,
            async requestMetadata() {
                return vid
            },
        })

        track.extractor = this

        return track
    }


    stream(info: Track<unknown>): Promise<ExtractorStreamable> {
        return this._stream(info.url, this)
    }

    async getRelatedTracks(track: Track<VideoInfo | Video | CompactVideo>, history: GuildQueueHistory<unknown>): Promise<ExtractorInfo> {
        if (!YoutubeExtractor.validateURL(track.url)) return this.#emptyResponse()

        const video = await track.requestMetadata()

        if (!video) {
            this.context.player.debug("UNEXPECTED! VIDEO METADATA WAS NOT FOUND. HAVE YOU BEEN TEMPERING?")

            return {
                playlist: null,
                tracks: []
            }
        }

        // @ts-expect-error
        const isVidInfo = typeof video?.getWatchNextContinuation === "function"
        const rawVideo = isVidInfo ? (video as VideoInfo) : await this.innerTube.getInfo((video as (Video | CompactVideo)).id)

        if (rawVideo.watch_next_feed) {
            this.context.player.debug("Unable to get next video. Falling back to `watch_next_feed`")

            const recommended = (rawVideo.watch_next_feed as unknown as CompactVideo[]).filter((v) =>
                !history.tracks.some((x) => x.url === `https://youtube.com/watch?v=${v.id}`) && v.type === "CompactVideo"
            )

            if (!recommended) {
                this.context.player.debug("Unable to fetch recommendations")
                return this.#emptyResponse()
            }

            const trackConstruct = recommended.map(v => {
                return new Track(this.context.player, {
                    title: v.title?.text ?? "UNKNOWN TITLE",
                    thumbnail: v.best_thumbnail?.url ?? v.thumbnails[0]?.url,
                    author: v.author?.name ?? "UNKNOWN AUTHOR",
                    requestedBy: track.requestedBy,
                    url: `https://youtube.com/watch?v=${v.id}`,
                    views: parseInt(v.view_count?.text ?? "0"),
                    duration: v.duration?.text,
                    raw: v,
                    source: "youtube",
                    queryType: "youtubeVideo",
                    metadata: v,
                    async requestMetadata() {
                        return v
                    },
                })
            })

            return {
                playlist: null,
                tracks: trackConstruct
            }
        }

        this.context.player.debug("Unable to fetch recommendations")
        return this.#emptyResponse()
    }

    #emptyResponse() {
        return {
            playlist: null,
            tracks: []
        }
    }
}
