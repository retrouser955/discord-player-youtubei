import { Readable } from "node:stream";
export declare class AdaptiveStream extends Readable {
    constructor(url: string, cpn: string, size: number);
}
