/**
 * Now you might be questioning some programming choices used here.
 * But, I originally planned to make this a remote module.
 * Basically, user would download this at runtime and integrate it into the extractor.
 * But, I realized that it would be unsafe because I don't like the idea of remote code execution.
 */
import type { Track } from "discord-player";
import type { Readable } from "node:stream";
import { createSabrStream } from "./ServerAbrStream";
import { createJsonLikeDebug, getVideoId } from "./common";
import { createYoutubeDlStream, YtDLPError, YTDLPErrorType } from "./YoutubeDLStream";
import { downloadPeer } from "./PeerStream";
import { type YoutubeExtractor } from "../Classes";
import { createAdaptiveStream } from "./AdaptiveStream";
import { TrialItem } from "../types";

const VIDEO_STREAMER_MAP: Record<TrialItem, (info: Track, ext: YoutubeExtractor) => Promise<Readable>> = {
    "adaptive": async (info, ext) => {
        ext.context.player.debug("[YouTube]: Attempting to stream adaptive from YouTube ...")
        const stream = await createAdaptiveStream(info, ext.context.player.debug.bind(ext.context.player));
        ext.context.player.debug("[YouTube]: Adaptive stream extraction successful.")
        return stream;
    },
    "peer": async (info, ext) => {
        if (ext.options.peer?.length > 0) {
            ext.context.player.debug("[YouTube]: Peers detected. Trying peer streaming ...")
            const peer = ext.options.peer[Math.floor(Math.random() * ext.options.peer.length)];
            const url = peer.parseUrl(getVideoId(info.url));
            const headers = typeof peer.headers === "function" ? await peer.headers(url) : peer.headers;

            ext.context.player.debug(`[YouTube]: Attempting to stream from peer { url: ${url} } ...`)
            const stream = downloadPeer(url, headers);
            ext.context.player.debug("[YouTube]: Stream extraction from peer successful.")

            return stream
        } else throw new Error("No peers configured.")
    },
    "sabr": async (info, ext) => {
        ext.context.player.debug("[YouTube]: Attempting to stream with server-abr.");
        const stream = await createSabrStream(info);
        return stream;
    },
    "yt-dlp": async (info, ext) => {
        try {
            ext.context.player.debug("[YouTube]: Attempting to stream with yt-dlp if installed ...")
            const stream = createYoutubeDlStream(info, ext);
            return stream;
        } catch (error) {
            if (error instanceof YtDLPError && error.type === YTDLPErrorType.NOT_INSTALLED) {
                ext.context.player.debug("[YouTube]: yt-dlp is not installed. Skipping.")
            } else throw error;
        }
    }
} as const;

type VideoStreamerFunction = (videoInfo: Track) => Promise<Readable>;
export type Tried = "yt-dlp" | "adaptive" | "sabr" | "peer";

export function createStreamFunction(
    extractor: YoutubeExtractor
): VideoStreamerFunction {
    const { options } = extractor;

    return async (info) => {
        for (const method of options.downloads.trialOrder!) {
            const streamFunc = VIDEO_STREAMER_MAP[method];

            try {
                const stream = await streamFunc(info, extractor);
                return stream;
            } catch (error) {
                extractor.context.player.debug("[YouTube]: Stream extraction of " + createJsonLikeDebug(info) + " failed with the method " + method);
                extractor.context.player.debug(error);
            }
        }
    }
}