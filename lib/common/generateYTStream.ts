import type Innertube from "youtubei.js/agnostic";
import {
  Constants,
  Platform,
  Utils,
  Constants as YoutubeiConsts,
} from "youtubei.js";
import type { BaseExtractor, Track } from "discord-player";
import type { OAuth2Tokens } from "youtubei.js/agnostic";
import type {
  DownloadOptions,
  InnerTubeClient,
} from "youtubei.js/dist/src/types";
import { YoutubeiExtractor } from "../Extractor/Youtube";
import type { ExtractorStreamable } from "discord-player";
import { createReadableFromWeb } from "./webToReadable";

export interface YTStreamingOptions {
  extractor?: BaseExtractor<object>;
  authentication?: OAuth2Tokens;
  overrideDownloadOptions?: DownloadOptions;
}

const DEFAULT_DOWNLOAD_OPTIONS: DownloadOptions = {
  quality: "best",
  format: "mp4",
  type: "audio",
};

export function createWebReadableStream(
  url: string,
  size: number,
  innertube: Innertube,
) {
  let [start, end] = [0, 1048576 * 10];
  let isEnded = false;

  let abort: AbortController;

  // all credits go to [LuanRT](https://github.com/LuanRT/YouTube.js/blob/main/src/utils/FormatUtils.ts)
  return new Platform.shim.ReadableStream<Uint8Array>(
    {
      start() {},
      pull(controller) {
        if (isEnded) {
          controller.close();
          return;
        }

        if (end >= size) {
          isEnded = true;
        }

        return new Promise(async (resolve, reject) => {
          abort = new AbortController();
          try {
            const chunks = await innertube.session.http.fetch_function(url, {
              headers: {
                ...Constants.STREAM_HEADERS,
              },
              signal: abort.signal,
            });

            const readable = chunks.body;

            if (!readable || chunks.ok)
              throw new Error(`Downloading of ${url} failed.`);

            for await (const chunk of Utils.streamToIterable(readable)) {
              controller.enqueue(chunk);
            }

            start = end + 1;
            end += size;

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      },
      async cancel() {
        abort.abort();
      },
    },
    {
      highWaterMark: 1,
      size(ch) {
        return ch.byteLength;
      },
    },
  );
}

export async function streamFromYT(
  query: Track,
  innerTube: Innertube,
  options: YTStreamingOptions = {
    overrideDownloadOptions: DEFAULT_DOWNLOAD_OPTIONS,
  },
): Promise<ExtractorStreamable> {
  const context = YoutubeiExtractor.getStreamingContext();

  let id = new URL(query.url).searchParams.get("v");
  // VIDEO DETECTED AS YT SHORTS OR youtu.be link
  if (!id) id = query.url.split("/").at(-1)?.split("?").at(0)!;
  const videoInfo = await innerTube.getBasicInfo(id, context.useClient);

  if (videoInfo.basic_info.is_live)
    return videoInfo.streaming_data?.hls_manifest_url!;

  if (
    (["IOS", "ANDROID", "TV_EMBEDDED"] as InnerTubeClient[]).includes(
      context.useClient,
    )
  ) {
    const downloadURL = videoInfo.chooseFormat(
      options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS,
    );
    const download = createWebReadableStream(
      downloadURL.url!,
      downloadURL.content_length!,
      innerTube,
    );

    return createReadableFromWeb(download, context.highWaterMark);
  }

  const download = await videoInfo.download(
    options.overrideDownloadOptions ?? DEFAULT_DOWNLOAD_OPTIONS,
  );

  const stream = createReadableFromWeb(download, context.highWaterMark);

  return stream;
}
