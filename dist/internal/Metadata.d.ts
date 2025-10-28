import { YTNodes } from "youtubei.js";
import { YoutubeExtractor, YoutubeTrack } from "../Classes";
import { Playlist } from "discord-player";
export declare function buildTrackFromVideo(vid: YTNodes.Video, ext: YoutubeExtractor): YoutubeTrack;
export declare function buildTrackFromPlaylistVideo(vid: YTNodes.PlaylistVideo, pl: Playlist, ext: YoutubeExtractor): YoutubeTrack;
export declare function search(term: string, ext: YoutubeExtractor): Promise<any>;
export declare function getMixedPlaylist(playlistId: string, videoId: string, ext: YoutubeExtractor): Promise<Playlist>;
export declare function getPlaylist(playlistId: string, ext: YoutubeExtractor): Promise<Playlist>;
export declare function getVideo(videoId: string, ext: YoutubeExtractor): Promise<YoutubeTrack>;
