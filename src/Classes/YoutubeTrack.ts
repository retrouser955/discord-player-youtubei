import { Track } from "discord-player";
import { Readable } from "stream";

export enum CacheType {
    ServerAbr,
    Adaptive
}

export interface DownloadUrlCache<T extends CacheType> {
    expire: number;
    url: string;
    type: T;
    uStreamConfig: T extends CacheType.ServerAbr ? string | undefined : never;
}

export class YoutubeTrack extends Track {
    cache = new Map<CacheType, DownloadUrlCache<CacheType>>();

    async downloadAdaptive(): Promise<Readable> {
        throw new Error("Method not implemented.")
    }

    async downloadSabr(): Promise<Readable> {
        throw new Error("Method not implemented.")
    }

    setCache<T extends CacheType>(url: T extends CacheType.Adaptive ? string : { url: string, uStreamerConfig: string | undefined }, type: T) {
        let expire = Number(new URL(typeof url === "string" ? url : url.url).searchParams.get("expire"));
        if (!expire || expire === 0 || isNaN(expire)) expire = Date.now() + 1.8e+6;
        if (type === CacheType.Adaptive && typeof url === "string") {
            this.cache.set(type, {
                expire,
                url,
                type,
                uStreamConfig: type === CacheType.ServerAbr ? new URL(url).searchParams.get("sabr") || undefined : undefined
            });
        }
        this.cache.set(type, {
            expire,
            url: (url as { url: string }).url,
            type,
            uStreamConfig: type === CacheType.ServerAbr ? new URL((url as { url: string }).url).searchParams.get("sabr") || undefined : undefined
        })
    }

    getCache(type: CacheType) {
        const data = this.cache.get(type);
        if (!data) return null;
        if (data.expire < Date.now()) {
            this.cache.delete(type);
            return null;
        }
        return data.url;
    }
}