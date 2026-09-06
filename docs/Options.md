# Options

These are the options for each YouTube extractor.

```ts
// this is from simple-ytdl-core
export type ClientList = { client: Types.InnerTubeClient, requirePoToken: boolean, requireDecipher: boolean }[];

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
}

export interface YoutubeDlOptions {
	cookiePath?: string;
}

export interface PeerOptions {
	parseUrl: (youtubeId: string) => string;
	headers?:
		| HeadersInit
		| ((parsedUrl: string) => HeadersInit | Promise<HeadersInit>);
}
```

- Take a look at [PeerStreaming](./PeerStreaming.md) for more information on streaming from peers.
- Take a look at [YTDLP](./YTDLP.md) for more information on using yt-dlp to stream.