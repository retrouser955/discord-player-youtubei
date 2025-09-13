import { AsyncLocalStorage } from "async_hooks";
import type { ExtractorSearchContext } from "discord-player";

const searchContext = new AsyncLocalStorage<ExtractorSearchContext>();

export async function runWithSearchContext<T>(ctx: ExtractorSearchContext, fn: () => Promise<T>): Promise<T> {
    return searchContext.run(ctx, () => fn());
}

export function getSearchContext(): ExtractorSearchContext {
    const ctx = searchContext.getStore();
    if (!ctx) throw new Error("No context available");
    return ctx;
}