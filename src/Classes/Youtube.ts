import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, ExtractorStreamable, QueryType, SearchQueryType, Track } from "discord-player";
import { youtubeOptions } from "../types";
import Innertube from "youtubei.js";
import { getInnertube, getPlaylistId, isUrl } from "../utils";
import { getMixedPlaylist, getPlaylist, getVideo, runWithSearchContext, search } from "../internal";
import { CacheType, YoutubeTrack } from "./YoutubeTrack";

export class YoutubeExtractor extends BaseExtractor<youtubeOptions> {
    public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";

    private innertube: Innertube|null = null;
    private _stream: Function|null = null;

    public async activate(): Promise<void> {
        this.innertube = await getInnertube(this.options);

        this.protocols = ["yt", "youtube"];
        const fn = this.options.createStream;
        if (typeof fn === "function") this._stream = (q) => { return fn(q, this) };
    }

    public async deactivate(): Promise<void> {
        this.innertube = null;
        this._stream = null;
    }

    public async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
        if(typeof query !== "string") return false;
        return !isUrl(query) || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(query);
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        return runWithSearchContext(context, async () => {
            switch (context.type) {
                case QueryType.YOUTUBE_PLAYLIST: {
                    const playlistId = getPlaylistId(query);

                    if(!playlistId.playlistId) {
                        this.debug("Invalid Playlist ID { playlist: " + query + " }.");
                        return this.createResponse(null, []);
                    }

                    if(playlistId.isMix && playlistId.videoId) {
                        const pl = await getMixedPlaylist(playlistId.playlistId, playlistId.videoId, this);
                        return this.createResponse(pl, pl.tracks);
                    }

                    const pl = await getPlaylist(playlistId.playlistId, this);
                    return this.createResponse(pl, pl.tracks);
                }
                case QueryType.YOUTUBE_VIDEO: {
                    return this.createResponse(null, [await getVideo(query, this)]);
                }
                default: {
                    return this.createResponse(null, await search(query, this));
                }
            }
        });
    }

    public async stream(info: Track): Promise<ExtractorStreamable> {
        if(!(info instanceof YoutubeTrack)) throw new Error("Invalid youtube track provided.");

        try {
            const sabrCache = info.getCache(CacheType.SeverAbr);

            if(sabrCache) {
                this.context.player.debug(`[${info.title}] Streaming with: SABR Protocol (from cache)`);
                return await info.downloadSabr(this.options);
            }

            this.context.player.debug(`[${info.title}] Sabr Cache not found. Streaming with: Adaptive`);;
            return await info.downloadAdaptive();
        } catch (error) {
            this.context.player.debug(`[${info.title}] Failed to create stream: ${error}`);
            throw error;
        }
    }
}