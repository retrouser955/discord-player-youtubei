import { Readable } from "stream";
import { getInnertube } from "../utils";
import { Constants, Utils } from "youtubei.js";

const TEN_MB = 1048576 * 10;

export class AdaptiveStream extends Readable {
    constructor(url: string, cpn: string, size: number) {
        let isEnded = false;
        let downloaded = 0;
        let start = 0;
        let end = Math.min(size, TEN_MB);

        let abortController: AbortController;

        super({
            async read() {
                if (isEnded) return;
                if (end >= size) {
                    isEnded = true;
                    end = size;
                }

                const tube = await getInnertube();

                abortController = new AbortController();

                const fUrl = `${url}&cpn=${cpn}&range=${start}-${end || ""}`;

                const getReq = await tube.session.http.fetch_function(fUrl, {
                    headers: Constants.STREAM_HEADERS,
                    signal: abortController.signal,
                });

                if (!getReq.body)
                    throw new Error(`Download of video failed at ${(start / size) * 100}%`);

                for await (const chunk of Utils.streamToIterable(getReq.body)) {
                    this.push(Buffer.from(chunk));
                }

                if (isEnded) {
                    this.push(null);
                }

                start = end + 1;
                end += TEN_MB;
            },
            destroy(err) {
                abortController?.abort(err);
            }
        })
    }
}