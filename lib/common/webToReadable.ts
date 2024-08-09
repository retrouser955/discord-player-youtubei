import { PassThrough } from "stream"
import { Utils } from "youtubei.js"

export async function createReadableFromWeb(readStream: ReadableStream<Uint8Array>, highWaterMark = 1024 * 512) {
    const readable = new PassThrough({
        highWaterMark,
    });

    // run out of order
    (async () => {
        for await (const chunk of Utils.streamToIterable(readStream)) {
            if(readable.destroyed) continue;

            const shouldWrite = readable.write(chunk)
    
            if(!shouldWrite) await new Promise(res => readable.once("drain", () => res(null)))
        }
    })()

    readable._destroy = () => {
        readable.destroyed = true
        readable.destroy()
    };

    return readable
}