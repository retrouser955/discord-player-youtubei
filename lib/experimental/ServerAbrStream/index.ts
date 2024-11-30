import type { Track } from "discord-player";
import type { YoutubeiExtractor } from "../../Extractor/Youtube";
import { extractVideoId } from "../../common/extractVideoID";
import type { Format } from "googlevideo";
import { PassThrough } from "stream";

export function getGoogleVideoOrThrow() {
  try {
    return (require("googlevideo") as typeof import("googlevideo")).default;
  } catch {
    throw new Error(
      'Unable to find googlevideo. Please install it via "npm install googlevideo"',
    );
  }
}

export async function createServerAbrStream(
  track: Track,
  ext: YoutubeiExtractor,
  onError?: (err: Error) => any,
) {
  const innertube = ext.innerTube;
  const { ServerAbrStream } = getGoogleVideoOrThrow();
  if (!innertube.session.player)
    throw new Error("ServerAbrStream does not work without a valid player.");
  const videoInfo = await innertube.getBasicInfo(
    extractVideoId(track.url),
    "WEB",
  );
  const fmt = videoInfo.chooseFormat({ type: "audio", quality: "best" });
  const audio: Format = {
    itag: fmt.itag,
    lastModified: fmt.last_modified_ms,
    xtags: fmt.xtags,
  };

  const sabrStreamUrl = innertube.session.player.decipher(
    videoInfo.page[0].streaming_data?.server_abr_streaming_url,
  );
  const videoPlaybackUstreamerConfig =
    videoInfo.page[0].player_config?.media_common_config
      .media_ustreamer_request_config?.video_playback_ustreamer_config;

  if (!videoPlaybackUstreamerConfig)
    throw new Error("ustreamerConfig not found");

  if (!sabrStreamUrl) throw new Error("serverAbrStreamingUrl not found");

  const sabrStream = new ServerAbrStream({
    fetch: innertube.session.http.fetch_function,
    serverAbrStreamingUrl: sabrStreamUrl,
    videoPlaybackUstreamerConfig,
    durationMs: (videoInfo.basic_info.duration ?? 0) * 1000,
  });

  const readable = new PassThrough();

  sabrStream.on("data", (data) => {
    for (const formatData of data.initializedFormats) {
      if (formatData.mimeType?.includes("video")) continue;
      const media = formatData.mediaChunks;

      for (const chunk of media) {
        readable.write(chunk);
      }
    }
  });

  sabrStream.on("error", (err) => {
    if (onError) onError(err);
  });

  sabrStream.on("end", () => {
    readable.end();
  });

  sabrStream.init({
    audioFormats: [audio],
    videoFormats: [],
    clientAbrState: {
      startTimeMs: 0,
      mediaType: 1,
    },
  });

  return readable;
}
