import type { SabrFormat } from "googlevideo/shared-types";
import type Innertube from "youtubei.js";

export type InnertubeClient = Parameters<Innertube['getBasicInfo']>[1]['client'];

export interface BaseCacheItem {
    url: string;
    expire: number;
}

export interface ServerAbrItem extends BaseCacheItem {
    uStreamConfig: string;
    sabrFormat: SabrFormat[];
}

export interface AdaptiveItem extends BaseCacheItem {
    cpn: string;
    size: number;
    client: InnertubeClient;
}

export type CacheItem<T extends string = string> =
    T extends `sabr:${string}` ?
    ServerAbrItem :
    T extends `adaptive:${string}` ?
    AdaptiveItem : AdaptiveItem | ServerAbrItem;

export type CacheKey = `sabr:${string}` | `adaptive:${string}`

export class DownloadUrlCache {
    data = new Map<CacheKey, CacheItem & { timestamp: number }>();
    timeout!: NodeJS.Timeout;

    constructor() {
        this.cleanup();
    }

    delete(key: CacheKey) {
        return this.data.delete(key);
    }

    get<T extends CacheKey>(key: T): CacheItem<T> | undefined {
        const value = this.data.get(key);
        if(!value) return undefined;

        if(this.checkExpire(value)) {
            this.data.delete(key);
            return undefined;
        }

        return value as unknown as CacheItem<T> | undefined;
    }

    set<T extends CacheKey>(key: T, item: CacheItem<T>) {
        const ts = Date.now();
        const cacheItem = {
            ...item,
            timestamp: ts
        }

        this.data.set(key, cacheItem);
    }

    checkExpire(item: CacheItem & { timestamp: number }) {
        return ((Date.now() - item.timestamp) > item.expire)
    }

    cleanup() {
        this.timeout = setInterval(() => {
            for (const [key, value] of this.data) {
                if (this.checkExpire(value)) {
                    this.data.delete(key);
                }
            }
        }, 3.6e+6).unref();
    }

    buildAdaptiveCacheKey(id: string) {
        return buildAdaptiveCacheKey(id)
    }

    buildSabrCacheKey(id: string) {
        return buildSabrCacheKey(id);
    }
}

export const cache = new DownloadUrlCache();

export const buildAdaptiveCacheKey = (id: string) => `adaptive:${id}` as `adaptive:${string}`;
export const buildSabrCacheKey = (id: string) => `sabr:${id}` as `sabr:${string}`; 