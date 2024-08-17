import { PassThrough } from "stream"
import { Utils } from "youtubei.js"

export async function createReadableFromWeb(readStream: ReadableStream<Uint8Array>, highWaterMark = 1024 * 512) {
    const readable = new PassThrough({
        highWaterMark,
    });

    // run out of order
    (async () => {
        let shouldListen = true

        for await (const chunk of Utils.streamToIterable(readStream)) {
            if(readable.destroyed) continue;

            const shouldWrite = readable.write(chunk)
    
            if(!shouldWrite && shouldListen) {
                shouldListen = false
                await new Promise<void>(res => {
                    readable.once("drain", () => {
                        shouldListen = true
                        res()
                    })
                })
            }
        }
    })()

    readable._destroy = () => {
        readStream.cancel()
        readable.destroyed = true
        readable.destroy()
    };

    return readable
}