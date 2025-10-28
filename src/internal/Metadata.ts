import Innertube, { YT, YTNodes } from "youtubei.js";
import { CacheType, YoutubeExtractor, YoutubeTrack } from "../Classes";
import { buildPlaylistUrl, buildVideoUrl, getInnertube } from "../utils";
import { Playlist, QueryType, Util } from "discord-player";
import { getSearchContext } from "./ContextProvider";
import { YOUTUBE_LOGO } from "../Constants";

export function buildTrackFromVideo(vid: YTNodes.Video, ext: YoutubeExtractor): YoutubeTrack {
    return new YoutubeTrack(ext.context.player, {
        title: vid.title.toString() ?? "UNKNOWN TITLE",
        url: buildVideoUrl(vid.video_id),
        duration: Util.buildTimeCode(Util.parseMS((vid.duration?.seconds ?? 0) * 1000)),
        thumbnail: vid.thumbnails[0]?.url,
        author: vid.author.name ?? "UNKNOWN AUTHOR",
        requestedBy: getSearchContext().requestedBy,
        source: "youtube",
        queryType: QueryType.YOUTUBE_VIDEO,
        live: vid.is_live,
        description: vid.description.toString() || "",
    });
}

export function buildTrackFromPlaylistVideo(vid: YTNodes.PlaylistVideo, pl: Playlist, ext: YoutubeExtractor): YoutubeTrack {
    return new YoutubeTrack(ext.context.player, {
        title: vid.title.text ?? "UNKNOWN TITLE",
        url: buildVideoUrl(vid.id),
        duration: Util.buildTimeCode(Util.parseMS((vid.duration?.seconds ?? 0) * 1000)),
        thumbnail: vid.thumbnails[0]?.url,
        author: vid.author.name ?? "UNKNOWN AUTHOR",
        requestedBy: getSearchContext().requestedBy,
        source: "youtube",
        queryType: QueryType.YOUTUBE_VIDEO,
        live: vid.is_live,
        playlist: pl,
        async requestMetadata() { return this.raw },
    });
}

export async function search(term: string, ext: YoutubeExtractor): Promise<any> {
    const tube: Innertube = await getInnertube();
    return ((await tube.search(term)).videos
        .filter(vid => vid.is(YTNodes.Video))
        .map(vid => buildTrackFromVideo(vid, ext))
    );
}

export async function getMixedPlaylist(playlistId: string, videoId: string, ext: YoutubeExtractor): Promise<Playlist> {
    const tube: Innertube = await getInnertube();

    const endpoint: YTNodes.NavigationEndpoint = new YTNodes.NavigationEndpoint({
        continuationCommand: {
            videoId,
            playlistId
        },
    });

    const mixVidInfo: YT.VideoInfo = await tube.getInfo(endpoint);
    if(!mixVidInfo?.playlist) throw new Error("Mix playlist not found or is invalid.");

    const pl: Playlist = new Playlist(ext.context.player, {
        title: mixVidInfo.playlist.title ?? "UNKOWN PLAYLIST",
        thumbnail: (mixVidInfo.playlist.contents?.[0] as any)?.thumbnail as string,
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

    pl.tracks = mixVidInfo.playlist.contents.filter(v => v.is(YTNodes.PlaylistVideo)).map(v => buildTrackFromPlaylistVideo(v, pl, ext));
    return pl;
}

export async function getPlaylist(playlistId: string, ext: YoutubeExtractor): Promise<Playlist> {
    const tube: Innertube = await getInnertube();

    let playlist: YT.Playlist = await tube.getPlaylist(playlistId);

    const pl: Playlist = new Playlist(ext.context.player, {
        title: playlist.info.title ?? "UNKNOWN PLAYLIST",
        thumbnail: playlist.info.thumbnails[0].url,
        description: playlist.info.description ?? "UNKNOWN DESCRIPTION",
        author: {
            name: playlist.info.author.name ?? playlist.channels[0]?.author?.name ?? "UNKNOWN AUTHOR",
            url: playlist.info.author.url ?? playlist.channels[0]?.author?.url ?? "UNKNOWN AUTHOR",
        },
        tracks: [],
        id: playlistId,
        url: buildPlaylistUrl(playlistId),
        type: "playlist",
        source: "youtube",
    });

    const parsedTrack = playlist.videos
        .filter(v => v.is(YTNodes.PlaylistVideo))
        .map(v => buildTrackFromPlaylistVideo(v, pl, ext));

    while(playlist.has_continuation) {
        playlist = await playlist.getContinuation();
        const tracks = playlist.videos
            .filter(v => v.is(YTNodes.PlaylistVideo))
            .map(v => buildTrackFromPlaylistVideo(v, pl, ext));

        parsedTrack.push(...tracks);
    }

    pl.tracks = parsedTrack;
    return pl;
}

export async function getVideo(videoId: string, ext: YoutubeExtractor) {
    const tube: Innertube = await getInnertube();
    const metadata: YT.VideoInfo = await tube.getBasicInfo(videoId);

    const ytTrack: YoutubeTrack = new YoutubeTrack(ext.context.player, {
        title: metadata.basic_info.title,
        thumbnail: metadata.basic_info.thumbnail?.at(0)?.url || YOUTUBE_LOGO,
        description: metadata.basic_info.short_description,
        author: metadata.basic_info.author,
        duration: Util.buildTimeCode(Util.parseMS((metadata.basic_info.duration ?? 0) * 1000)),
        url: buildVideoUrl(videoId),
        requestedBy: getSearchContext().requestedBy,
        queryType: QueryType.YOUTUBE_VIDEO,
        source: "youtube",
    });

    const adaptiveStream = metadata.chooseFormat({ format: "mp4", quality: "highestaudio", type: "audio" });

    const serverAbrStreamingUrl = await tube.session.player?.decipher(metadata.streaming_data?.server_abr_streaming_url);
    const uStreamConfig = metadata.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

    ytTrack.setCache({
        type: CacheType.Adaptive,
        url: await adaptiveStream.decipher(tube.session.player),
        cpn: metadata.cpn,
        size: adaptiveStream.content_length ?? 0,
    });

    if (serverAbrStreamingUrl && uStreamConfig) {
        ytTrack.setCache({
            type: CacheType.SeverAbr,
            url: serverAbrStreamingUrl,
            uStreamConfig: uStreamConfig,
        });
    }

    return ytTrack;
}