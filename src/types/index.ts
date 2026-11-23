import type { Track } from "discord-player";
import type { Readable } from "node:stream";
import type { YoutubeExtractor } from "../Classes";
import type { ProxyAgent } from "undici";
import type { ClientList } from "simple-ytdl-core";

export interface YoutubeDlOptions {
	cookiePath?: string;
}

export type TrialItem = "adaptive" | "sabr" | "peer" | "yt-dlp";

export interface YoutubeOptions {
	createStream?: (
		q: Track,
		ext: YoutubeExtractor,
	) => Promise<string | Readable>;
	disablePlayer?: boolean;
	/**
	 * Login to YouTube via your cookies to give you less 403s and 429s
	 */
	cookie?: string;
	/**
	 * Proxy requests via another server. See https://undici.nodejs.org/api/ProxyAgent
	 */
	proxy?: ProxyAgent;
	/**
	 * Peer assisted streaming
	 */
	peer?: PeerOptions[];
	downloads?: {
		/**
		 * The order to try downloading items. Must be unique.
		 */
		trialOrder?: TrialItem[];
		/**
		 * Options passed to YTDLP
		 */
		ytdlp?: YoutubeDlOptions;
		adaptiveStream?: {
			/**
			 * Provide a custom client list to try. Useful if YouTube sudden breaks a client.
			 */
			customClientOrder?: ClientList;
		};
	};
	/**
	 * Configure how the YouTube extractor handles bridging
	 */
	bridge?: {
		/**
		 * Create a bridge query
		 * @param track The track to bridge from
		 * @returns the search term the extractor should use
		 */
		createQuery?: (track: Track) => string;
		/**
		 * Bridge from either YT or YT Music
		 */
		from?: "youtube" | "yt-music";
	};
}

export interface PlaylistObj {
	playlistId: string;
	videoId?: string;
	isMix?: boolean;
}

export interface PeerOptions {
	parseUrl: (youtubeId: string) => string;
	headers?:
		| HeadersInit
		| ((parsedUrl: string) => HeadersInit | Promise<HeadersInit>);
}
