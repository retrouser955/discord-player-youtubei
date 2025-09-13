import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, QueryType } from "discord-player";
import type { YoutubeOptions } from "../types";
import { getInnertube, getPlaylistId } from "../utils";
import { getMixedPlaylist, getPlaylist, getVideo, search } from "../internal";

export class YoutubeExtractor extends BaseExtractor<YoutubeOptions> {
    public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";

    async activate(): Promise<void> {
        await getInnertube(this.options);
    }

    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        switch(context.type) {
            case QueryType.YOUTUBE_PLAYLIST: {
                const playlistId = getPlaylistId(query);
                if(!playlistId.playlistId) {
                    this.debug("Invalid Playlist ID { playlist: " + query + " }")
                    return this.createResponse(null, []);
                }
                if(playlistId.isMix && playlistId.videoId) {
                    const pl = await getMixedPlaylist(playlistId.playlistId, playlistId.videoId, this);
                    return this.createResponse(pl, pl.tracks);
                }
                const pl = await getPlaylist(playlistId.playlistId, this);
                return this.createResponse(pl, pl.tracks);
            }
            case QueryType.YOUTUBE_VIDEO: {
                return this.createResponse(null, [await getVideo(query, this)])
            }
            default: {
                return this.createResponse(null, await search(query, this));
            }
        }
    }
}