import { ProxyAgent } from "undici";
import type { peerOptions, playlistObj, youtubeOptions } from "../types";
import Innertube from "youtubei.js";
import { Readable } from "node:stream";
export type ProxyAgentOptions = ProxyAgent.Options | string;
export declare function createProxy(options: ProxyAgentOptions): ProxyAgent;
export declare function buildVideoUrl(videoId: string): string;
export declare function buildPlaylistUrl(playlistId: string, videoId?: string): string;
export declare function getVideoId(url: string): string;
export declare function getPlaylistId(url: string): playlistObj;
export declare function createYoutubeFetch(options?: youtubeOptions): any;
export declare function createPeer(option: peerOptions): peerOptions;
export declare function toNodeReadable(stream: any): Readable | null;
export declare function isUrl(input: string): boolean;
export declare function getInnertube(options?: youtubeOptions & {
    force?: boolean;
}): Promise<Innertube>;
