import type { Types } from "youtubei.js"
import type { Track } from "discord-player";
import type { Readable } from "node:stream";
import type { YoutubeExtractor } from "../Classes";
import type { ProxyAgent } from "undici";

export interface streamOptions {
    highWaterMark?: number;
    client?: Types.InnerTubeClient | ((track: Track) => Types.InnerTubeClient);
}

export interface YoutubeDlOptions {
    cookiePath?: string;
}

export type TrialItem = "peer" | "adaptive" | "sabr" | "yt-dlp";

export interface YoutubeOptions {
    createStream?: (q: Track, ext: YoutubeExtractor) => Promise<string|Readable>;
    disablePlayer?: boolean;
    cookie?: string;
    proxy?: ProxyAgent;
    peer?: PeerOptions[];
    downloads?: {
        trialOrder?: TrialItem[];
        ytdlp?: YoutubeDlOptions;
    }
}

export interface InitOptions {
    forceRefresh?: boolean;
}

export interface minterResult {
    generatePlaceholder?: (binding: string) => string;
    mint?: (binding: string) => Promise<string>;
}

export interface PlaylistObj {
    playlistId: string;
    videoId?: string;
    isMix?: boolean;
}

export interface PeerOptions {
    parseUrl: (youtubeId: string) => string;
    headers?: HeadersInit | ((parsedUrl: string) => HeadersInit | Promise<HeadersInit>)
}