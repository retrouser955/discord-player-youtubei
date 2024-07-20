import {
	BaseExtractor,
	ExtractorStreamable,
	Track,
	SearchQueryType,
	QueryType,
	ExtractorInfo,
	ExtractorSearchContext,
	Playlist,
	Util,
	GuildQueueHistory,
} from "discord-player";
import Innertube, { UniversalCache, type InnerTubeClient, type OAuth2Tokens } from "youtubei.js";
import { type DownloadOptions } from "youtubei.js/dist/src/types";
import { Readable } from "node:stream";
import { YouTubeExtractor, YoutubeExtractor } from "@discord-player/extractor";
import type { PlaylistVideo, CompactVideo, Video } from "youtubei.js/dist/src/parser/nodes";
import { type VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import { streamFromYT } from "../common/generateYTStream";
import { AsyncLocalStorage } from "node:async_hooks";
import { tokenToObject } from "../common/tokenUtils";

export interface YoutubeiOptions {
	authentication?: OAuth2Tokens | string;
	overrideDownloadOptions?: DownloadOptions;
	createStream?: (q: Track, extractor: BaseExtractor<object>) => Promise<string | Readable>;
	signOutOnDeactive?: boolean;
	streamOptions?: {
		useClient?: InnerTubeClient
	};
	cache?: {
		cacheDir?: string;
		enableCache?: boolean
	}
}

export interface AsyncTrackingContext {
	useClient: InnerTubeClient
}

export class YoutubeiExtractor extends BaseExtractor<YoutubeiOptions> {
	public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";
	public innerTube!: Innertube;
	public _stream!: (q: Track, extractor: BaseExtractor<object>) => Promise<ExtractorStreamable>;
	public static instance?: YoutubeiExtractor;
	public priority = 2;
	static ytContext = new AsyncLocalStorage<AsyncTrackingContext>()

	static getStreamingContext() {
		const ctx = YoutubeiExtractor.ytContext.getStore()
		if(!ctx) throw new Error("INVALID INVOKCATION")
		return ctx
	}

	async activate(): Promise<void> {
		this.protocols = ["ytsearch", "youtube"];
		const endableCache = this.options.cache?.enableCache

		if(endableCache) process.emitWarning("Default cache is deprecated and will be removed in the 1.2.x", 'DeprecationWarning')

		this.innerTube = await Innertube.create({
			cache: endableCache ? new UniversalCache(true, this.options.cache?.cacheDir || `${__dirname}/.dpy`) : undefined
		})

		if (this.options.authentication) {
			try {
				// this is really stupid but i don't wanna code for the day anymore so
				if(typeof this.options.authentication !== "string") {
					process.emitWarning("Using the raw authentication object is deprecated. Generate the new format using `npx --no generate-dpy-tokens`")
				}
				const tokens = typeof this.options.authentication === "string" ? tokenToObject(this.options.authentication) : this.options.authentication

				await this.innerTube.session.signIn(tokens);

				const info = await this.innerTube.account.getInfo()

				this.context.player.debug(info.contents?.contents ? `Signed into YouTube using the name: ${info.contents.contents[0]?.account_name?.text ?? "UNKNOWN ACCOUNT"}` : `Signed into YouTube using the client name: ${this.innerTube.session.client_name}@${this.innerTube.session.client_version}`)
			} catch (error) {
				this.context.player.debug(`Unable to sign into Innertube:\n\n${error}`);
			}
		}

		if (typeof this.options.createStream === "function") {
			this._stream = this.options.createStream;
		} else {
			this._stream = (q, _) => {
				return YoutubeiExtractor.ytContext.run({
					useClient: this.options.streamOptions?.useClient ?? "WEB"
				}, () => {
					return streamFromYT(q, this.innerTube, {
						overrideDownloadOptions: this.options.overrideDownloadOptions,
					});
				})
			};
		}

		YoutubeiExtractor.instance = this;
	}

	async deactivate(): Promise<void> {
		this.protocols = [];
		if (this.options.signOutOnDeactive && this.innerTube.session.logged_in) await this.innerTube.session.signOut();
	}

	async validate(query: string, type?: SearchQueryType | null | undefined): Promise<boolean> {
		if (typeof query !== "string") return false;
		// prettier-ignore
		return ([
            QueryType.YOUTUBE,
            QueryType.YOUTUBE_PLAYLIST,
            QueryType.YOUTUBE_SEARCH,
            QueryType.YOUTUBE_VIDEO,
            QueryType.AUTO,
            QueryType.AUTO_SEARCH
        ] as SearchQueryType[]).some((r) => r === type);
	}

	async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
		if (context.protocol === "ytsearch") context.type = QueryType.YOUTUBE_SEARCH;
		query = query.includes("youtube.com") ? query.replace(/(m(usic)?|gaming)\./, "") : query;
		if (!query.includes("list=RD") && YouTubeExtractor.validateURL(query)) context.type = QueryType.YOUTUBE_VIDEO;

		if(context.type === QueryType.YOUTUBE_PLAYLIST) {
			const url = new URL(query)

			if(url.searchParams.has("v") && url.searchParams.has("list")) context.type = QueryType.YOUTUBE_VIDEO
		}

		switch (context.type) {
			case QueryType.YOUTUBE_PLAYLIST: {
				const playlistUrl = new URL(query);
				const plId = playlistUrl.searchParams.get("list")!;
				let playlist = await this.innerTube.getPlaylist(plId);

				const pl = new Playlist(this.context.player, {
					title: playlist.info.title ?? "UNKNOWN PLAYLIST",
					thumbnail: playlist.info.thumbnails[0].url,
					description: playlist.info.description ?? playlist.info.title ?? "UNKNOWN DESCRIPTION",
					type: "playlist",
					author: {
						name: playlist?.channels[0]?.author?.name ?? playlist.info.author.name ?? "UNKNOWN AUTHOR",
						url: playlist?.channels[0]?.author?.url ?? playlist.info.author.url ?? "UNKNOWN AUTHOR",
					},
					tracks: [],
					id: plId,
					url: query,
					source: "youtube",
				});

				pl.tracks = []

				let plTracks = (playlist.videos.filter((v) => v.type === "PlaylistVideo") as PlaylistVideo[]).map(
					(v) =>
						new Track(this.context.player, {
							title: v.title.text ?? "UNKNOWN TITLE",
							duration: Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000)),
							thumbnail: v.thumbnails[0]?.url,
							author: v.author.name,
							requestedBy: context.requestedBy,
							url: `https://youtube.com/watch?v=${v.id}`,
							raw: {
								duration_ms: v.duration.seconds * 1000,
								isLive: v.is_live
							},
							playlist: pl,
							source: "youtube",
							queryType: "youtubeVideo",
							async requestMetadata() {
								return this.raw;
							},
						})
				)

				while(playlist.has_continuation) {
					playlist = await playlist.getContinuation()

					plTracks.push(...(playlist.videos.filter((v) => v.type === "PlaylistVideo") as PlaylistVideo[]).map(
						(v) =>
							new Track(this.context.player, {
								title: v.title.text ?? "UNKNOWN TITLE",
								duration: Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000)),
								thumbnail: v.thumbnails[0]?.url,
								author: v.author.name,
								requestedBy: context.requestedBy,
								url: `https://youtube.com/watch?v=${v.id}`,
								raw: {
									duration_ms: v.duration.seconds * 1000,
									isLive: v.is_live
								},
								playlist: pl,
								source: "youtube",
								queryType: "youtubeVideo",
								async requestMetadata() {
									return this.raw;
								},
							})
					))
				}

				pl.tracks = plTracks

				return {
					playlist: pl,
					tracks: pl.tracks,
				};
			}
			case QueryType.YOUTUBE_VIDEO: {
				let videoId = new URL(query).searchParams.get("v");

				// detected as yt shorts or youtu.be link
				if(!videoId) videoId = query.split("/").at(-1)!.split("?")[0]

				const vid = await this.innerTube.getInfo(videoId);

				return {
					playlist: null,
					tracks: [
						new Track(this.context.player, {
							title: vid.basic_info.title ?? "UNKNOWN TITLE",
							thumbnail: vid.basic_info.thumbnail?.at(0)?.url,
							description: vid.basic_info.short_description,
							author: vid.basic_info.channel?.name,
							requestedBy: context.requestedBy,
							url: `https://youtube.com/watch?v=${vid.basic_info.id}`,
							views: vid.basic_info.view_count,
							duration: Util.buildTimeCode(Util.parseMS((vid.basic_info.duration ?? 0) * 1000)),
							raw: {
								duration_ms: vid.basic_info.duration as number * 1000,
								isLive: vid.basic_info.is_live
							},
							source: "youtube",
							queryType: "youtubeVideo",
							async requestMetadata() {
								return this.raw;
							},
						}),
					],
				};
			}
			default: {
				const search = await this.innerTube.search(query);
				const videos = search.videos.filter((v) => v.type === "Video") as Video[];

				return {
					playlist: null,
					tracks: videos.map((v) => this.buildTrack(v, context)),
				};
			}
		}
	}

	buildTrack(vid: Video, context: ExtractorSearchContext, pl?: Playlist) {
		const track = new Track(this.context.player, {
			title: vid.title.text ?? "UNKNOWN YOUTUBE VIDEO",
			thumbnail: vid.best_thumbnail?.url ?? vid.thumbnails[0]?.url ?? "",
			description: vid.description ?? vid.title ?? "UNKNOWN DESCRIPTION",
			author: vid.author?.name ?? "UNKNOWN AUTHOR",
			requestedBy: context.requestedBy,
			url: `https://youtube.com/watch?v=${vid.id}`,
			views: parseInt(vid.view_count?.text ?? "0"),
			duration: Util.buildTimeCode(Util.parseMS(vid.duration.seconds * 1000)),
			raw: {
				duration_ms: vid.duration.seconds * 1000,
				isLive: vid.is_live
			},
			playlist: pl,
			source: "youtube",
			queryType: "youtubeVideo",
			async requestMetadata() {
				return this.raw;
			},
		});

		track.extractor = this;

		return track;
	}

	stream(info: Track<unknown>): Promise<ExtractorStreamable> {
		return this._stream(info, this);
	}

	async getRelatedTracks(
		track: Track<{ duration_ms: number, isLive: boolean }>,
		history: GuildQueueHistory<unknown>
	): Promise<ExtractorInfo> {
		let id = new URL(track.url).searchParams.get("v")
		// VIDEO DETECTED AS YT SHORTS OR youtu.be link
		if(!id) id = track.url.split("/").at(-1)?.split("?").at(0)!
		const videoInfo = await this.innerTube.getInfo(id)

		const next = videoInfo.watch_next_feed!

		const recommended = (next as unknown as CompactVideo[]).filter(
			(v) => !history.tracks.some((x) => x.url === `https://youtube.com/watch?v=${v.id}`) && v.type === "CompactVideo"
		)

		if(!recommended) {
			this.context.player.debug("Unable to fetch recommendations");
			return this.#emptyResponse();
		}

		const trackConstruct = recommended.map((v) => {
			return new Track(this.context.player, {
				title: v.title?.text ?? "UNKNOWN TITLE",
				thumbnail: v.best_thumbnail?.url ?? v.thumbnails[0]?.url,
				author: v.author?.name ?? "UNKNOWN AUTHOR",
				requestedBy: track.requestedBy,
				url: `https://youtube.com/watch?v=${v.id}`,
				views: parseInt(v.view_count?.text ?? "0"),
				duration: Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000)),
				raw: v,
				source: "youtube",
				queryType: "youtubeVideo",
				metadata: v,
				async requestMetadata() {
					return v;
				},
			});
		});

		return {
			playlist: null,
			tracks: trackConstruct
		}
	}

	#emptyResponse() {
		return {
			playlist: null,
			tracks: [],
		};
	}
}
