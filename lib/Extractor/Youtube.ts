import type {
	ExtractorStreamable,
	SearchQueryType,
	ExtractorInfo,
	ExtractorSearchContext,
	GuildQueueHistory,
} from "discord-player";

import {
	Util,
	Track,
	Playlist,
	QueryType,
	BaseExtractor
} from "discord-player"

import Innertube, {
	type InnertubeConfig,
	type InnerTubeClient,
	Session
} from "youtubei.js";
import { type DownloadOptions } from "youtubei.js/dist/src/types";
import { Readable } from "node:stream";
import { YouTubeExtractor } from "@discord-player/extractor";
import type {
	PlaylistVideo,
	CompactVideo,
	Video
} from "youtubei.js/dist/src/parser/nodes";
import { streamFromYT } from "../common/generateYTStream";
import { AsyncLocalStorage } from "node:async_hooks";
import { tokenToObject } from "../common/tokenUtils";
import { createReadableFromWeb } from "../common/webToReadable";
import { type GeneratorReturnData } from "../utils";

export interface StreamOptions {
	useClient?: InnerTubeClient
	highWaterMark?: number
}

export interface RefreshInnertubeOptions {
	filePath: string;
	interval?: number;
}

export type TrustedTokenConfig = GeneratorReturnData 

export interface YoutubeiOptions {
	authentication?: string;
	overrideDownloadOptions?: DownloadOptions;
	createStream?: (q: Track, extractor: BaseExtractor<object>) => Promise<string | Readable>;
	signOutOnDeactive?: boolean;
	streamOptions?: StreamOptions;
	overrideBridgeMode?: "ytmusic" | "yt";
	disablePlayer?: boolean;
	ignoreSignInErrors?: boolean;
	innertubeConfigRaw?: InnertubeConfig;
	trustedTokens?: TrustedTokenConfig;
	cookie?: string;
}

export interface AsyncTrackingContext {
	useClient: InnerTubeClient
	highWaterMark?: number
}

export class YoutubeiExtractor extends BaseExtractor<YoutubeiOptions> {
	public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";
	public innerTube!: Innertube;
	public _stream!: (q: Track, extractor: BaseExtractor<object>) => Promise<ExtractorStreamable>;
	public static instance?: YoutubeiExtractor;
	public priority = 2;
	static ytContext = new AsyncLocalStorage<AsyncTrackingContext>()

	setTrustedTokens(tokens: TrustedTokenConfig) {
		if(!this.options.streamOptions?.useClient || (["ANDROID", "IOS"] as InnerTubeClient[]).includes(this.options.streamOptions.useClient)) process.emitWarning("Warning: Using poTokens and default \"ANDROID\" client which are not compatible")

		this.innerTube.session.context.client.visitorData = tokens.visitorData

		const clonedInnertube = new Session(
			this.innerTube.session.context,
			this.innerTube.session.key,
			this.innerTube.session.api_version,
			this.innerTube.session.account_index,
			this.innerTube.session.player,
			undefined,
			this.innerTube.session.http.fetch,
			this.innerTube.session.cache,
			tokens.poToken
		)

		this.innerTube = new Innertube(clonedInnertube)
	}

	setInnertube(tube: Innertube) {
		this.innerTube = tube
	}

	static getInstance() {
		return this.instance
	}

	setClientMode(client: InnerTubeClient) {
		if(!this.options.streamOptions) this.options.streamOptions = {}

		this.options.streamOptions.useClient = client
	}

	static getStreamingContext() {
		const ctx = YoutubeiExtractor.ytContext.getStore()
		if (!ctx) throw new Error("INVALID INVOKCATION")
		return ctx
	}

	async activate(): Promise<void> {
		this.protocols = ["ytsearch", "youtube"];

		if(this.options.trustedTokens && !this.options.streamOptions?.useClient) process.emitWarning("Warning: Using poTokens and default \"ANDROID\" client which are not compatible")

		const INNERTUBE_OPTIONS: InnertubeConfig = {
			retrieve_player: this.options.disablePlayer === true ? false : true,
			...(this.options.innertubeConfigRaw),
			cookie: this.options.cookie
		}

		if(this.options.trustedTokens) {
			INNERTUBE_OPTIONS.po_token = this.options.trustedTokens.poToken
			INNERTUBE_OPTIONS.visitor_data = this.options.trustedTokens.visitorData
		}

		this.innerTube = await Innertube.create(INNERTUBE_OPTIONS)

		if (typeof this.options.createStream === "function") {
			this._stream = this.options.createStream;
		} else {
			this._stream = (q, _) => {
				return YoutubeiExtractor.ytContext.run({
					useClient: this.options.streamOptions?.useClient ?? "ANDROID",
					highWaterMark: this.options.streamOptions?.highWaterMark
				}, async () => {
					return streamFromYT(q, this.innerTube, {
						overrideDownloadOptions: this.options.overrideDownloadOptions,
					});
				})
			};
		}

		YoutubeiExtractor.instance = this;

		if (this.options.authentication) {
			try {
				await this.signIn(this.options.authentication)

				const info = await this.innerTube.account.getInfo()

				this.context.player.debug(info.contents?.contents ? `Signed into YouTube using the name: ${info.contents.contents[0]?.account_name?.text ?? "UNKNOWN ACCOUNT"}` : `Signed into YouTube using the client name: ${this.innerTube.session.client_name}@${this.innerTube.session.client_version}`)
			} catch (error) {
				if(this.options.ignoreSignInErrors) process.emitWarning(`Unable to sign into YouTube\n\n${error}`);
				else throw error
			}
		}
	}

	async signIn(tokens: string) {
		const tkn = tokenToObject(tokens)
		await this.innerTube.session.signIn(tkn)
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

	async bridge(track: Track, ext: BaseExtractor | null): Promise<ExtractorStreamable | null> {
		if(ext?.identifier === this.identifier) return this.stream(track)

		let protocol: YoutubeiOptions['overrideBridgeMode']

		if (this.options.overrideBridgeMode) {
			protocol = this.options.overrideBridgeMode
		} else {
			if (this.innerTube.session.logged_in) protocol = "ytmusic"
			else protocol = "yt"
		}

		const query = ext?.createBridgeQuery(track) || `${track.author} - ${track.title}${protocol === "yt" ? " (official audio)" : ""}`

		switch (protocol) {
			case "ytmusic": {
				try {
					let stream = await this.bridgeFromYTMusic(query, track)

					if(!stream) {
						this.context.player.debug("Unable to bridge from Youtube music. Falling back to default behavior")
						stream = await this.bridgeFromYT(query, track)
					}

					return stream
				} catch (error) {
					this.context.player.debug("Unable to bridge from youtube music due to an error. Falling back to default behavior\n\n" + error)
					const stream = await this.bridgeFromYT(query, track)
					return stream
				}
			}
			default: {
				const stream = await this.bridgeFromYT(query, track)

				return stream
			}
		}
	}

	async bridgeFromYTMusic(query: string, track: Track): Promise<ExtractorStreamable | null> {
		const musicSearch = await this.innerTube.music.search(query, {
			type: "song",
		})

		if (!musicSearch.songs) return null
		if (!musicSearch.songs.contents || musicSearch.songs.contents.length === 0) return null
		if (!musicSearch.songs.contents[0].id) return null

		const info = await this.innerTube.music.getInfo(musicSearch.songs.contents[0].id)

		const metadata = new Track(this.context.player, {
			title: info.basic_info.title ?? "UNKNOWN TITLE",
			duration: Util.buildTimeCode(Util.parseMS((info.basic_info.duration || 0) * 1000)),
			author: info.basic_info.author ?? "UNKNOWN AUTHOR",
			views: info.basic_info.view_count,
			thumbnail: info.basic_info.thumbnail?.at(0)?.url,
			url: `https://youtube.com/watch?v=${info.basic_info.id}&dpymeta=ytmusic`,
			source: "youtube",
			queryType: "youtubeVideo",
			live: false
		})

		track.setMetadata(metadata)

		const webStream = await info.download({
			type: "audio",
			quality: "best",
			format: "mp4"
		})

		return createReadableFromWeb(webStream, this.options.streamOptions?.highWaterMark)
	}

	async bridgeFromYT(query: string, track: Track): Promise<ExtractorStreamable | null> {
		const youtubeTrack = await this.handle(query, {
			type: QueryType.YOUTUBE_SEARCH,
			requestedBy: track.requestedBy
		})

		if (youtubeTrack.tracks.length === 0) return null

		track.setMetadata({
			bridge: youtubeTrack.tracks[0]
		})

		return this.stream(youtubeTrack.tracks[0])
	}

	async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
		if (context.protocol === "ytsearch") context.type = QueryType.YOUTUBE_SEARCH;
		query = query.includes("youtube.com") ? query.replace(/(m(usic)?|gaming)\./, "") : query;
		if (!query.includes("list=RD") && YouTubeExtractor.validateURL(query)) context.type = QueryType.YOUTUBE_VIDEO;

		if (context.type === QueryType.YOUTUBE_PLAYLIST) {
			const url = new URL(query)

			if (url.searchParams.has("v") && url.searchParams.has("list")) context.type = QueryType.YOUTUBE_VIDEO
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
					(v) => {
						const duration = Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000))
						const raw = {
							duration_ms: v.duration.seconds * 1000,
							live: v.is_live,
							duration
						}

						return new Track(this.context.player, {
							title: v.title.text ?? "UNKNOWN TITLE",
							duration: duration,
							thumbnail: v.thumbnails[0]?.url,
							author: v.author.name,
							requestedBy: context.requestedBy,
							url: `https://youtube.com/watch?v=${v.id}`,
							raw,
							playlist: pl,
							source: "youtube",
							queryType: "youtubeVideo",
							async requestMetadata() {
								return this.raw;
							},
							metadata: raw,
							live: v.is_live
						})
					}
				)

				while (playlist.has_continuation) {
					playlist = await playlist.getContinuation()

					plTracks.push(...(playlist.videos.filter((v) => v.type === "PlaylistVideo") as PlaylistVideo[]).map(
						(v) => {
							const duration = Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000))
							const raw = {
								duration_ms: v.duration.seconds * 1000,
								live: v.is_live,
								duration
							}

							return new Track(this.context.player, {
								title: v.title.text ?? "UNKNOWN TITLE",
								duration,
								thumbnail: v.thumbnails[0]?.url,
								author: v.author.name,
								requestedBy: context.requestedBy,
								url: `https://youtube.com/watch?v=${v.id}`,
								raw,
								playlist: pl,
								source: "youtube",
								queryType: "youtubeVideo",
								async requestMetadata() {
									return this.raw;
								},
								metadata: raw,
								live: v.is_live
							})
						}
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
				if (!videoId) videoId = query.split("/").at(-1)!.split("?")[0]

				const vid = await this.innerTube.getBasicInfo(videoId);
				const duration = Util.buildTimeCode(Util.parseMS((vid.basic_info.duration ?? 0) * 1000))

				const uploadTime = vid.basic_info.start_timestamp

				const raw = {
					duration_ms: vid.basic_info.duration as number * 1000,
					live: vid.basic_info.is_live,
					duration,
					startTime: uploadTime
				}

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
							duration,
							raw,
							source: "youtube",
							queryType: "youtubeVideo",
							async requestMetadata() {
								return this.raw;
							},
							metadata: raw,
							live: vid.basic_info.is_live
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
		const duration = Util.buildTimeCode(Util.parseMS(vid.duration.seconds * 1000))

		const raw = {
			duration_ms: vid.duration.seconds * 1000,
			live: vid.is_live
		}

		const track = new Track(this.context.player, {
			title: vid.title.text ?? "UNKNOWN YOUTUBE VIDEO",
			thumbnail: vid.best_thumbnail?.url ?? vid.thumbnails[0]?.url ?? "",
			description: vid.description ?? vid.title ?? "UNKNOWN DESCRIPTION",
			author: vid.author?.name ?? "UNKNOWN AUTHOR",
			requestedBy: context.requestedBy,
			url: `https://youtube.com/watch?v=${vid.id}`,
			views: parseInt((vid.view_count?.text ?? "0").replaceAll(",", "")),
			duration,
			raw,
			playlist: pl,
			source: "youtube",
			queryType: "youtubeVideo",
			async requestMetadata() {
				return this.raw;
			},
			metadata: raw,
			live: vid.is_live
		});

		track.extractor = this;

		return track;
	}

	stream(info: Track<unknown>): Promise<ExtractorStreamable> {
		return this._stream(info, this);
	}

	async getRelatedTracks(
		track: Track<{ duration_ms: number, live: boolean }>,
		history: GuildQueueHistory<unknown>
	): Promise<ExtractorInfo> {
		let id = new URL(track.url).searchParams.get("v")
		// VIDEO DETECTED AS YT SHORTS OR youtu.be link
		if (!id) id = track.url.split("/").at(-1)?.split("?").at(0)!

		const videoInfo = await this.innerTube.getInfo(id)

		const next = videoInfo.watch_next_feed!

		const recommended = (next as unknown as CompactVideo[]).filter(
			(v) => !history.tracks.some((x) => x.url === `https://youtube.com/watch?v=${v.id}`) && v.type === "CompactVideo"
		)

		if (!recommended) {
			this.context.player.debug("Unable to fetch recommendations");
			return this.#emptyResponse();
		}

		const trackConstruct = recommended.map((v) => {
			const duration = Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000))
			const raw = {
				live: v.is_live,
				duration_ms: v.duration.seconds * 1000,
				duration,
			}

			return new Track(this.context.player, {
				title: v.title?.text ?? "UNKNOWN TITLE",
				thumbnail: v.best_thumbnail?.url ?? v.thumbnails[0]?.url,
				author: v.author?.name ?? "UNKNOWN AUTHOR",
				requestedBy: track.requestedBy,
				url: `https://youtube.com/watch?v=${v.id}`,
				views: parseInt((v.view_count?.text ?? "0").replaceAll(",", "")),
				duration,
				raw,
				source: "youtube",
				queryType: "youtubeVideo",
				metadata: raw,
				async requestMetadata() {
					return this.raw;
				},
				live: v.is_live
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
