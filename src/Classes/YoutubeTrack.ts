import { Track } from "discord-player";
import { Readable } from "stream";

export enum CacheType {
    ServerAbr,
    Adaptive
}

export interface DownloadUrlCache {
    expire: number;
    url: string;
}

export class YoutubeTrack extends Track {
    cache = new Map<CacheType, DownloadUrlCache>();

    async downloadAdaptive(): Promise<Readable> {
        throw new Error("Method not implemented.")
    }

    async downloadSabr(): Promise<Readable> {
        throw new Error("Method not implemented.")
    }

    setCache(url: string, type: CacheType) {
        let expire = Number(new URL(url).searchParams.get("expire"));
        if (!expire || expire === 0 || isNaN(expire)) expire = Date.now() + 1.8e+6;

        this.cache.set(type, {
            expire,
            url
        });
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