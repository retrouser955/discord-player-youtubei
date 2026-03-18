var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/Streams/index.ts
var Streams_exports = {};
__export(Streams_exports, {
  createStreamFunction: () => createStreamFunction
});
module.exports = __toCommonJS(Streams_exports);
var import_youtubei3 = require("youtubei.js");

// src/Streams/AdaptiveStream.ts
var import_node_stream = require("stream");

// src/Constants/index.ts
var TEN_MB = 1048576 * 10;
var DEFAULT_EXPIRE_DURATION = 108e5 / 1e3;

// src/Streams/AdaptiveStream.ts
var import_youtubei = require("youtubei.js");
var AdaptiveStream = class extends import_node_stream.Readable {
  constructor(tube, url, cpn, size) {
    let isEnded = false;
    let start = 0;
    let end = Math.min(size, TEN_MB);
    let abortController;
    super({
      async read() {
        if (isEnded) return;
        if (end >= size) {
          isEnded = true;
          end = size;
        }
        abortController = new AbortController();
        const fUrl = `${url}&cpn=${cpn}&range=${start}-${end || ""}`;
        const getReq = await tube.session.http.fetch_function(fUrl, {
          headers: import_youtubei.Constants.STREAM_HEADERS,
          signal: abortController.signal
        });
        if (!getReq.body) throw new Error(`Downloading of video failed at ${start / size * 100}%`);
        for await (const chunk of import_youtubei.Utils.streamToIterable(getReq.body)) this.push(Buffer.from(chunk));
        if (isEnded) this.push(null);
        start = end + 1;
        end += TEN_MB;
      },
      destroy(error) {
        abortController?.abort(error);
      }
    });
  }
};

// src/Streams/ServerAbrStream.ts
var import_youtubei2 = require("youtubei.js");

// src/Streams/common.ts
var import_node_stream2 = require("stream");
var YOUTUBE_REGEX = /^https:\/\/(www\.)?youtu(\.be\/.{11}(.+)?|be\.com\/watch\?v=.{11}(&.+)?)/;
function getVideoId(url) {
  if (!YOUTUBE_REGEX.test(url)) throw new Error("Invalid Youtube Link.");
  let id = new URL(url).searchParams.get("v");
  if (!id) id = url.split("/").at(-1)?.split("?").at(0);
  return id;
}
function toNodeReadable(stream) {
  const nodeStream = new import_node_stream2.PassThrough();
  const reader = stream.getReader();
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          if (!nodeStream.write(Buffer.from(value))) await (0, import_node_stream2.once)(nodeStream, "drain");
        }
      }
    } finally {
      nodeStream.end();
    }
  })();
  return nodeStream;
}

// src/Streams/ServerAbrStream.ts
var import_sabr_stream = require("googlevideo/sabr-stream");
var import_utils = require("googlevideo/utils");
var import_utils2 = require("googlevideo/utils");
var DEFAULT_OPTIONS = {
  audioQuality: "AUDIO_QUALITY_MEDIUM",
  enabledTrackTypes: import_utils2.EnabledTrackTypes.AUDIO_ONLY
};
async function createSabrStream(innertube, webMinter, invMinter, video, cache) {
  let accountInfo;
  const videoId = getVideoId(video.url);
  let serverAbrStream;
  try {
    accountInfo = await innertube.account.getInfo();
  } catch (error) {
    accountInfo = null;
  }
  const dataSyncId = accountInfo?.contents?.contents[0]?.endpoint?.payload?.supportedTokens?.[2]?.datasyncIdToken?.datasyncIdToken ?? innertube.session.context.client.visitorData;
  const minter = await webMinter(innertube);
  const contentPoToken = await minter.mint(videoId);
  const poToken = await minter.mint(dataSyncId);
  try {
    const videoData = cache.get(cache.buildSabrCacheKey(videoId));
    let SabrStreamConfig2;
    if (videoData) {
      SabrStreamConfig2 = {
        formats: videoData.sabrFormat,
        serverAbrStreamingUrl: videoData.url,
        videoPlaybackUstreamerConfig: videoData.uStreamConfig,
        poToken,
        clientInfo: {
          clientName: parseInt(import_youtubei2.Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName]),
          clientVersion: innertube.session.context.client.clientVersion
        }
      };
    } else {
      const watchEndpoint = new import_youtubei2.YTNodes.NavigationEndpoint({ watchEndpoint: { videoId } });
      const playerResponse = await watchEndpoint.call(innertube.actions, {
        playbackContext: {
          contentPlaybackContext: {
            vis: 0,
            splay: false,
            lactMilliseconds: "-1",
            signatureTimestamp: innertube.session.player?.signature_timestamp
          }
        },
        contentCheckOk: true,
        racyCheckOk: true,
        serviceIntegrityDimensions: { poToken: contentPoToken },
        parse: true
      });
      const serverAbrStreamingUrl = await innertube.session.player?.decipher(playerResponse.streaming_data?.server_abr_streaming_url);
      const videoPlaybackUstreamerConfig = playerResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;
      if (!videoPlaybackUstreamerConfig) throw new Error("ustreamerConfig not found");
      if (!serverAbrStreamingUrl) throw new Error("serverAbrStreamingUrl not found");
      const sabrFormats = playerResponse.streaming_data?.adaptive_formats.map(import_utils.buildSabrFormat) || [];
      SabrStreamConfig2 = {
        formats: sabrFormats,
        serverAbrStreamingUrl,
        videoPlaybackUstreamerConfig,
        poToken,
        clientInfo: {
          clientName: parseInt(import_youtubei2.Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName]),
          clientVersion: innertube.session.context.client.clientVersion
        }
      };
    }
    serverAbrStream = new import_sabr_stream.SabrStream(SabrStreamConfig2);
  } catch (error) {
    console.error("[SabrStream Error] Error while creating SabrStream: ", error);
  }
  let protectionFailureCount = 0;
  let lastStatus = null;
  serverAbrStream.on("streamProtectionStatusUpdate", async (statusUpdate) => {
    if (statusUpdate.status !== lastStatus) lastStatus = statusUpdate.status;
    if (statusUpdate.status === 2) {
      protectionFailureCount = Math.min(protectionFailureCount + 1, 10);
      try {
        const rotationMinter = await webMinter(innertube, { forceRefresh: protectionFailureCount >= 3 });
        const placeholderToken = rotationMinter.generatePlaceholder(videoId);
        serverAbrStream.setPoToken(placeholderToken);
        const mintedPoToken = await rotationMinter.mint(videoId);
        serverAbrStream.setPoToken(mintedPoToken);
      } catch (error) {
        if (protectionFailureCount === 1 || protectionFailureCount % 5 === 0) console.error(`Failed to rotate PoToken: ${error}`);
      }
    } else if (statusUpdate.status === 3) {
      console.error("Stream protection rejected token (SPS 3). Resetting Botguard.");
      invMinter();
    } else {
      protectionFailureCount = 0;
    }
  });
  const { audioStream } = await serverAbrStream.start(DEFAULT_OPTIONS);
  const nodeStream = toNodeReadable(audioStream);
  return nodeStream;
}

// src/Streams/index.ts
var wait = (ms) => new Promise((res) => setInterval(res, ms));
var RELIABLE_CLIENTS = [
  {
    client: "ANDROID_VR",
    requirePoToken: false,
    requireDecipher: false
  },
  {
    client: "MWEB",
    requirePoToken: true,
    requireDecipher: true
  },
  {
    client: "WEB_EMBEDDED",
    requirePoToken: true,
    requireDecipher: true
  }
];
var RELIABLE_CLIENTS_STR = ["ANDROID_VR", "MWEB", "WEB_EMBEDDED"];
async function createAdaptiveStream(video, tube, cache, getMinter) {
  const itemKey = cache.buildAdaptiveCacheKey(getVideoId(video.url));
  const item = cache.get(itemKey);
  if (item && RELIABLE_CLIENTS_STR.includes(item.client)) {
    return new AdaptiveStream(tube, item.url, item.cpn, item.size);
  }
  let poToken = void 0;
  let firstRun = true;
  for (const client of RELIABLE_CLIENTS) {
    if (!firstRun) {
      await wait(500);
    } else {
      firstRun = false;
    }
    try {
      if (client.requirePoToken && !poToken) {
        const accountInfo = await tube.account.getInfo();
        const dataSyncId = accountInfo?.contents?.contents[0]?.endpoint?.payload?.supportedTokens?.[2]?.datasyncIdToken?.datasyncIdToken ?? tube.session.context.client.visitorData;
        const minter = await getMinter(tube);
        poToken = await minter.mint(dataSyncId);
      }
      const info = await tube.getBasicInfo(getVideoId(video.url), {
        client: client.client,
        po_token: poToken
      });
      const format = info.chooseFormat({
        format: "any",
        quality: "best",
        type: "audio",
        po_token: poToken
      });
      if (!format.url || !format.content_length) continue;
      const url = client.requireDecipher ? await format.decipher(tube.session.player) : format.url;
      const willGoThrough = await tube.session.http.fetch_function(url, {
        headers: import_youtubei3.Constants.STREAM_HEADERS,
        method: "HEAD"
      });
      if (!willGoThrough.ok) continue;
      const stream = new AdaptiveStream(tube, url, info.cpn, format.content_length);
      return stream;
    } catch {
      continue;
    }
  }
}
function createStreamFunction(innertube, cache, getMinter, invMinter) {
  return async (info) => {
    try {
      const stream = await createAdaptiveStream(info, innertube, cache, getMinter);
      return stream;
    } catch {
    }
    try {
      const stream = createSabrStream(innertube, getMinter, invMinter, info, cache);
      return stream;
    } catch {
    }
  };
}
