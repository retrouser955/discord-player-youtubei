import { Track } from "discord-player";
import { Readable } from "stream";
import { AdaptiveStream } from "../Streams/AdaptiveStream";
import { getInnertube } from "../utils";

const DEFAULT_EXPIRE_DURATION = 10800000; // 3 hours

export enum CacheType {
    ServerAbr,
    Adaptive
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
    type: CacheType.ServerAbr;
    uStreamConfig?: string;
}

export interface BaseSetCacheOptions {
    url: string;
    type: CacheType;
}

export interface ServerAbrSetCacheOptions extends BaseSetCacheOptions {
    type: CacheType.ServerAbr;
    uStreamConfig?: string;
}

export interface AdaptiveSetCacheOptions extends BaseSetCacheOptions {
    type: CacheType.Adaptive;
    cpn: string;
    size: number;
}

export class YoutubeTrack extends Track {
    cache = new Map<CacheType, ServerAbrCache | AdaptiveCache>();

    async downloadAdaptive(): Promise<Readable> {
        const cache = this.getCache(CacheType.Adaptive);

        if(cache) return new AdaptiveStream(cache.url, cache.cpn, cache.size)

        const yt = await getInnertube();
        const info = await yt.getBasicInfo(this.url);
        const fmt = info.chooseFormat({ format: "mp4", quality: "highestaudio", type: "audio" })

        return new AdaptiveStream(fmt.decipher(yt.session.player), info.cpn, fmt.content_length || 0);
    }

    async downloadSabr(): Promise<Readable> {
        throw new Error("Method not implemented.")
    }

    setCache(opt: AdaptiveSetCacheOptions | ServerAbrSetCacheOptions) {
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