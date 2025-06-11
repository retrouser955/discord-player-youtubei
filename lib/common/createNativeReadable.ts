import { Readable } from "stream";
import type Innertube from "youtubei.js";
import { Constants, Utils } from "youtubei.js";

const TEN_MB = 1048576 * 10;

export function createNativeReadable(
  url: string,
  size: number,
  innertube: Innertube,
  videoInfo: { cpn: string },
) {
  let start = 0;
  let end = Math.min(size, TEN_MB);
  let isEnded = false;

  let abortController: AbortController;

  return new Readable({
    async read() {
      if (isEnded) return;

      if (end >= size) {
        isEnded = true;
        end = size;
      }

      abortController = new AbortController();

      const fUrl = `${url}&cpn=${videoInfo.cpn}&range=${start}-${end || ""}`;

      const getReq = await innertube.session.http.fetch_function(fUrl, {
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
      if (abortController) abortController.abort(err);
    },
  });
}
