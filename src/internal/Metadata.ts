import type Innertube from "youtubei.js";
import { type Helpers, type YT, YTNodes } from "youtubei.js";
import type { YoutubeExtractor } from "../Classes";
import {
	buildPlaylistUrl,
	buildVideoUrl,
	getInnertube,
	assertNever,
} from "../utils";
import { Playlist, QueryType, Track, Util } from "discord-player";
import { getSearchContext } from "./ContextProvider";
import { YOUTUBE_LOGO } from "../Constants";

export type TrackLikeNode =
	| YTNodes.Video
	| YTNodes.PlaylistVideo
	| (YTNodes.LockupView & { content_type: "VIDEO" });

export function isTrackLikeNode(node: Helpers.YTNode): node is TrackLikeNode {
	return (
		node.is(YTNodes.Video) ||
		node.is(YTNodes.PlaylistVideo) ||
		(node.is(YTNodes.LockupView) && node.content_type === "VIDEO")
	);
}

export function buildTracks(
	nodes: Helpers.YTNode[],
	ext: YoutubeExtractor,
	pl?: Playlist,
): Track[] {
	return nodes.filter(isTrackLikeNode).map((vid) => {
		const track = buildTrackFromTrackLikeNode(vid, ext);
		return pl ? enrichTrackWithPlaylistData(track, pl) : track;
	});
}

export function buildTrackFromTrackLikeNode(
	vid: TrackLikeNode,
	ext: YoutubeExtractor,
): Track {
	if (vid.is(YTNodes.Video)) {
		return buildTrackFromVideo(vid, ext);
	} else if (vid.is(YTNodes.PlaylistVideo)) {
		return buildTrackFromPlaylistVideo(vid, ext);
	} else if (vid.is(YTNodes.LockupView)) {
		return buildTrackFromLockupView(vid, ext);
	}
	assertNever(vid);
}

export function buildTrackFromVideo(
	vid: YTNodes.Video,
	ext: YoutubeExtractor,
): Track {
	return new Track(ext.context.player, {
		title: vid.title.toString() ?? "UNKNOWN TITLE",
		url: buildVideoUrl(vid.video_id),
		duration: Util.buildTimeCode(
			Util.parseMS((vid.duration?.seconds ?? 0) * 1000),
		),
		thumbnail: vid.thumbnails[0]?.url,
		author: vid.author.name ?? "UNKNOWN AUTHOR",
		requestedBy: getSearchContext().requestedBy,
		source: "youtube",
		queryType: QueryType.YOUTUBE_VIDEO,
		live: vid.is_live,
		description: vid.description.toString() || "",
	});
}

export function buildTrackFromPlaylistVideo(
	vid: YTNodes.PlaylistVideo,
	ext: YoutubeExtractor,
): Track {
	return new Track(ext.context.player, {
		title: vid.title.text ?? "UNKNOWN TITLE",
		url: buildVideoUrl(vid.id),
		duration: Util.buildTimeCode(
			Util.parseMS((vid.duration?.seconds ?? 0) * 1000),
		),
		thumbnail: vid.thumbnails?.at(0)?.url ?? YOUTUBE_LOGO,
		author: vid.author.name ?? "UNKNOWN AUTHOR",
		requestedBy: getSearchContext().requestedBy,
		source: "youtube",
		queryType: QueryType.YOUTUBE_VIDEO,
		live: vid.is_live,
		async requestMetadata() {
			return this.raw;
		},
	});
}

export function buildTrackFromLockupView(
	vid: YTNodes.LockupView,
	ext: YoutubeExtractor,
): Track {
	if (vid.content_type === "VIDEO") {
		return new Track(ext.context.player, {
			title: vid.metadata?.title?.text ?? "UNKNOWN TITLE",
			url: buildVideoUrl(vid.content_id),
			thumbnail: extractThumbnailFromLockupView(vid) ?? YOUTUBE_LOGO,
			requestedBy: getSearchContext().requestedBy,
			source: "youtube",
			queryType: QueryType.YOUTUBE_VIDEO,
			async requestMetadata() {
				return this.raw;
			},
		});
	}

	throw new Error(
		`Unable to build track from unsupported LockupView type: ${vid.content_type}`,
	);
}

export async function search(term: string, ext: YoutubeExtractor) {
	const tube: Innertube = await getInnertube();
	const searchResult = await tube.search(term);
	return buildTracks(searchResult.videos, ext);
}

export async function getMixedPlaylist(
	playlistId: string,
	videoId: string,
	ext: YoutubeExtractor,
): Promise<Playlist> {
	const tube: Innertube = await getInnertube();

	const endpoint: YTNodes.NavigationEndpoint = new YTNodes.NavigationEndpoint({
		continuationCommand: {
			videoId,
			playlistId,
		},
	});

	const mixVidInfo: YT.VideoInfo = await tube.getInfo(endpoint);
	if (!mixVidInfo?.playlist)
		throw new Error("Mix playlist not found or is invalid.");

	const pl: Playlist = new Playlist(ext.context.player, {
		title: mixVidInfo.playlist.title ?? "UNKOWN PLAYLIST",
		thumbnail: (
			mixVidInfo.playlist.contents?.[0] as unknown as
				| { thumbnail: string }
				| undefined
		)?.thumbnail as string,
		description: "",
		author: {
			name: mixVidInfo.playlist.author.toString() ?? "UNKNOWN AUTHOR",
			url: "",
		},
		tracks: [],
		id: playlistId,
		url: buildPlaylistUrl(playlistId, videoId),
		type: "playlist",
		source: "youtube",
	});

	pl.tracks = buildTracks(mixVidInfo.playlist.contents, ext, pl);
	return pl;
}

export async function getPlaylist(
	playlistId: string,
	ext: YoutubeExtractor,
): Promise<Playlist> {
	const tube: Innertube = await getInnertube();

	let playlist: YT.Playlist = await tube.getPlaylist(playlistId);

	const pl: Playlist = new Playlist(ext.context.player, {
		title: playlist.info.title ?? "UNKNOWN PLAYLIST",
		thumbnail: playlist.info.thumbnails?.at(0)?.url,
		description: playlist.info.description ?? "UNKNOWN DESCRIPTION",
		author: {
			name:
				playlist.info.author.name ??
				playlist.channels[0]?.author?.name ??
				"UNKNOWN AUTHOR",
			url:
				playlist.info.author.url ??
				playlist.channels[0]?.author?.url ??
				"UNKNOWN AUTHOR",
		},
		tracks: [],
		id: playlistId,
		url: buildPlaylistUrl(playlistId),
		type: "playlist",
		source: "youtube",
	});

	const parsedTracks = buildTracks(playlist.videos, ext, pl);

	while (playlist.has_continuation) {
		playlist = await playlist.getContinuation();
		const tracks = buildTracks(playlist.videos, ext, pl);
		parsedTracks.push(...tracks);
	}

	pl.tracks = parsedTracks;
	return pl;
}

export async function getVideo(videoId: string, ext: YoutubeExtractor) {
	const tube: Innertube = await getInnertube();
	const metadata: YT.VideoInfo = await tube.getBasicInfo(videoId);

	const ytTrack = new Track(ext.context.player, {
		title: metadata.basic_info.title,
		thumbnail: metadata.basic_info.thumbnail?.at(0)?.url ?? YOUTUBE_LOGO,
		description: metadata.basic_info.short_description,
		author: metadata.basic_info.author,
		live: metadata.basic_info.is_live,
		duration: Util.buildTimeCode(
			Util.parseMS((metadata.basic_info.duration ?? 0) * 1000),
		),
		url: buildVideoUrl(videoId),
		requestedBy: getSearchContext().requestedBy,
		queryType: QueryType.YOUTUBE_VIDEO,
		source: "youtube",
	});

	return ytTrack;
}

function enrichTrackWithPlaylistData(track: Track, pl: Playlist): Track {
	track.playlist = pl;
	track.queryType = QueryType.YOUTUBE_PLAYLIST;
	return track;
}

function extractThumbnailFromLockupView(
	vid: YTNodes.LockupView,
): string | undefined {
	let thumbnailUrl: string | undefined;

	if (vid.content_image?.is(YTNodes.CollectionThumbnailView)) {
		thumbnailUrl = vid.content_image?.primary_thumbnail?.image?.at(0)?.url;
	} else if (vid.content_image?.is(YTNodes.ThumbnailView)) {
		thumbnailUrl = vid.content_image?.image?.at(0)?.url;
	}

	return thumbnailUrl;
}
