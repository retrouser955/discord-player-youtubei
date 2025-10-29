"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeExtractor = void 0;
const discord_player_1 = require("discord-player");
const utils_1 = require("../utils");
const internal_1 = require("../internal");
const YoutubeTrack_1 = require("./YoutubeTrack");
class YoutubeExtractor extends discord_player_1.BaseExtractor {
    static identifier = "com.retrouser955.discord-player.discord-player-youtubei";
    innertube = null;
    _stream = null;
    async activate() {
        this.innertube = await (0, utils_1.getInnertube)(this.options);
        this.protocols = ["yt", "youtube"];
        const fn = this.options.createStream;
        if (typeof fn === "function")
            this._stream = (q) => { return fn(q, this); };
    }
    async deactivate() {
        this.innertube = null;
        this._stream = null;
    }
    async validate(query, type) {
        if (typeof query !== "string")
            return false;
        return true;
    }
    async handle(query, context) {
        if (context.type !== discord_player_1.QueryType.YOUTUBE_PLAYLIST && context.type !== discord_player_1.QueryType.YOUTUBE_VIDEO) {
            try {
                if ((0, utils_1.isUrl)(query)) {
                    context.type = discord_player_1.QueryType.YOUTUBE_VIDEO;
                    const queryUrl = new URL(query);
                    if (queryUrl.searchParams.has("list"))
                        context.type = discord_player_1.QueryType.YOUTUBE_PLAYLIST;
                }
            }
            catch (error) {
                this.context.player.debug(`Error determining context type: ${error}`);
                throw error;
            }
        }
        return (0, internal_1.runWithSearchContext)(context, async () => {
            switch (context.type) {
                case discord_player_1.QueryType.YOUTUBE_PLAYLIST: {
                    const playlistId = (0, utils_1.getPlaylistId)(query);
                    if (!playlistId.playlistId) {
                        this.debug("Invalid Playlist ID { playlist: " + query + " }.");
                        return this.createResponse(null, []);
                    }
                    if (playlistId.isMix && playlistId.videoId) {
                        const pl = await (0, internal_1.getMixedPlaylist)(playlistId.playlistId, playlistId.videoId, this);
                        return this.createResponse(pl, pl.tracks);
                    }
                    const pl = await (0, internal_1.getPlaylist)(playlistId.playlistId, this);
                    return this.createResponse(pl, pl.tracks);
                }
                case discord_player_1.QueryType.YOUTUBE_VIDEO: {
                    return this.createResponse(null, [await (0, internal_1.getVideo)((0, utils_1.getVideoId)(query), this)]);
                }
                default: {
                    return this.createResponse(null, await (0, internal_1.search)(query, this));
                }
            }
        });
    }
    async stream(info) {
        if (!(info instanceof YoutubeTrack_1.YoutubeTrack))
            throw new Error("Invalid youtube track provided.");
        try {
            const sabrCache = info.getCache(YoutubeTrack_1.CacheType.SeverAbr);
            const adaptiveCache = info.getCache(YoutubeTrack_1.CacheType.Adaptive);
            if (sabrCache) {
                this.context.player.debug(`[${info.title}] Streaming with: SABR Protocol (from cache)`);
                return await info.downloadSabr(this.options);
            }
            if (!sabrCache && adaptiveCache) {
                this.context.player.debug(`[${info.title}] Sabr Cache not found. Streaming with: Adaptive`);
                ;
                return await info.downloadAdaptive();
            }
            this.context.player.debug(`[${info.title}] No Cache found, assume track is searched by name. Streaming with: SABR Protocol`);
            return await info.downloadSabr(this.options);
        }
        catch (error) {
            this.context.player.debug(`[${info.title}] Failed to create stream: ${error}`);
            throw error;
        }
    }
}
exports.YoutubeExtractor = YoutubeExtractor;
