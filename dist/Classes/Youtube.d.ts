import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, ExtractorStreamable, SearchQueryType, Track } from "discord-player";
import { youtubeOptions } from "../types";
export declare class YoutubeExtractor extends BaseExtractor<youtubeOptions> {
    static identifier: string;
    private innertube;
    private _stream;
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    validate(query: string, type?: SearchQueryType | null): Promise<boolean>;
    handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo>;
    stream(info: Track): Promise<ExtractorStreamable>;
}
