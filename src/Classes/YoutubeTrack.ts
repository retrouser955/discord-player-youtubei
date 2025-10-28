import { Track } from "discord-player";
import { Readable } from "node:stream";
import { AdaptiveStream } from "../Streams/AdaptiveStream";
import { getInnertube, getVideoId } from "../utils";
import { DEFAULT_EXPIRE_DURATION } from "../Constants";
import { createSabrStream } from "../Streams/ServerAbrStream";
import { youtubeOptions } from "../types";

export enum CacheType {
    SeverAbr,
    Adaptive,
}

export interface BaseDownloadCache {
    expire: number;
    url: string;
    type: CacheType;
}

export interface AdaptiveCache extends BaseDownloadCache {
    type: CacheType.Adaptive;
    cpn: string;
    size: number;
}

export interface ServerAbrCache extends BaseDownloadCache {
    type: CacheType.SeverAbr;
    uStreamConfig?: string;
}

export interface BaseSetCacheOptions {
    url: string;
    type: CacheType;
}

export interface ServerAbrCacheOptions extends BaseSetCacheOptions {
    type: CacheType.SeverAbr;
    uStreamConfig?: string;
}

export interface AdaptiveSetCacheOptions extends BaseSetCacheOptions {
    type: CacheType.Adaptive;
    cpn: string;
    size: number;
}

export class YoutubeTrack extends Track {
    cache = new Map<CacheType, ServerAbrCache|AdaptiveCache>();

    async downloadAdaptive(): Promise<Readable> {
        const cache = this.getCache(CacheType.Adaptive);

        if(cache) return new AdaptiveStream(cache.url, cache.cpn, cache.size);

        const yt = await getInnertube();
        const info = await yt.getBasicInfo(this.url);
        const fmt = info.chooseFormat({ format: "mp4", quality: "highestaudio", type: "audio" })

        return new AdaptiveStream(await fmt.decipher(yt.session.player), info.cpn, fmt.content_length || 0);
    }

    async downloadSabr(options: youtubeOptions): Promise<Readable> {
        return await createSabrStream(getVideoId(this.url), options);
    }

    setCache(opt: AdaptiveSetCacheOptions | ServerAbrCacheOptions) {
        const urlParsed = new URL(opt.url);
        let expire = Number(urlParsed.searchParams.get("expire") || "0");
        if(!expire && isNaN(expire)) expire = DEFAULT_EXPIRE_DURATION;

        this.cache.set(opt.type, { ...opt, expire });
    }

    getCache<T extends CacheType>(type: T) {
        const data = this.cache.get(type);
        if (!data) return null;
        if (data.expire < Date.now()) {
            this.cache.delete(type);
            return null;
        }
        return data as T extends CacheType.Adaptive ? AdaptiveCache : ServerAbrCache;
    }
}