import { Innertube } from "youtubei.js";
import type { InitOptions } from "../types";
import { BG, buildURL, GOOG_API_KEY, USER_AGENT } from "bgutils-js";
import { resetBotGuardState } from "./resetbot";
import { ensureDomEnvironment } from "./domenv";
import { YOUTUBE_REQUEST_KEY } from "../Constants";

export async function initializeBotGuard(innertube: Innertube, { forceRefresh }: InitOptions = {}): Promise<BG.WebPoMinter> {
    if (forceRefresh) resetBotGuardState();
    if (webPoMinter) return webPoMinter;
    if (initializationPromise) return await initializationPromise;

    const userAgent = innertube.session.context.client.userAgent || USER_AGENT;
    ensureDomEnvironment(userAgent);

    initializationPromise = (async (): Promise<BG.WebPoMinter> => {
        const challengeResponse = await innertube.getAttestationChallenge("ENGAGEMENT_TYPE_UNBOUND");
        const challenge = challengeResponse?.bg_challenge;

        if (!challenge) throw new Error("Failed to retrieve BotGuard challenge.");

        const interpreterUrl = challenge.interpreter_url?.private_do_not_access_or_else_trusted_resource_url_wrapped_value;

        if (!interpreterUrl) throw new Error("BotGuard challenge did not provide an interpreter URL.");

        if(!domWindow.document.getElementById(interpreterUrl)) {
            const interpreterResponse = await fetch(`https:${interpreterUrl}`, {
                headers: {
                    "user-agent": userAgent,
                },
            });

            const interpreterJavascript = await interpreterResponse.text();

            if (!interpreterJavascript) throw new Error("Failed to download BotGuard interpreter script.");

            const script = domWindow.document.createElement("script");
            script.type = "text/javascript";
            script.id = interpreterUrl;
            script.textContent = interpreterJavascript;
            domWindow.document.head.appendChild(script);
            activeScriptId = script.id;

            const executeInterpreter = new domWindow.Function(interpreterJavascript);
            executeInterpreter.call(domWindow);
        }

        botGuardClient = await BG.BotGuardClient.create({
            program: challenge.program,
            globalName: challenge.global_name,
            globalObj: globalThis,
        });

        const webPoSignalOutput = [];
        const botguardSnapshot = await botGuardClient.snapshot({ webPoSignalOutput });

        const integrityResponse = await fetch(buildURL("GenerateIT", true), {
            method: "POST",
            headers: {
                "content-type": "application/json+protobuf",
                "x-goog-api-key": GOOG_API_KEY,
                "x-user-agent": "grpc-web-javascript/0.1",
                "user-agent": userAgent,
            },
            body: JSON.stringify([ YOUTUBE_REQUEST_KEY, botguardSnapshot ]),
        });

        const integrityPayload = await integrityResponse.json();
        const integrityToken = integrityPayload?.[0];

        if (typeof integrityToken !== "string") throw new Error("BotGuard integrity token generation failed.");

        webPoMinter = await BG.WebPoMinter.create({ integrityToken }, webPoSignalOutput);

        return webPoMinter;
    })()
    .catch((error) => {
        resetBotGuardState();
        throw error;
    })
    .finally(() => {
        initializationPromise = null;
    });

    return await initializationPromise;
}