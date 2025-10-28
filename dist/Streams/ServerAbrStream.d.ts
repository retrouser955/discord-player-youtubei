import { Readable } from "node:stream";
import { YoutubeOptions } from "../types";
export declare function createSabrStream(videoId: string, options: YoutubeOptions): Promise<Readable | null>;
