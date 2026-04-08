import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, ExtractorStreamable, QueryType, SearchQueryType, Track } from "discord-player";
import { YoutubeOptions } from "../types";
import Innertube from "youtubei.js";
import { getInnertube, getPlaylistId, getVideoId, isUrl } from "../utils";
import { getMixedPlaylist, getPlaylist, getVideo, runWithSearchContext, search } from "../internal";
import { createStreamFunction } from "../Streams";
import { isYoutubeDlInstalled } from "../Streams/YoutubeDLStream";

export class YoutubeExtractor extends BaseExtractor<YoutubeOptions> {
    public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";
    public innertube: Innertube | null = null;
    private _stream: Function | null = null;
    private interval: NodeJS.Timeout | undefined;

    public async activate(): Promise<void> {
        this.options.downloads ??= {
            trialOrder: ["peer", "adaptive", "sabr", "yt-dlp"]
        };

        if(this.options.downloads.trialOrder.length > 4) throw new Error("trialOrder must have an array length of no more than 4.");
        if((new Set(this.options.downloads.trialOrder).size !== this.options.downloads.trialOrder.length)) throw new Error("trialOrder contains duplicates.")

        this.innertube = await getInnertube(this.options);

        this.protocols = ["yt", "youtube"];
        const fn = this.options.createStream;
        if (typeof fn === "function") this._stream = (q: Track) => { return fn(q, this) };
        else this._stream = createStreamFunction(this);

        const isYtdlInstalled = await isYoutubeDlInstalled();

        if (isYtdlInstalled) {
            this.context.player.debug("[YouTube]: yt-dlp installation detected. Starting cron job to update it weekly.");

            const updateDl = async () => {
                async () => {
                    const dl = await import("youtube-dl-exec");

                    this.context.player.debug("[YouTube]: Updating youtube-dl");
                    await dl.update();
                    this.context.player.debug("[YouTube]: Updated youtube-dl");
                }
            }

            await updateDl();

            this.interval = setInterval(updateDl.bind(this), 6.048e+8/* 1 week */).unref();
        }
    }

    public async deactivate(): Promise<void> {
        this.innertube = null;
        this._stream = null;

        if(this.interval) clearInterval(this.interval);
    }

    public async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
        if (typeof query !== "string") return false;
        return true;
    }

    public async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        if (context.type !== QueryType.YOUTUBE_PLAYLIST && context.type !== QueryType.YOUTUBE_VIDEO) {
            try {
                if (isUrl(query)) {
                    context.type = QueryType.YOUTUBE_VIDEO;
                    const queryUrl = new URL(query);
                    if (queryUrl.searchParams.has("list")) context.type = QueryType.YOUTUBE_PLAYLIST;
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
                        this.context.player.debug("Invalid Playlist ID { playlist: " + query + " }.");
                        return this.createResponse(null, []);
                    }

                    if (playlistId.isMix && playlistId.videoId) {
                        const pl = await getMixedPlaylist(playlistId.playlistId, playlistId.videoId, this);
                        return this.createResponse(pl, pl.tracks);
                    }

                    const pl = await getPlaylist(playlistId.playlistId, this);
                    return this.createResponse(pl, pl.tracks);
                }
                case QueryType.YOUTUBE_VIDEO: {
                    return this.createResponse(null, [await getVideo(getVideoId(query), this)]);
                }
                default: {
                    return this.createResponse(null, await search(query, this));
                }
            }
        });
    }

    async stream(info: Track): Promise<ExtractorStreamable> {
        return this._stream(info);
    }
}