import type { Track } from "discord-player";
import { extractVideoId } from "../common/extractVideoID";
import youtubeDl from "youtube-dl-exec";
import { type YoutubeiExtractor } from "../Extractor/Youtube";

import ytdlExec from "youtube-dl-exec";
import { mkdir, chmod } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const { YOUTUBE_DL_PATH, YOUTUBE_DL_HOST, YOUTUBE_DL_DIR, YOUTUBE_DL_FILE } = (
  ytdlExec as unknown as {
    constants: Record<string, string>;
  }
).constants;

export type UpdateErrorType = "download" | "body_not_found";

export class UpdateError extends Error {
  type: UpdateErrorType;
  constructor(
    type: UpdateErrorType,
    message?: string,
    errorOptions?: ErrorOptions,
  ) {
    super(message, errorOptions);
    this.type = type;
  }
}

export async function getDlBinary() {
  // get the binary of yt-dlp
  let binaryResponse = await fetch(YOUTUBE_DL_HOST);
  if (!binaryResponse.ok)
    throw new UpdateError("download", "Could not update youtube-dl");

  if (
    binaryResponse.headers.get("Content-Type") !== "application/octet-stream"
  ) {
    const { assets } = await binaryResponse.json();
    const { browser_download_url } = assets.find(
      ({ name }: { name: string }) => name === YOUTUBE_DL_FILE,
    );

    binaryResponse = await fetch(browser_download_url);
    if (!binaryResponse.ok)
      throw new UpdateError("download", "Could not update youtube-dl");
  }

  if (!binaryResponse.body)
    throw new UpdateError("body_not_found", "Could not find body of the file");

  return binaryResponse.body;
}

export async function updateDl() {
  const [binary] = await Promise.all([
    getDlBinary(),
    mkdir(YOUTUBE_DL_DIR, { recursive: true }),
  ]);

  await pipeline(binary, createWriteStream(YOUTUBE_DL_PATH));
  await chmod(YOUTUBE_DL_PATH, 0o755);
}

export async function generateStreamWithYoutubeDL(
  track: Track,
  youtubei: YoutubeiExtractor,
) {
  const videoId = extractVideoId(track.url);
  const videoUrl = "https://youtu.be/" + videoId;
  const videoFormat = track.live ? "best[height<=360]" : "bestaudio";
  const { context } = youtubei;
  const player = context.player;

  const process = youtubeDl.exec(videoUrl, {
    jsRuntimes: "node",
    format: videoFormat,
    output: "-",
    cookies: youtubei.options.cookie,
  });

  process.catch((e) => {
    player.debug("YOUTUBEI: Ran into an error during stream extraction");
    if (youtubei.options.logLevel === "ALL") console.log(e);
  });

  const stream = process.stdout;

  return stream ? stream : undefined;
}
