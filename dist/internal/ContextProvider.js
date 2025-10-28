"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithSearchContext = runWithSearchContext;
exports.getSearchContext = getSearchContext;
const async_hooks_1 = require("async_hooks");
const searchContext = new async_hooks_1.AsyncLocalStorage();
async function runWithSearchContext(ctx, fn) {
    return searchContext.run(ctx, () => fn());
}
function getSearchContext() {
    const ctx = searchContext.getStore();
    if (!ctx)
        throw new Error("No context available");
    return ctx;
}
