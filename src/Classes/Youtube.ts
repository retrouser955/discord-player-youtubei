import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, ExtractorStreamable, QueryType, SearchQueryType, Track } from "discord-player";
import { YoutubeOptions } from "../types";
import Innertube from "youtubei.js";
import { getInnertube, getPlaylistId, getVideoId, isUrl } from "../utils";
import { getMixedPlaylist, getPlaylist, getVideo, runWithSearchContext, search } from "../internal";
import { buildAdaptiveCacheKey, buildSabrCacheKey, cache } from "../Cache/DownloadCache";
import { createSabrStream } from "../Streams/ServerAbrStream";
import { AdaptiveStream } from "../Streams/AdaptiveStream";

export class YoutubeExtractor extends BaseExtractor<YoutubeOptions> {
    public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";

    private innertube: Innertube | null = null;
    private _stream: Function | null = null;

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
        if (typeof query !== "string") return false;
        return true;
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        if (context.type !== QueryType.YOUTUBE_PLAYLIST && context.type !== QueryType.YOUTUBE_VIDEO) {
            try {
                if (isUrl(query)) {
                    context.type = QueryType.YOUTUBE_VIDEO;
                    const queryUrl = new URL(query);
                    if (queryUrl.searchParams.has("list")) context.type = QueryType.YOUTUBE_PLAYLIST;
                }
            } catch (error) {
                this.context.player.debug(`Error determining context type: ${error}`);
                throw error;
            }
        }

        return runWithSearchContext(context, async () => {
            switch (context.type) {
                case QueryType.YOUTUBE_PLAYLIST: {
                    const playlistId = getPlaylistId(query);

                    if (!playlistId.playlistId) {
                        this.context.player.debug("Invalid Playlist ID { playlist: " + query + " }.");
                        return this.createResponse(null, []);
                    }

                    if (playlistId.isMix && playlistId.videoId) {
                        const pl = await getMixedPlaylist(playlistId.playlistId, playlistId.videoId, this);
                        return this.createResponse(pl, pl.tracks);
                    }

                    const pl = await getPlaylist(playlistId.playlistId, this);
                    return this.createResponse(pl, pl.tracks);
                }
                case QueryType.YOUTUBE_VIDEO: {
                    return this.createResponse(null, [await getVideo(getVideoId(query), this)]);
                }
                default: {
                    return this.createResponse(null, await search(query, this));
                }
            }
        });
    }
}