import { PassThrough } from "stream"
import { Utils } from "youtubei.js"

export async function createReadableFromWeb(readStream: ReadableStream<Uint8Array>, highWaterMark = 1024 * 512) {
    const readable = new PassThrough({
        highWaterMark,
    });

    for await (const chunk of Utils.streamToIterable(readStream)) {
        if(!readable.write(chunk)) {
            await new Promise((res) => readable.on("drain", res))
        }
    }

    return readable
}