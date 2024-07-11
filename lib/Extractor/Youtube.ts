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
import Innertube, { type OAuth2Tokens } from "youtubei.js";
import { type DownloadOptions } from "youtubei.js/dist/src/types";
import { Readable } from "node:stream";
import { YouTubeExtractor, YoutubeExtractor } from "@discord-player/extractor";
import type { PlaylistVideo, CompactVideo, Video } from "youtubei.js/dist/src/parser/nodes";
import { type VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import { streamFromYT } from "../common/generateYTStream";
import { createInnertubeClient } from "../common/createInnertubeClient";

export interface YoutubeiOptions {
	authentication?: OAuth2Tokens;
	overrideDownloadOptions?: DownloadOptions;
	createStream?: (q: Track, extractor: BaseExtractor<object>) => Promise<string | Readable>;
	signOutOnDeactive?: boolean;
}

export class YoutubeiExtractor extends BaseExtractor<YoutubeiOptions> {
	public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";
	public innerTube!: Innertube;
	public _stream!: (q: Track, extractor: BaseExtractor<object>) => Promise<ExtractorStreamable>;
	public static instance?: YoutubeiExtractor;
	public priority = 2;

	async activate(): Promise<void> {
		this.protocols = ["ytsearch", "youtube"];

		this.innerTube = await createInnertubeClient(this.context.player);

		if (this.options.authentication) {
			try {
				await this.innerTube.session.signIn(this.options.authentication);
				this.context.player.debug(
					`Signed into YouTube TV API using client name: ${this.innerTube.session.client_name}`
				);
			} catch (error) {
				this.context.player.debug(`Unable to sign into Innertube:\n\n${error}`);
			}
		}

		if (typeof this.options.createStream === "function") {
			this._stream = this.options.createStream;
		} else {
			this._stream = (q, _) => {
				return streamFromYT(q, this.innerTube, {
					overrideDownloadOptions: this.options.overrideDownloadOptions,
				});
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

		switch (context.type) {
			case QueryType.YOUTUBE_PLAYLIST: {
				const playlistUrl = new URL(query);
				const plId = playlistUrl.searchParams.get("list")!;
				const playlist = await this.innerTube.getPlaylist(plId);

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
					rawPlaylist: playlist,
					source: "youtube",
				});

				pl.tracks = (playlist.videos.filter((v) => v.type === "PlaylistVideo") as PlaylistVideo[]).map(
					(v) =>
						new Track(this.context.player, {
							title: v.title.text ?? "UNKNOWN TITLE",
							duration: Util.buildTimeCode(Util.parseMS(v.duration.seconds * 1000)),
							thumbnail: v.thumbnails[0]?.url,
							author: v.author.name,
							requestedBy: context.requestedBy,
							url: `https://youtube.com/watch?v=${v.id}`,
							raw: v,
							source: "youtube",
							queryType: "youtubeVideo",
							metadata: v,
							async requestMetadata() {
								return v;
							},
						})
				);

				return {
					playlist: pl,
					tracks: pl.tracks,
				};
			}
			case QueryType.YOUTUBE_VIDEO: {
				const videoId = new URL(query).searchParams.get("v")!;
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
							raw: vid,
							source: "youtube",
							queryType: "youtubeVideo",
							metadata: vid,
							async requestMetadata() {
								return vid;
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
			raw: vid,
			playlist: pl,
			source: "youtube",
			queryType: "youtubeVideo",
			metadata: vid,
			async requestMetadata() {
				return vid;
			},
		});

		track.extractor = this;

		return track;
	}

	stream(info: Track<unknown>): Promise<ExtractorStreamable> {
		return this._stream(info, this);
	}

	async getRelatedTracks(
		track: Track<VideoInfo | Video | CompactVideo>,
		history: GuildQueueHistory<unknown>
	): Promise<ExtractorInfo> {
		if (!YoutubeExtractor.validateURL(track.url)) return this.#emptyResponse();

		const video = await track.requestMetadata();

		if (!video) {
			this.context.player.debug("UNEXPECTED! VIDEO METADATA WAS NOT FOUND. HAVE YOU BEEN TEMPERING?");

			return {
				playlist: null,
				tracks: [],
			};
		}

		// @ts-expect-error
		const isVidInfo = typeof video?.getWatchNextContinuation === "function";
		const rawVideo = isVidInfo
			? (video as VideoInfo)
			: await this.innerTube.getInfo((video as Video | CompactVideo | PlaylistVideo).id, "ANDROID");

		if (rawVideo.watch_next_feed) {
			this.context.player.debug("Unable to get next video. Falling back to `watch_next_feed`");

			const recommended = (rawVideo.watch_next_feed as unknown as CompactVideo[]).filter(
				(v) => !history.tracks.some((x) => x.url === `https://youtube.com/watch?v=${v.id}`) && v.type === "CompactVideo"
			);

			if (!recommended) {
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
				tracks: trackConstruct,
			};
		}

		this.context.player.debug("Unable to fetch recommendations");
		return this.#emptyResponse();
	}

	#emptyResponse() {
		return {
			playlist: null,
			tracks: [],
		};
	}
}
