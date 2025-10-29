import type { Player, Track } from "discord-player";
import type Innertube from "youtubei.js/agnostic";
import type { YoutubeiExtractor } from "../Extractor/Youtube";
import { extractVideoId } from "../common/extractVideoID";
import { PassThrough } from "node:stream";
import type { Format } from "youtubei.js/dist/src/parser/misc";

export async function getGoogleVideo() {
  try {
    return (await import("googlevideo")) as typeof import("googlevideo");
  } catch {
    throw new Error(
      "Unable to import GoogleVideo. Install it by running 'npm install googlevideo'",
    );
  }
}

export async function createServerAbrStream(
  track: Track,
  innertube: Innertube,
  ext: YoutubeiExtractor,
) {
  ext.context.player.debug("[YOUTUBE] Attempting to use Sabr for streaming");

  const isTrackCached =
    track.raw?.formats && Date.now() - track.raw?.formats.executedAt < 3.6e6;

  const { GoogleVideo } = await getGoogleVideo();
  if (!innertube.session.po_token)
    throw new Error("An PoToken must be present to use sabr stream");
  if (ext.options.streamOptions?.useClient !== "WEB")
    throw new Error("Sabr streaming only works on WEB client");

  let serverAbrStreamingUrl: string | undefined;
  let videoPlaybackUstreamerConfig: string | undefined;
  let format: Format;
  let durationMs: number;

  if (isTrackCached) {
    const trackData = track.raw?.formats as {
      fmt: Format;
      sabrUrl: string | undefined;
      uStreamConfig: string | undefined;
      durationMs: number;
    };

    serverAbrStreamingUrl = trackData.sabrUrl;
    videoPlaybackUstreamerConfig = trackData.uStreamConfig;
    format = trackData.fmt;
    durationMs = trackData.durationMs;
  } else {
    const videoId = extractVideoId(track.url);
    const basicInfo = await innertube.getBasicInfo(videoId);

    format = basicInfo.chooseFormat({
      quality: "best",
      format: "webm",
      type: "audio",
    });

    durationMs = (basicInfo.basic_info.duration ?? 0) * 1000;

    serverAbrStreamingUrl = await innertube.session.player?.decipher(
      basicInfo.page[0].streaming_data?.server_abr_streaming_url,
    );

    videoPlaybackUstreamerConfig =
      basicInfo.page[0].player_config?.media_common_config
        .media_ustreamer_request_config?.video_playback_ustreamer_config;
  }

  const selectedFormat: import("googlevideo").Format = {
    itag: format.itag,
    lastModified: format.last_modified_ms,
    xtags: format.xtags,
  };

  if (!serverAbrStreamingUrl)
    throw new Error("Unable to find the streaming url for server abr");

  if (!videoPlaybackUstreamerConfig)
    throw new Error(
      "Unable to find UstreamerConfig which is required for Sabr",
    );

  const sabrStream = new GoogleVideo.ServerAbrStream({
    fetch: innertube.session.http.fetch_function,
    serverAbrStreamingUrl,
    poToken: innertube.session.po_token!,
    durationMs,
    videoPlaybackUstreamerConfig,
  });

  const audioStream = new PassThrough();

  function serverAbrDataHandler(
    streamData: import("googlevideo").ServerAbrResponse,
  ) {
    const format = streamData.initializedFormats[0];

    if (!format) return;

    const chunks = format.mediaChunks;

    if (!chunks || chunks.length === 0) return;

    for (const chunk of chunks) {
      audioStream.write(chunk);
    }
  }

  sabrStream.on("data", serverAbrDataHandler);
  sabrStream.on("error", (message) => {
    console.log("[SERVER ABR STREAM ERR]");
    console.error(message);
  });

  await sabrStream.init({
    audioFormats: [selectedFormat],
    videoFormats: [],
    clientAbrState: {
      enabledTrackTypesBitfield: 1,
      playerTimeMs: 0,
    },
  });

  audioStream.on("end", () => {});

  return audioStream;
}
