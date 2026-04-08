import { Track } from 'discord-player';
import type { JSRuntime } from 'youtube-dl-exec';
import { getVideoId } from './common';
import { YoutubeExtractor } from '../Classes';

// There is no need to detect quickjs since we are running a bot.
export function detectRuntime(): JSRuntime {
    const agent = navigator.userAgent;
    if(agent.startsWith("Bun")) return "bun";
    else if(agent.startsWith("Deno")) return "deno";
    return "node";
}

export async function isYoutubeDlInstalled() {
    try {
        await import('youtube-dl-exec');
        return true;
    } catch {
        return false;
    }
}

export enum YTDLPErrorType {
    NOT_INSTALLED,
    NO_STREAM,
    UNKNOWN
}

export class YtDLPError extends Error {
    constructor(public type: YTDLPErrorType, message: string) {
        super(message)
    }
}

export async function createYoutubeDlStream(track: Track, ext: YoutubeExtractor) {
    if(!await isYoutubeDlInstalled()) throw new YtDLPError(YTDLPErrorType.NOT_INSTALLED, "Youtube-DL is not installed");

    const format = track.live ? "best[height<=360]" : "bestaudio";
    const id = getVideoId(track.url);

    const youtubeDl = (await import("youtube-dl-exec")).default;
    
    const dl = youtubeDl.exec(`https://youtu.be/${id}`, {
        jsRuntimes: detectRuntime(),
        format,
        output: "-",
        noWarnings: true,
        noProgress: true,
        cookies: ext.options.downloads?.ytdlp?.cookiePath,
    })

    dl.catch((e) => {
        throw new YtDLPError(YTDLPErrorType.UNKNOWN, e);
    })

    const stream = dl.stdout;

    if(!stream) throw new YtDLPError(YTDLPErrorType.NO_STREAM, "No streams were detected through yt-dlp.");

    const kill = () => {
        if(!dl.killed) {
            stream.removeAllListeners();
            dl.kill();
        }
        
    };

    stream.on("close", kill);
    stream.on("error", kill);
    stream.on("end", kill);

    return stream;
}