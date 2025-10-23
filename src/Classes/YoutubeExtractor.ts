// @ts-nocheck
// uhh this isnt really complete, searching by link works and thats all. no options or anything (same for everything else i added)
// im still working on options and stuffs on my side so dun count on me for that i guess
// overall everything i put here is abit messy since i didnt clean up that much hope you dont mind

import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, ExtractorStreamable, GuildQueueHistory, Playlist, SearchQueryType, Track, Util } from "discord-player";
import { Innertube, YTNodes } from "youtubei.js/agnostic";
import { getInnertube } from "../utils/index";
import { createSabrStream } from "../Streams/ServerAbrStream";
import { Readable } from "node:stream";

export class YoutubeiExtractor extends BaseExtractor {
    public static identifier: string = "youtubei";

    private innertube: Innertube;
    private _stream: Function;

    async activate(): Promise<void> {
        this.protocols = ["youtube", "yt"];
        this.innertube = await getInnertube();

        const fn = (this.options as any).createStream;
        if (typeof fn === "function") this._stream = (q) => { return fn(this, q) };
    }

    async deactivate(): Promise<void> {
        this._stream = null;
        this.innertube = null;
    }

    async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
        if (typeof query !== "string") return false;
        let isUrl: boolean;
        try {
            new URL(query);
            isUrl = true;
        } catch (error) {
            isUrl = false;
        }
        return isUrl || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(query);
    }

    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        try {
            let isPlaylist: boolean = false;
            let playlistId: string | null = null;

            try {
                const urlObj = new URL(query);
                const hasList: boolean = urlObj.searchParams.has("list");
                const isShortLink: boolean = /(^|\.)youtu\.be$/i.test(urlObj.hostname);

                isPlaylist = hasList && !isShortLink;
                playlistId = isPlaylist ? urlObj.searchParams.get("list") : null;
            } catch {
                const m = query.match(/[?&]list=([a-zA-Z0-9_-]+)/);
                isPlaylist = !!m;
                playlistId = m?.[1] ?? null;
            }

            if (isPlaylist && playlistId) {
                let playlist = await this.innertube.getPlaylist(playlistId);
                if (!playlist?.videos?.length) return this.createResponse(null, []);

                const dpPlaylist = new Playlist(this.context.player, {
                    id: playlistId,
                    title: playlist.info.title ?? "UNKNOWN TITLE",
                    url: query,
                    thumbnail: playlist.info.thumbnails[0]?.url ?? null,
                    description: playlist.info.description ?? "UNKNOWN DESCRIPTION",
                    source: "youtube",
                    type: "playlist",
                    author: {
                        name:
                            playlist?.channels[0]?.author?.name ??
                            playlist.info.author.name ??
                            "UNKNOWN AUTHOR",
                        url:
                            playlist?.channels[0]?.author?.url ??
                            playlist.info.author.url ??
                            "UNKNOWN AUTHOR",
                    },
                    tracks: [],
                });

                dpPlaylist.tracks = [];

                const playlistTracks = (
                    playlist.videos.filter((v) => v.type === "PlaylistVideo")
                ).map((v: YTNodes.PlaylistVideo) => {
                    const duration = Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000));
                    const raw = {
                        duration_ms: v.duration.seconds * 1000,
                        live: v.is_live,
                        duration,
                    };

                    return new Track(this.context.player, {
                        title: v.title.text ?? "UNKNOWN TITLE",
                        duration: duration,
                        thumbnail: v.thumbnails[0]?.url ?? null,
                        author: v.author.name,
                        requestedBy: context.requestedBy,
                        url: `https://youtube.com/watch?v=${v.id}`,
                        raw,
                        playlist: dpPlaylist,
                        source: "youtube",
                        queryType: "youtubeVideo",
                        async requestMetadata() { return this.raw },
                        metadata: raw,
                        live: v.is_live,
                    });
                });

                while (playlist.has_continuation) {
                    playlist = await playlist.getContinuation();

                    playlistTracks.push(...(
                        playlist.videos.filter((v) => v.type === "PlaylistVideo")).map((v: YTNodes.PlaylistVideo) => {
                            const duration = Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000));
                            const raw = {
                                duration_ms: v.duration.seconds * 1000,
                                live: v.is_live,
                                duration,
                            };

                            return new Track(this.context.player, {
                                title: v.title.text ?? "UNKNOWN TITLE",
                                duration,
                                thumbnail: v.thumbnails[0]?.url ?? null,
                                author: v.author.name,
                                requestedBy: context.requestedBy,
                                url: `https://youtube.com/watch?v=${v.id}`,
                                raw,
                                playlist: dpPlaylist,
                                source: "youtube",
                                queryType: "youtubeVideo",
                                async requestMetadata() { return this.raw },
                                metadata: raw,
                                live: v.is_live,
                            });
                        }),
                    );
                }

                dpPlaylist.tracks = playlistTracks;

                return this.createResponse(dpPlaylist, playlistTracks);
            }

            const videoId: string = extractVideoId(query);
            if (!videoId) return this.createResponse(null, []);

            const info = await this.innertube.getBasicInfo(videoId);
            const durationMs = (info.basic_info?.duration ?? 0) * 1000;

            const trackObj = new Track(this.context.player, {
                title: info.basic_info?.title ?? "UNKNOWN TITLE",
                author: info.basic_info?.author ?? "UNKNOWN AUTHOR",
                thumbnail: info.basic_info?.thumbnail?.[0]?.url ?? undefined,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                duration: Util.buildTimeCode(Util.parseMS(durationMs)),
                source: "youtube",
                requestedBy: context.requestedBy ?? null,
                raw: {
                    basicInfo: info,
                    live: info.basic_info?.is_live || false,
                },
            });

            return this.createResponse(null, [trackObj]);
        } catch (error) {
            console.error(`[YoutubeiExtractor Error]: ${error}`);
            return this.createResponse(null, []);
        }
    }

    async stream(track: Track): Promise<ExtractorStreamable> {
        try {
            if (!this.innertube) throw new Error("Innertube not initialized.");

            const videoId = extractVideoId(track.url || track.raw?.id || "");
            if (!videoId) throw new Error("Unable to extract videoId.");

            const nodeStream: Readable = await createSabrStream(videoId);

            return nodeStream;
        } catch (error) {
            console.error(`[Youtubei Extractor Error] Error while creating stream: ${error}`);
            throw error;
        }
    }

    async getRelatedTracks(track: Track, history: GuildQueueHistory): Promise<ExtractorInfo> {
        let videoId = extractVideoId(track);
        if (!videoId) throw new Error("[YoutubeiExtractor Error] Error at getRelatedTracks(): Unable to extract videoId.");

        const info = await this.innertube.getInfo(videoId);
        const next = info.watch_next_feed;

        const recommended = (next as unknown as YTNodes.CompactVideo[]).filter((v: any) => !history.tracks.some((x) => x.url === `https://youtube.com/watch?v=${v.id}`) && v.type === "CompactVideo");

        if (!recommended) {
            this.context.player.debug("Unable to fetch recommendations.");
            return this.createResponse(null, []);
        }

        const trackConstruct = recommended.map((v) => {
            const duration = Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000));
            const raw = {
                live: v.is_live,
                duration_ms: v.duration.seconds * 1000,
                duration,
            };

            return new Track(this.context.player, {
                title: v.title?.text ?? "UNKNOWN TITLE",
                thumbnail: v.best_thumbnail?.url ?? v.thumbnails[0].url,
                author: v.author?.name ?? "UNKNOWN AUTHOR",
                requestedBy: track.requestedBy ?? null,
                url: `https://youtube.com/watch?v=${v.video_id}`,
                source: "youtube",
                duration,
                raw,
            });
        });

        return this.createResponse(null, trackConstruct);
    }
}

function extractPlaylistId(url: string): string {
    try {
        const u = new URL(url);
        return u.searchParams.get("list");
    } catch {
        return null;
    }
}

function extractVideoId(vid: any): string {
    const YOUTUBE_REGEX = /^https:\/\/(www\.)?youtu(\.be\/.{11}(.+)?|be\.com\/watch\?v=.{11}(&.+)?)/;
    if (!YOUTUBE_REGEX.test(vid)) throw new Error("Invalid Youtube link.");

    let id = new URL(vid).searchParams.get("v");
    if (!id) id = vid.split("/").at(-1)?.split("?").at(0);

    return id;
}