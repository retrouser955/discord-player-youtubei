import { Readable } from "node:stream";
import { youtubeOptions } from "../types";
export declare function createSabrStream(videoId: string, options: youtubeOptions): Promise<Readable | null>;
