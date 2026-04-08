import { Constants, type YT, YTNodes } from "youtubei.js";
import type Innertube from "youtubei.js";
import { getVideoId, toNodeReadable } from "./common";
import { getWebPoMinter, invalidateWebPoMinter } from "../Token/tokenGenerator";
import { SabrFormat } from "googlevideo/shared-types";
import { SabrStream, SabrStreamConfig } from "googlevideo/sabr-stream";
import { buildSabrFormat } from "googlevideo/utils";
import { Readable } from "node:stream";
import { Track } from "discord-player";
import { SabrPlaybackOptions } from "googlevideo/sabr-stream";
import { cache } from "../Cache/DownloadCache";
import { EnabledTrackTypes } from "googlevideo/utils";
import { getInnertube } from "../utils";

export const DEFAULT_OPTIONS: SabrPlaybackOptions = {
    audioQuality: "AUDIO_QUALITY_MEDIUM",
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
}

export async function createSabrStream(video: Track): Promise<Readable | null> {
    let accountInfo: YT.AccountInfo | null;
    const innertube = await getInnertube();
    const videoId: string = getVideoId(video.url);
    let serverAbrStream: SabrStream;

    try {
        accountInfo = await innertube.account.getInfo();
    } catch (error) {
        accountInfo = null;
    }

    const dataSyncId = accountInfo?.contents?.contents[0]?.endpoint?.payload?.supportedTokens?.[2]?.datasyncIdToken?.datasyncIdToken ?? innertube.session.context.client.visitorData;
    const minter = await getWebPoMinter(innertube);
    const contentPoToken = await minter.mint(videoId);
    const poToken = await minter.mint(dataSyncId);

    try {
        const videoData = cache.get(cache.buildSabrCacheKey(videoId));
        let SabrStreamConfig: SabrStreamConfig;

        if (videoData) {
            SabrStreamConfig = {
                fetch: innertube.session.http.fetch_function,
                formats: videoData.sabrFormat,
                serverAbrStreamingUrl: videoData.url,
                videoPlaybackUstreamerConfig: videoData.uStreamConfig,
                poToken: poToken,
                clientInfo: {
                    clientName: parseInt(Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName]),
                    clientVersion: innertube.session.context.client.clientVersion,
                },
            }
        } else {
            const watchEndpoint = new YTNodes.NavigationEndpoint({ watchEndpoint: { videoId } });
            const playerResponse = await watchEndpoint.call(innertube.actions, {
                playbackContext: {
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

            if (!videoPlaybackUstreamerConfig) throw new Error("ustreamerConfig not found");
            if (!serverAbrStreamingUrl) throw new Error("serverAbrStreamingUrl not found");

            const sabrFormats: SabrFormat[] = playerResponse.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];

            SabrStreamConfig = {
                fetch: innertube.session.http.fetch_function,
                formats: sabrFormats,
                serverAbrStreamingUrl,
                videoPlaybackUstreamerConfig,
                poToken: poToken,
                clientInfo: {
                    clientName: parseInt(Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName]),
                    clientVersion: innertube.session.context.client.clientVersion,
                },
            }
        }
        serverAbrStream = new SabrStream(SabrStreamConfig);
    } catch (error) {
        console.error("[SabrStream Error] Error while creating SabrStream: ", error);
    }

    let protectionFailureCount = 0;
    let lastStatus = null;
    serverAbrStream.on("streamProtectionStatusUpdate", async (statusUpdate: any) => {
        if (statusUpdate.status !== lastStatus) lastStatus = statusUpdate.status;
        if (statusUpdate.status === 2) {
            protectionFailureCount = Math.min(protectionFailureCount + 1, 10);

            try {
                const rotationMinter = await getWebPoMinter(innertube, { forceRefresh: protectionFailureCount >= 3 });
                const placeholderToken = rotationMinter.generatePlaceholder(videoId);
                serverAbrStream.setPoToken(placeholderToken);
                const mintedPoToken = await rotationMinter.mint(videoId);
                serverAbrStream.setPoToken(mintedPoToken);
            } catch (error) {
                if (protectionFailureCount === 1 || protectionFailureCount % 5 === 0) console.error(`Failed to rotate PoToken: ${error}`);
            }
        } else if (statusUpdate.status === 3) {
            console.error("Stream protection rejected token (SPS 3). Resetting Botguard.");
            invalidateWebPoMinter();
        } else {
            protectionFailureCount = 0;
        }
    });

    const { audioStream } = await serverAbrStream.start(DEFAULT_OPTIONS);
    const nodeStream = toNodeReadable(audioStream);

    return nodeStream;
}