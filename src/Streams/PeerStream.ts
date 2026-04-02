import { PassThrough } from "node:stream";
import { Utils } from "youtubei.js";

/**
 * Download from peer sources.
 * Peers must follow these rules to be compatible with discord-player-youtubei.
 * 
 * 1. Authentication must be done via the headers or inside the URL.
 * 2. Peers must keep alive the connection. Peers must not drop the connection midway through the stream.
 * 3. Peers must not rate-limit the extractor. If the peer is a publically available YouTube downloader, maybe add authentication to bypass ratelimit.
 */
export async function downloadPeer(url: string, headers?: HeadersInit) {
    const stream = new PassThrough();
    const abortController = new AbortController();

    const kill = () => {
        abortController.abort("STREAM ENDED");
        stream.removeAllListeners();
    }

    ;(async () => {
        const f = await fetch(url, {
            headers
        })

        for await (const chunk of Utils.streamToIterable(f.body)) {
            stream.write(chunk);
        }
    })();

    stream.on("error", kill);
    stream.on("close", kill);
    stream.on("end", kill);

    return stream;
}