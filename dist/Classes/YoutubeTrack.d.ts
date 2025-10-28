import { Track } from "discord-player";
import { Readable } from "node:stream";
import { youtubeOptions } from "../types";
export declare enum CacheType {
    SeverAbr = 0,
    Adaptive = 1
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
export declare class YoutubeTrack extends Track {
    cache: Map<CacheType, AdaptiveCache | ServerAbrCache>;
    downloadAdaptive(): Promise<Readable>;
    downloadSabr(options: youtubeOptions): Promise<Readable>;
    setCache(opt: AdaptiveSetCacheOptions | ServerAbrCacheOptions): void;
    getCache<T extends CacheType>(type: T): T extends CacheType.Adaptive ? AdaptiveCache : ServerAbrCache;
}
