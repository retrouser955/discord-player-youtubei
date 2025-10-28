import type { ExtractorSearchContext } from "discord-player";
export declare function runWithSearchContext<T>(ctx: ExtractorSearchContext, fn: () => Promise<T>): Promise<T>;
export declare function getSearchContext(): ExtractorSearchContext;
