import Innertube from "youtubei.js";
import type {
  FormatOptions,
  InnerTubeClient,
} from "youtubei.js/dist/src/types";
import type { PassThrough } from "stream";
import { createNativeReadable } from "../../common/createNativeReadable";

export type If<C, T, F> = C extends true ? T : F;

export const Errors = {
  InvalidURL: new Error("Invalid URL: Expected a URL got a string instead"),
  InvalidYTURL: new Error(
    "Invalid YouTube URL: Expected a YouTube URL but got something else",
  ),
  NoDownload: new Error("Unable to download video"),
} as const;

const YOUTUBE_REGEX =
  /^(https:\/\/(www\.)?youtu(\.be\/[A-Za-z0-9]{11}(.+)?|be\.com\/watch\?v=[A-Za-z0-9]{11}(&.+)?))/gm;

export function validateURL(url: string) {
  try {
    return new URL(url);
  } catch {
    return false;
  }
}

export async function stream<T extends boolean = false>(
  url: string,
  skipStream?: T,
  options?: FormatOptions,
  tube?: Innertube,
  client?: InnerTubeClient,
) {
  const urlObj = validateURL(url);

  if (!urlObj) throw Errors.InvalidURL;
  if (!YOUTUBE_REGEX.test(url)) throw Errors.InvalidYTURL;

  const vidId =
    urlObj.searchParams.get("v") || url.split("/").at(-1)!.split("?").at(0)!;

  const yt =
    tube ||
    (await Innertube.create({
      retrieve_player: false,
    }));

  const info = await yt.getBasicInfo(vidId, { client: client });

  let fmt = info.chooseFormat(
    options || {
      format: "mp4",
      quality: "best",
      type: "audio",
    },
  );

  if (client && !(["IOS", "ANDROID"] as InnerTubeClient[]).includes(client))
    fmt.url = await fmt.decipher(yt.session.player);

  if (!fmt.url || !fmt.content_length) throw Errors.NoDownload;

  const downloadedUrl = fmt.url!;

  const stream = skipStream
    ? null
    : createNativeReadable(downloadedUrl, fmt.content_length, yt, info);

  return {
    basicInfo: info.basic_info,
    formatInfo: fmt,
    stream: stream as If<T, null, PassThrough>,
    downloadedUrl,
  };
}
