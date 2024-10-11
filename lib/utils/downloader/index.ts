import Innertube from "youtubei.js";
import type { FormatOptions } from "youtubei.js/dist/src/types";
import { createWebReadableStream } from "../../common/generateYTStream";
import { createReadableFromWeb } from "../../common/webToReadable";

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

export async function stream(
  url: string,
  options?: FormatOptions,
  tube?: Innertube,
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

  const info = await yt.getBasicInfo(vidId, "IOS");

  const fmt = info.chooseFormat(
    options || {
      format: "mp4",
      quality: "best",
      type: "audio",
    },
  );

  if (!fmt.url || !fmt.content_length) throw Errors.NoDownload;

  const stream = createWebReadableStream(
    `${fmt.url!}&cpn=${info.cpn}`,
    fmt.content_length,
    yt,
  );

  return createReadableFromWeb(stream);
}
