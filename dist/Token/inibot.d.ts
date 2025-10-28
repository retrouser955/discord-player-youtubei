import { Innertube } from "youtubei.js";
import type { InitOptions } from "../types";
import { BG } from "bgutils-js";
export declare function initializeBotGuard(innertube: Innertube, { forceRefresh }?: InitOptions): Promise<BG.WebPoMinter>;
