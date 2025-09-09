import type { QueryType, Track } from "discord-player";
import type { ProxyAgent } from "undici";
import type { DownloadOptions, InnerTubeClient } from "youtubei.js/dist/src/types";
import type { YoutubeExtractor } from "../Classes/Youtube";
import type { Readable } from "stream";
import type { PeerOptions } from "../utils";
import type { YoutubeTrack } from "../Classes/YoutubeTrack";

export type OnBeforeMetadataRequest = (query: string, type: QueryType) => Promise<YoutubeTrack>;

export enum DebugTypes {
    Stream,
    Metadata
}

export interface StreamOptions {
    highWaterMark?: number;
    client?: InnerTubeClient | ((track: Track) => InnerTubeClient);
}

export interface YoutubeOptions {
    overrideDownloadOptions?: DownloadOptions;
    createStream: (q: Track, ext: YoutubeExtractor) => Promise<string|Readable>;
    debug?: (type: DebugTypes, message: string) => unknown;
    disablePlayer?: boolean;
    cookie?: string;
    peers?: PeerOptions[];
    proxy?: ProxyAgent[];
}