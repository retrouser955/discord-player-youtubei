"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTrackFromVideo = buildTrackFromVideo;
exports.buildTrackFromPlaylistVideo = buildTrackFromPlaylistVideo;
exports.search = search;
exports.getMixedPlaylist = getMixedPlaylist;
exports.getPlaylist = getPlaylist;
exports.getVideo = getVideo;
const youtubei_js_1 = require("youtubei.js");
const Classes_1 = require("../Classes");
const utils_1 = require("../utils");
const discord_player_1 = require("discord-player");
const ContextProvider_1 = require("./ContextProvider");
const Constants_1 = require("../Constants");
function buildTrackFromVideo(vid, ext) {
    return new Classes_1.YoutubeTrack(ext.context.player, {
        title: vid.title.toString() ?? "UNKNOWN TITLE",
        url: (0, utils_1.buildVideoUrl)(vid.video_id),
        duration: discord_player_1.Util.buildTimeCode(discord_player_1.Util.parseMS((vid.duration?.seconds ?? 0) * 1000)),
        thumbnail: vid.thumbnails[0]?.url,
        author: vid.author.name ?? "UNKNOWN AUTHOR",
        requestedBy: (0, ContextProvider_1.getSearchContext)().requestedBy,
        source: "youtube",
        queryType: discord_player_1.QueryType.YOUTUBE_VIDEO,
        live: vid.is_live,
        description: vid.description.toString() || "",
    });
}
function buildTrackFromPlaylistVideo(vid, pl, ext) {
    return new Classes_1.YoutubeTrack(ext.context.player, {
        title: vid.title.text ?? "UNKNOWN TITLE",
        url: (0, utils_1.buildVideoUrl)(vid.id),
        duration: discord_player_1.Util.buildTimeCode(discord_player_1.Util.parseMS((vid.duration?.seconds ?? 0) * 1000)),
        thumbnail: vid.thumbnails[0]?.url,
        author: vid.author.name ?? "UNKNOWN AUTHOR",
        requestedBy: (0, ContextProvider_1.getSearchContext)().requestedBy,
        source: "youtube",
        queryType: discord_player_1.QueryType.YOUTUBE_VIDEO,
        live: vid.is_live,
        playlist: pl,
        async requestMetadata() { return this.raw; },
    });
}
async function search(term, ext) {
    const tube = await (0, utils_1.getInnertube)();
    return ((await tube.search(term)).videos
        .filter(vid => vid.is(youtubei_js_1.YTNodes.Video))
        .map(vid => buildTrackFromVideo(vid, ext)));
}
async function getMixedPlaylist(playlistId, videoId, ext) {
    const tube = await (0, utils_1.getInnertube)();
    const endpoint = new youtubei_js_1.YTNodes.NavigationEndpoint({
        continuationCommand: {
            videoId,
            playlistId
        },
    });
    const mixVidInfo = await tube.getInfo(endpoint);
    if (!mixVidInfo?.playlist)
        throw new Error("Mix playlist not found or is invalid.");
    const pl = new discord_player_1.Playlist(ext.context.player, {
        title: mixVidInfo.playlist.title ?? "UNKOWN PLAYLIST",
        thumbnail: mixVidInfo.playlist.contents?.[0]?.thumbnail,
        description: "",
        author: {
            name: mixVidInfo.playlist.author.toString() ?? "UNKNOWN AUTHOR",
            url: "",
        },
        tracks: [],
        id: playlistId,
        url: (0, utils_1.buildPlaylistUrl)(playlistId, videoId),
        type: "playlist",
        source: "youtube",
    });
    pl.tracks = mixVidInfo.playlist.contents.filter(v => v.is(youtubei_js_1.YTNodes.PlaylistVideo)).map(v => buildTrackFromPlaylistVideo(v, pl, ext));
    return pl;
}
async function getPlaylist(playlistId, ext) {
    const tube = await (0, utils_1.getInnertube)();
    let playlist = await tube.getPlaylist(playlistId);
    const pl = new discord_player_1.Playlist(ext.context.player, {
        title: playlist.info.title ?? "UNKNOWN PLAYLIST",
        thumbnail: playlist.info.thumbnails[0].url,
        description: playlist.info.description ?? "UNKNOWN DESCRIPTION",
        author: {
            name: playlist.info.author.name ?? playlist.channels[0]?.author?.name ?? "UNKNOWN AUTHOR",
            url: playlist.info.author.url ?? playlist.channels[0]?.author?.url ?? "UNKNOWN AUTHOR",
        },
        tracks: [],
        id: playlistId,
        url: (0, utils_1.buildPlaylistUrl)(playlistId),
        type: "playlist",
        source: "youtube",
    });
    const parsedTrack = playlist.videos
        .filter(v => v.is(youtubei_js_1.YTNodes.PlaylistVideo))
        .map(v => buildTrackFromPlaylistVideo(v, pl, ext));
    while (playlist.has_continuation) {
        playlist = await playlist.getContinuation();
        const tracks = playlist.videos
            .filter(v => v.is(youtubei_js_1.YTNodes.PlaylistVideo))
            .map(v => buildTrackFromPlaylistVideo(v, pl, ext));
        parsedTrack.push(...tracks);
    }
    pl.tracks = parsedTrack;
    return pl;
}
async function getVideo(videoId, ext) {
    const tube = await (0, utils_1.getInnertube)();
    const metadata = await tube.getBasicInfo(videoId);
    const ytTrack = new Classes_1.YoutubeTrack(ext.context.player, {
        title: metadata.basic_info.title,
        thumbnail: metadata.basic_info.thumbnail?.at(0)?.url || Constants_1.YOUTUBE_LOGO,
        description: metadata.basic_info.short_description,
        author: metadata.basic_info.author,
        duration: discord_player_1.Util.buildTimeCode(discord_player_1.Util.parseMS((metadata.basic_info.duration ?? 0) * 1000)),
        url: (0, utils_1.buildVideoUrl)(videoId),
        requestedBy: (0, ContextProvider_1.getSearchContext)().requestedBy,
        queryType: discord_player_1.QueryType.YOUTUBE_VIDEO,
        source: "youtube",
    });
    const adaptiveStream = metadata.chooseFormat({ format: "any", quality: "best", type: "audio" });
    const serverAbrStreamingUrl = await tube.session.player?.decipher(metadata.streaming_data?.server_abr_streaming_url);
    const uStreamConfig = metadata.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;
    try {
        ytTrack.setCache({
            type: Classes_1.CacheType.Adaptive,
            url: (0, utils_1.buildVideoUrl)(videoId),
            cpn: metadata.cpn,
            size: adaptiveStream.content_length ?? 0,
        });
        if (serverAbrStreamingUrl && uStreamConfig) {
            ytTrack.setCache({
                type: Classes_1.CacheType.SeverAbr,
                url: serverAbrStreamingUrl,
                uStreamConfig: uStreamConfig,
            });
        }
    }
    catch (error) {
        console.error(error);
    }
    return ytTrack;
}
