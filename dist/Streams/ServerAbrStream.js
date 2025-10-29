"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSabrStream = createSabrStream;
const youtubei_js_1 = require("youtubei.js");
const utils_1 = require("../utils");
const tokenGenerator_1 = require("../Token/tokenGenerator");
const sabr_stream_1 = require("googlevideo/sabr-stream");
const utils_2 = require("googlevideo/utils");
const Constants_1 = require("../Constants");
async function createSabrStream(videoId, options) {
    const innertube = await (0, utils_1.getInnertube)(options);
    let accountInfo;
    try {
        accountInfo = await innertube.account.getInfo();
    }
    catch (error) {
        accountInfo = null;
    }
    const dataSyncId = accountInfo?.contents?.contents[0]?.endpoint?.payload?.supportedTokens?.[2]?.datasyncIdToken?.datasyncIdToken ?? innertube.session.context.client.visitorData;
    const minter = await (0, tokenGenerator_1.getWebPoMinter)(innertube);
    const contentPoToken = await minter.mint(videoId);
    const poToken = await minter.mint(dataSyncId);
    const watchEndpoint = new youtubei_js_1.YTNodes.NavigationEndpoint({ watchEndpoint: { videoId } });
    const playerResponse = await watchEndpoint.call(innertube.actions, {
        playbackContext: {
            adPlaybackContext: { pyv: true },
            contentPlaybackContext: {
                vis: 0,
                splay: false,
                lactMilliseconds: "-1",
                signatureTimestamp: innertube.session.player?.signature_timestamp,
            },
        },
        contentCheckOk: true,
        racyCheckOk: true,
        serviceIntegrityDimensions: { poToken: contentPoToken },
        parse: true,
    });
    const serverAbrStreamingUrl = await innertube.session.player?.decipher(playerResponse.streaming_data?.server_abr_streaming_url);
    const videoPlaybackUstreamerConfig = playerResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;
    if (!videoPlaybackUstreamerConfig)
        throw new Error("ustreamerConfig not found");
    if (!serverAbrStreamingUrl)
        throw new Error("serverAbrStreamingUrl not found");
    const sabrFormats = playerResponse.streaming_data?.adaptive_formats.map(utils_2.buildSabrFormat) || [];
    const SabrStreamConfig = {
        formats: sabrFormats,
        serverAbrStreamingUrl,
        videoPlaybackUstreamerConfig,
        poToken: poToken,
        clientInfo: {
            clientName: parseInt(youtubei_js_1.Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName]),
            clientVersion: innertube.session.context.client.clientVersion,
        },
    };
    const serverAbrStream = new sabr_stream_1.SabrStream(SabrStreamConfig);
    let protectionFailureCount = 0;
    let lastStatus = null;
    serverAbrStream.on("streamProtectionStatusUpdate", async (statusUpdate) => {
        if (statusUpdate.status !== lastStatus)
            lastStatus = statusUpdate.status;
        if (statusUpdate.status === 2) {
            protectionFailureCount = Math.min(protectionFailureCount + 1, 10);
            try {
                const rotationMinter = await (0, tokenGenerator_1.getWebPoMinter)(innertube, { forceRefresh: protectionFailureCount >= 3 });
                const placeholderToken = rotationMinter.generatePlaceholder(videoId);
                serverAbrStream.setPoToken(placeholderToken);
                const mintedPoToken = await rotationMinter.mint(videoId);
                serverAbrStream.setPoToken(mintedPoToken);
            }
            catch (error) {
                if (protectionFailureCount === 1 || protectionFailureCount % 5 === 0)
                    console.error(`Failed to rotate PoToken: ${error}`);
            }
        }
        else if (statusUpdate.status === 3) {
            console.error("Stream protection rejected token (SPS 3). Resetting Botguard.");
            (0, tokenGenerator_1.invalidateWebPoMinter)();
        }
        else {
            protectionFailureCount = 0;
        }
    });
    const { audioStream } = await serverAbrStream.start(Constants_1.DEFAULT_OPTIONS);
    const nodeStream = (0, utils_1.toNodeReadable)(audioStream);
    return nodeStream;
}
