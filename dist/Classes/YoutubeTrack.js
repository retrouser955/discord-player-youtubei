"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeTrack = exports.CacheType = void 0;
const discord_player_1 = require("discord-player");
const AdaptiveStream_1 = require("../Streams/AdaptiveStream");
const utils_1 = require("../utils");
const Constants_1 = require("../Constants");
const ServerAbrStream_1 = require("../Streams/ServerAbrStream");
var CacheType;
(function (CacheType) {
    CacheType[CacheType["SeverAbr"] = 0] = "SeverAbr";
    CacheType[CacheType["Adaptive"] = 1] = "Adaptive";
})(CacheType || (exports.CacheType = CacheType = {}));
class YoutubeTrack extends discord_player_1.Track {
    cache = new Map();
    async downloadAdaptive() {
        const cache = this.getCache(CacheType.Adaptive);
        if (cache)
            return new AdaptiveStream_1.AdaptiveStream(cache.url, cache.cpn, cache.size);
        const yt = await (0, utils_1.getInnertube)();
        const info = await yt.getBasicInfo(this.url);
        const fmt = info.chooseFormat({ format: "mp4", quality: "highestaudio", type: "audio" });
        return new AdaptiveStream_1.AdaptiveStream(await fmt.decipher(yt.session.player), info.cpn, fmt.content_length || 0);
    }
    async downloadSabr(options) {
        return await (0, ServerAbrStream_1.createSabrStream)((0, utils_1.getVideoId)(this.url), options);
    }
    setCache(opt) {
        const urlParsed = new URL(opt.url);
        let expire = Number(urlParsed.searchParams.get("expire") || "0");
        if (!expire && isNaN(expire))
            expire = Constants_1.DEFAULT_EXPIRE_DURATION;
        this.cache.set(opt.type, { ...opt, expire });
    }
    getCache(type) {
        const data = this.cache.get(type);
        if (!data)
            return null;
        if (data.expire < (Date.now() / 1000)) {
            this.cache.delete(type);
            return null;
        }
        return data;
    }
}
exports.YoutubeTrack = YoutubeTrack;
