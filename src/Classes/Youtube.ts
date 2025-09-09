import { BaseExtractor } from "discord-player";
import type { YoutubeOptions } from "../types";
import { getInnertube } from "../utils";

export class YoutubeExtractor extends BaseExtractor<YoutubeOptions> {
    public static identifier: string = "com.retrouser955.discord-player.discord-player-youtubei";

    async activate(): Promise<void> {
        await getInnertube(this.options);
    }
}