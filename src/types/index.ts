import type { Types } from "youtubei.js"
import type { Track } from "discord-player";
import type { Readable } from "node:stream";
import type { YoutubeExtractor } from "../Classes";
import type { ProxyAgent } from "undici";

export interface streamOptions {
    highWaterMark?: number;
    client?: Types.InnerTubeClient | ((track: Track) => Types.InnerTubeClient);
}

export interface YoutubeOptions {
    createStream?: (q: Track, ext: YoutubeExtractor) => Promise<string|Readable>;
    overrideDownloadOptions?: Types.DownloadOptions;
    disablePlayer?: boolean;
    cookie?: string;
    proxy?: ProxyAgent[];
    peer?: peerOptions[];
}

export interface InitOptions {
    forceRefresh?: boolean;
}

export interface minterResult {
    generatePlaceholder?: (binding: string) => string;
    mint?: (binding: string) => Promise<string>;
}

export interface playlistObj {
    playlistId: string;
    videoId?: string;
    isMix?: boolean;
}

export interface peerOptions {
    url: string;
    parse?: (url: string, youtubeId: string) => string;
}