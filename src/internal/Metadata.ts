import { YTNodes } from "youtubei.js";
import { CacheType, type YoutubeExtractor, YoutubeTrack } from "../Classes";
import { YOUTUBE_LOGO, YOUTUBE_REGEX } from "../Constants";
import { buildPlaylistUrl, buildVideoUrl, getInnertube } from "../utils";
import { QueryType, Util, Playlist } from "discord-player";
import { getSearchContext } from "./ContextProvider";

export function extractVideoId(vid: string) {
    if (!YOUTUBE_REGEX.test(vid)) throw new Error("Invalid youtube url");

    let id = new URL(vid).searchParams.get("v");
    // VIDEO DETECTED AS YT SHORTS OR youtu.be link
    if (!id) id = vid.split("/").at(-1)?.split("?").at(0)!;

    return id;
}

export function buildTrackFromVideo(vid: YTNodes.Video, ext: YoutubeExtractor) {
    return new YoutubeTrack(ext.context.player, {
        title: vid.title.toString(),
        url: buildVideoUrl(vid.id),
        duration: Util.buildTimeCode(Util.parseMS((vid.duration?.seconds ?? 0) * 1000)),
        thumbnail: vid.thumbnails[0]?.url,
        author: vid.author.name,
        views: parseInt((vid.view_count?.text ?? "0").replaceAll(",", "")),
        requestedBy: getSearchContext().requestedBy,
        source: "youtube",
        queryType: QueryType.YOUTUBE_VIDEO,
        live: vid.is_live,
        description: vid.description?.toString() || "",
    })
}

export async function search(term: string, ext: YoutubeExtractor) {
    const yt = await getInnertube();
    return (await yt.search(term)).videos
        .filter(vid => vid.is(YTNodes.Video))
        .map(vid => buildTrackFromVideo(vid, ext));
}

export function buildTrackFromPlaylistVideo(v: YTNodes.PlaylistVideo, pl: Playlist, ext: YoutubeExtractor) {
    const duration = Util.buildTimeCode(
        Util.parseMS((v.duration?.seconds ?? 0) * 1000),
    );
    const context = getSearchContext();

    return new YoutubeTrack(ext.context.player, {
        title: v.title.text ?? "UNKNOWN TITLE",
        duration: duration,
        thumbnail: v.thumbnails[0]?.url,
        author: v.author.name,
        requestedBy: context.requestedBy,
        url: `https://youtube.com/watch?v=${v.id}`,
        playlist: pl,
        source: "youtube",
        queryType: "youtubeVideo",
        async requestMetadata() {
            return this.raw;
        },
        live: v.is_live
    })
}

export async function getMixedPlaylist(playlistId: string, videoId: string, ext: YoutubeExtractor) {
    const yt = await getInnertube();

    const endpoint = new YTNodes.NavigationEndpoint({
        continuationCommand: {
            videoId,
            playlistId
        },
    });

    const mixVidInfo = await yt.getInfo(endpoint);
    if (!mixVidInfo?.playlist)
        throw new Error("Mix playlist not found or invalid");

    const pl = new Playlist(ext.context.player, {
        title: mixVidInfo.playlist.title ?? "unknown playlist",
        thumbnail: (mixVidInfo.playlist.contents?.[0] as any)?.thumbnail as string,
        description: "",
        author: {
            name: mixVidInfo.playlist.author.toString() ?? "unknown author",
            url: "",
        },
        tracks: [],
        id: playlistId,
        url: buildPlaylistUrl(playlistId, videoId),
        type: "playlist",
        source: "youtube"
    });

    pl.tracks = mixVidInfo.playlist.contents.filter(v => v.is(YTNodes.PlaylistVideo)).map(v => buildTrackFromPlaylistVideo(v, pl, ext));

    return pl;
}

export async function getPlaylist(playlistId: string, ext: YoutubeExtractor) {
    const yt = await getInnertube();

    let playlist = await yt.getPlaylist(playlistId);

    const pl = new Playlist(ext.context.player, {
        title: playlist.info.title ?? "UNKNOWN PLAYLIST",
        thumbnail: playlist.info.thumbnails[0].url,
        description:
            playlist.info.description ??
            playlist.info.title ??
            "UNKNOWN DESCRIPTION",
        type: "playlist",
        author: {
            name:
                playlist?.channels[0]?.author?.name ??
                playlist.info.author.name ??
                "UNKNOWN AUTHOR",
            url:
                playlist?.channels[0]?.author?.url ??
                playlist.info.author.url ??
                "UNKNOWN AUTHOR",
        },
        tracks: [],
        id: playlistId,
        url: buildPlaylistUrl(playlistId),
        source: "youtube",
    });

    const parsedTracks = playlist.videos
        .filter(v => v.is(YTNodes.PlaylistVideo))
        .map(v => buildTrackFromPlaylistVideo(v, pl, ext));

    while (playlist.has_continuation) {
        playlist = await playlist.getContinuation();
        const tracks = playlist.videos
            .filter(v => v.is(YTNodes.PlaylistVideo))
            .map(v => buildTrackFromPlaylistVideo(v, pl, ext));

        parsedTracks.push(...tracks);
    }

    pl.tracks = parsedTracks;

    return pl;
}

export async function getVideo(videoId: string, ext: YoutubeExtractor) {
    const yt = await getInnertube();
    const metadata = await yt.getBasicInfo(videoId)

    const duration = Util.buildTimeCode(
        Util.parseMS((metadata.basic_info.duration ?? 0) * 1000),
    );

    const ytTrack = new YoutubeTrack(ext.context.player, {
        author: metadata.basic_info.author,
        description: metadata.basic_info.short_description,
        title: metadata.basic_info.title,
        duration,
        url: buildVideoUrl(metadata.basic_info.id!),
        source: "youtube",
        queryType: QueryType.YOUTUBE_VIDEO,
        thumbnail: metadata.basic_info.thumbnail?.at(0)?.url || YOUTUBE_LOGO,
        views: metadata.basic_info.view_count,
        requestedBy: getSearchContext().requestedBy
    });

    const adaptiveStream = metadata.chooseFormat({ format: "mp4", quality: "highestaudio", type: "audio" });

    const serverAbrStreamingUrl = yt.session.player?.decipher(metadata.streaming_data?.server_abr_streaming_url);
    const uStreamConfig = metadata.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

    ytTrack.setCache({
        type: CacheType.Adaptive,
        url: adaptiveStream.decipher(yt.session.player),
        cpn: metadata.cpn,
        size: adaptiveStream.content_length ?? 0 // yikes. what if yt doesnt provide this?
    })
    
    if(serverAbrStreamingUrl && uStreamConfig) {
        ytTrack.setCache({
            type: CacheType.ServerAbr,
            url: serverAbrStreamingUrl,
            uStreamConfig: uStreamConfig
        })
    }

    return ytTrack;
}