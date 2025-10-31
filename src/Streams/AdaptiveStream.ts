import { Readable } from "node:stream";
import { TEN_MB } from "../Constants";
import { getInnertube } from "../utils";
import { Constants, Utils } from "youtubei.js";

export class AdaptiveStream extends Readable {
    constructor(url: string, cpn: string, size: number) {
        let isEnded: boolean = false;
        let start: number = 0;
        let end: number = Math.min(size, TEN_MB);
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

                if(!getReq.body) throw new Error(`Downloading of video failed at ${(start/size) * 100}%`);

                for await (const chunk of Utils.streamToIterable(getReq.body)) this.push(Buffer.from(chunk));

                if(isEnded) this.push(null);

                start = end + 1;
                end += TEN_MB
            },
            destroy(error) {
                abortController?.abort(error);
            }
        });
    }
}