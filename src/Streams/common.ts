import { Readable, PassThrough } from "node:stream";

export const YOUTUBE_REGEX = /^https:\/\/(www\.)?youtu(\.be\/.{11}(.+)?|be\.com\/watch\?v=.{11}(&.+)?)/;

export function getVideoId(url: string): string {
    if (!YOUTUBE_REGEX.test(url)) throw new Error("Invalid Youtube Link.");

    let id = new URL(url).searchParams.get("v");
    if (!id) id = url.split("/").at(-1)?.split("?").at(0);

    return id;
}

export function toNodeReadable(stream: any): Readable | null {
    const nodeStream = new PassThrough();
    const reader = stream.getReader();

    (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    if (!nodeStream.write(Buffer.from(value))) await new Promise<void>((res) => nodeStream.once("drain", () => res()));
                }
            }
        } finally {
            nodeStream.end();
        }
    })();

    return nodeStream;
}