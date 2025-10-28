"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveStream = void 0;
const node_stream_1 = require("node:stream");
const Constants_1 = require("../Constants");
const utils_1 = require("../utils");
const youtubei_js_1 = require("youtubei.js");
class AdaptiveStream extends node_stream_1.Readable {
    constructor(url, cpn, size) {
        let isEnded = false;
        let start = 0;
        let end = Math.min(size, Constants_1.TEN_MB);
        let abortController;
        super({
            async read() {
                if (isEnded)
                    return;
                if (end >= size) {
                    isEnded = true;
                    end = size;
                }
                const tube = await (0, utils_1.getInnertube)();
                abortController = new AbortController();
                const fUrl = `${url}&cpn=${cpn}&range=${start}-${end || ""}`;
                const getReq = await tube.session.http.fetch_function(fUrl, {
                    headers: youtubei_js_1.Constants.STREAM_HEADERS,
                    signal: abortController.signal,
                });
                if (!getReq.body)
                    throw new Error(`Downloading of video failed at ${(start / size) * 100}%`);
                for await (const chunk of youtubei_js_1.Utils.streamToIterable(getReq.body))
                    this.push(Buffer.from(chunk));
                if (isEnded)
                    this.push(null);
                start = end + 1;
                end += Constants_1.TEN_MB;
            },
            destroy(error) {
                abortController?.abort(error);
            }
        });
    }
}
exports.AdaptiveStream = AdaptiveStream;
