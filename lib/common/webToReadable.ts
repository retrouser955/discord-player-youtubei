import { Readable } from "stream"

export function createReadableFromWeb(readStream: ReadableStream<Uint8Array>) {
    const reader = readStream.getReader()

    const readable = new Readable({
        read() {
            reader.read()
                .then(({ done, value }) => this.push(done ? value : Buffer.from(value)))
                .catch(err => this.destroy(err))
        }
    })

    return readable
}