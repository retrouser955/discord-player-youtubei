import {
	BaseExtractor,
	type ExtractorInfo,
	type ExtractorSearchContext,
	type ExtractorStreamable,
	type GuildQueueHistory,
	QueryType,
	type SearchQueryType,
	Track,
} from "discord-player";
import type { YoutubeOptions } from "../types";
import type Innertube from "youtubei.js";
import { buildVideoUrl, getInnertube, getPlaylistId, getVideoId, isUrl } from "../utils";
import {
	buildTrackFromLockupView,
	buildTrackFromVideo,
	getMixedPlaylist,
	getPlaylist,
	getVideo,
	runWithSearchContext,
	search,
	searchMusic,
} from "../internal";
import { createStreamFunction } from "../Streams";
import { isYoutubeDlInstalled } from "../Streams/YoutubeDLStream";
import { ytdlDebugger } from "simple-ytdl-core";
import type { Readable } from "node:stream";
import { YTNodes } from "youtubei.js";
import { SHELL_YT_TRACK_PRAMS, YOUTUBE_REGEX } from "../Constants";

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
		type?: SearchQueryType | null,
	): Promise<boolean> {
		if (typeof query !== "string" || !query.length) return false;

		if (isUrl(query)) return YOUTUBE_REGEX.test(query);

		return (
			[
				QueryType.AUTO,
				QueryType.AUTO_SEARCH,
				QueryType.ARBITRARY,
			] as SearchQueryType[]
		).some((t) => t === type);
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

	private async bridgeYt(query: string, track: Track): Promise<ExtractorStreamable | null> {
		const results = await runWithSearchContext(
			{ requestedBy: track.requestedBy, type: QueryType.YOUTUBE_SEARCH },
			() => search(query, this),
		);
		const bridgedTrack = results[0];

		return bridgedTrack ? this.stream(bridgedTrack) : null;
	}

	async bridge(track: Track): Promise<ExtractorStreamable | null> {
		const query = typeof this.options.bridge?.createQuery === "function" ?
			this.options.bridge.createQuery(track) : this.createBridgeQuery(track);

		if (!this.options.bridge?.from || this.options.bridge.from === "youtube") {
			return this.bridgeYt(query, track);
		} else {
			try {
				const results = await searchMusic(query);

				const bridgedTrack = results.at(0);

				if (!bridgedTrack || !bridgedTrack.id) return null;

				// make a shell track only the extractor need to stream
				const bridge = new Track(this.context.player, {
					url: buildVideoUrl(bridgedTrack.id),
					title: SHELL_YT_TRACK_PRAMS,
					author: SHELL_YT_TRACK_PRAMS,
					thumbnail: SHELL_YT_TRACK_PRAMS,
					duration: "1:00",
					requestedBy: track.requestedBy,
					source: "youtube",
					queryType: QueryType.YOUTUBE_VIDEO,
					live: false
				});

				return this.stream(bridge);
			} catch (error) {
				this.debug("Unable to bridge the track from YouTube Music. Falling back to default behavior");
				this.debug(error);
				return this.bridgeYt(query, track);
			}
		}
	}

	async getRelatedTracks(
	  track: Track,
	  history: GuildQueueHistory,
	): Promise<ExtractorInfo> {
	  const info = await this.innertube.getInfo(getVideoId(track.url));
	  const feed = info.watch_next_feed;
	
	  if (!feed?.length) return this.createResponse();
	
	  const seen = new Set(
	    history.tracks.toArray().flatMap((item) => {
	      try {
	        return [getVideoId(item.url)];
	      } catch {
	        return [];
	      }
	    }),
	  );
	
	  return runWithSearchContext(
	    {
	      requestedBy: track.requestedBy,
	      type: QueryType.YOUTUBE_VIDEO,
	    },
	    async () => {
	      const tracks = feed.flatMap((item) => {
	        if (item.is(YTNodes.CompactVideo)) {
	          if (seen.has(item.video_id)) return [];
	          return [buildTrackFromVideo(item, this)];
	        }
	
	        if (
	          item.is(YTNodes.LockupView) &&
	          item.content_type === "VIDEO" &&
	          item.content_id
	        ) {
	          if (seen.has(item.content_id)) return [];
	          return [buildTrackFromLockupView(item, this)];
	        }
	
	        return [];
	      });
	
	      return this.createResponse(null, tracks);
	    },
	  );
	}

	async stream(info: Track): Promise<ExtractorStreamable> {
		return this._stream(info);
	}
}
