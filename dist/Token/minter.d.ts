import Innertube from "youtubei.js";
import { InitOptions, minterResult } from "../types";
export declare function getWebPoMinter(innertube: Innertube, options?: InitOptions): Promise<minterResult>;
export declare function invalidateWebPoMinter(): Promise<void>;
