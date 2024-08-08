import { PassThrough } from "stream"
import { Utils } from "youtubei.js"

export async function createReadableFromWeb(readStream: ReadableStream<Uint8Array>, highWaterMark = 1024 * 512) {
    const readable = new PassThrough({
        highWaterMark,
    });

    // run out of order
    (async () => {
        for await (const chunk of Utils.streamToIterable(readStream)) {
            const shouldWrite = readable.write(chunk)
    
            if(!shouldWrite) await new Promise(res => readable.on("drain", () => res(null)))
        }
    })()

    return readable
}