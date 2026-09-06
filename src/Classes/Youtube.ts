import {
	BaseExtractor,
	type ExtractorInfo,
	type ExtractorSearchContext,
	type ExtractorStreamable,
	QueryType,
	type SearchQueryType,
	type Track,
} from "discord-player";
import type { YoutubeOptions } from "../types";
import type Innertube from "youtubei.js";
import { getInnertube, getPlaylistId, getVideoId, isUrl } from "../utils";
import {
	getMixedPlaylist,
	getPlaylist,
	getVideo,
	runWithSearchContext,
	search,
} from "../internal";
import { createStreamFunction } from "../Streams";
import { isYoutubeDlInstalled } from "../Streams/YoutubeDLStream";
import { ytdlDebugger } from "simple-ytdl-core";
import type { Readable } from "node:stream";

export class YoutubeExtractor extends BaseExtractor<YoutubeOptions> {
	public static identifier: string =
		"com.retrouser955.discord-player.discord-player-youtubei";
	public innertube: Innertube | null = null;
	private _stream: (
		track: Track<unknown>,
	) => Promise<Readable | string> | null = null;
	private interval: NodeJS.Timeout | undefined;

	public async activate(): Promise<void> {
		ytdlDebugger.onDebug((text) => {
			this.context.player.debug.bind(this.context.player)(text);
		});
		if (!this.options) this.options = {};
		if (!this.options.downloads) this.options.downloads = {};
		if (!this.options.downloads.trialOrder)
			this.options.downloads.trialOrder = [
				"peer",
				"adaptive",
				"sabr",
				"yt-dlp",
			];

		if (!Array.isArray(this.options.downloads.trialOrder))
			throw new Error(
				"Invalid trial order for downloads. Expected an array of strings.",
			);
		if (this.options.downloads.trialOrder.length === 0)
			throw new Error("Trial order for downloads cannot be empty.");
		if (
			new Set(this.options.downloads.trialOrder).size !==
			this.options.downloads.trialOrder.length
		)
			throw new Error(
				"Trial order for downloads cannot contain duplicate values.",
			);

		this.innertube = await getInnertube(this.options);

		this.protocols = ["yt", "youtube"];
		const fn = this.options.createStream;
		if (typeof fn === "function")
			this._stream = (q: Track) => {
				return fn(q, this);
			};
		else this._stream = createStreamFunction(this);

		const isYtdlInstalled = await isYoutubeDlInstalled();

		if (isYtdlInstalled) {
			this.context.player.debug(
				"[YouTube]: yt-dlp installation detected. Starting cron job to update it weekly.",
			);

			const updateDl = async () => {
				async () => {
					const dl = await import("youtube-dl-exec");

					this.context.player.debug("[YouTube]: Updating youtube-dl");
					await dl.update();
					this.context.player.debug("[YouTube]: Updated youtube-dl");
				};
			};

			await updateDl();

			this.interval = setInterval(
				updateDl.bind(this),
				6.048e8 /* 1 week */,
			).unref();
		}
	}

	public async deactivate(): Promise<void> {
		this.innertube = null;
		this._stream = null;

		if (this.interval) clearInterval(this.interval);
	}

	public async validate(
		query: string,
		_type?: SearchQueryType | null,
	): Promise<boolean> {
		if (typeof query !== "string") return false;
		return true;
	}

	public async handle(
		query: string,
		context: ExtractorSearchContext,
	): Promise<ExtractorInfo> {
		if (
			context.type !== QueryType.YOUTUBE_PLAYLIST &&
			context.type !== QueryType.YOUTUBE_VIDEO
		) {
			try {
				if (isUrl(query)) {
					context.type = QueryType.YOUTUBE_VIDEO;
					const queryUrl = new URL(query);
					if (queryUrl.searchParams.has("list"))
						context.type = QueryType.YOUTUBE_PLAYLIST;
				}
			} catch (error) {
				this.context.player.debug(`Error determining context type: ${error}`);
				throw error;
			}
		}

		return runWithSearchContext(context, async () => {
			switch (context.type) {
				case QueryType.YOUTUBE_PLAYLIST: {
					const playlistId = getPlaylistId(query);

					if (!playlistId.playlistId) {
						this.context.player.debug(
							`Invalid Playlist ID { playlist: ${query} }.`,
						);
						return this.createResponse(null, []);
					}

					if (playlistId.isMix && playlistId.videoId) {
						const pl = await getMixedPlaylist(
							playlistId.playlistId,
							playlistId.videoId,
							this,
						);
						return this.createResponse(pl, pl.tracks);
					}

					const pl = await getPlaylist(playlistId.playlistId, this);
					return this.createResponse(pl, pl.tracks);
				}
				case QueryType.YOUTUBE_VIDEO: {
					return this.createResponse(null, [
						await getVideo(getVideoId(query), this),
					]);
				}
				default: {
					return this.createResponse(null, await search(query, this));
				}
			}
		});
	}

	async bridge(track: Track): Promise<ExtractorStreamable | null> {
		const results = await runWithSearchContext(
			{ requestedBy: track.requestedBy, type: QueryType.YOUTUBE_SEARCH },
			() => search(this.createBridgeQuery(track), this),
		);
		const bridgedTrack = results[0];

		return bridgedTrack ? this.stream(bridgedTrack) : null;
	}

	async stream(info: Track): Promise<ExtractorStreamable> {
		return this._stream(info);
	}
}
