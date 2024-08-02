import { PassThrough } from "stream"
import { Utils } from "youtubei.js"

export async function createReadableFromWeb(readStream: ReadableStream<Uint8Array>) {
    const readable = new PassThrough();

    for await (const chunk of Utils.streamToIterable(readStream)) {
        readable.write(chunk)
    }

    return readable
}