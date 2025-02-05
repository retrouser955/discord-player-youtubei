import type { Player, Track } from "discord-player";
import type Innertube from "youtubei.js/agnostic";
import type { YoutubeiExtractor } from "../Extractor/Youtube";
import { extractVideoId } from "../common/extractVideoID";
import { PassThrough } from "node:stream"

export async function getGoogleVideo() {
  try {
    return await import("googlevideo") as typeof import("googlevideo")
  } catch {
    throw new Error("Unable to import GoogleVideo. Install it by running 'npm install googlevideo'")
  }
}

export async function createServerAbrStream(track: Track, innertube: Innertube, ext: YoutubeiExtractor) {
  const { GoogleVideo } = await getGoogleVideo()
  if(!innertube.session.po_token) throw new Error("An PoToken must be present to use sabr stream")
  if(ext.options.streamOptions?.useClient !== "WEB") throw new Error("Sabr streaming only works on WEB client")
  const videoId = extractVideoId(track.url)
  const basicInfo = await innertube.getBasicInfo(videoId)

  const format = basicInfo.chooseFormat({ quality: "best", format: "webm", type: "audio" })

  const selectedFormat: import("googlevideo").Format = {
    itag: format.itag,
    lastModified: format.last_modified_ms,
    xtags: format.xtags
  }

  const serverAbrStreamingUrl = innertube.session.player?.decipher(basicInfo.page[0].streaming_data?.server_abr_streaming_url!)!
  const videoPlaybackUstreamerConfig = basicInfo.page[0].player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config!;
  const sabrStream = new GoogleVideo.ServerAbrStream({
    fetch: innertube.session.http.fetch_function,
    serverAbrStreamingUrl,
    poToken: innertube.session.po_token!,
    durationMs: basicInfo.basic_info.duration!,
    videoPlaybackUstreamerConfig
  })

  const audioStream = new PassThrough()
  
  function serverAbrDataHandler(streamData: import("googlevideo").ServerAbrResponse) {
    const format = streamData.initializedFormats[0]

    if(!format) return

    const chunks = format.mediaChunks

    if(!chunks || chunks.length === 0) return

    for(const chunk of chunks) {
      audioStream.write(chunk)
    }
  } 

  sabrStream.on("data", serverAbrDataHandler)

  sabrStream.on("end", function endHandler() {
    audioStream.end()
    // @ts-expect-error
    sabrStream.removeEventListener("data", serverAbrDataHandler)
    sabrStream.removeEventListener("end", endHandler)
  })

  await sabrStream.init({
    audioFormats: [selectedFormat],
    videoFormats: [],
    clientAbrState: {
      // @ts-expect-error
      enabledTrackTypesBitfield: 1,
      playerTimeMs: 0
    }
  })

  return audioStream
}
