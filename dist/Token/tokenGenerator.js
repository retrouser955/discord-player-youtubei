"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebPoMinter = getWebPoMinter;
exports.invalidateWebPoMinter = invalidateWebPoMinter;
const bgutils_js_1 = require("bgutils-js");
const jsdom_1 = require("jsdom");
const canvas_1 = require("@napi-rs/canvas");
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
let domWindow;
let initializationPromise = null;
let botguardClient;
let webPoMinter;
let activeScriptId = null;
let CanvasPatched = false;
function patchCanvasSupport(window) {
    if (CanvasPatched)
        return;
    const HTMLCanvasElement = window.HTMLCanvasElement;
    if (!HTMLCanvasElement)
        return;
    Object.defineProperty(HTMLCanvasElement.prototype, "_napiCanvasState", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: null,
    });
    HTMLCanvasElement.prototype.getContext = (type, options) => {
        if (type !== "2d")
            return null;
        const width = Number.isFinite(this.width) && this.width > 0 ? this.width : 300;
        const height = Number.isFinite(this.height) && this.height > 0 ? this.height : 150;
        const state = this._napiCanvasState || {};
        if (!state.canvas) {
            state.canvas = (0, canvas_1.createCanvas)(width, height);
        }
        else if (state.canvas.width !== width || state.canvas.height !== height) {
            state.canvas.width = width;
            state.canvas.height = height;
        }
        state.context = state.canvas.getContext("2d", options);
        this._napiCanvasState = state;
        return state.context;
    };
    HTMLCanvasElement.prototype.toDataURL = (...args) => {
        if (!this._napiCanvasState?.canvas) {
            const width = Number.isFinite(this.width) && this.width > 0 ? this.width : 300;
            const height = Number.isFinite(this.height) && this.height > 0 ? this.height : 150;
            this._napiCanvasState = {
                canvas: (0, canvas_1.createCanvas)(width, height),
                context: null,
            };
        }
        return this._napiCanvasState.canvas.toDataURL(...args);
    };
    if (!window.ImageData)
        window.ImageData = canvas_1.ImageData;
    if (!Reflect.has(globalThis, "ImageData")) {
        Object.defineProperty(globalThis, "ImageData", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: canvas_1.ImageData,
        });
    }
    CanvasPatched = true;
}
function ensureDomEnvironment(userAgent) {
    if (domWindow)
        return domWindow;
    const dom = new jsdom_1.JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
        url: "https://www.youtube.com/",
        referrer: "https://www.youtube.com/",
        userAgent,
    });
    domWindow = dom.window;
    const globalAssignments = {
        window: domWindow,
        document: domWindow.document,
        location: domWindow.location,
        origin: domWindow.origin,
        navigator: domWindow.navigator,
        HTMLElement: domWindow.HTMLElement,
        atob: domWindow.atob,
        btoa: domWindow.btoa,
        crypto: domWindow.crypto,
        performance: domWindow.performance,
    };
    for (const [key, value] of Object.entries(globalAssignments)) {
        if (!Reflect.has(globalThis, key)) {
            Object.defineProperty(globalThis, key, {
                configurable: true,
                enumerable: false,
                writable: true,
                value,
            });
        }
    }
    if (!Reflect.has(globalThis, "self")) {
        Object.defineProperty(globalThis, "self", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: globalThis,
        });
    }
    patchCanvasSupport(domWindow);
    return domWindow;
}
function resetBotGuardState() {
    if (botguardClient?.shutdown) {
        try {
            botguardClient.shutdown();
        }
        finally {
            // No actions needed
        }
    }
    if (activeScriptId && domWindow?.document)
        domWindow.document.getElementById(activeScriptId)?.remove();
    botguardClient = undefined;
    webPoMinter = undefined;
    activeScriptId = null;
    initializationPromise = null;
}
async function initializeBotGuard(innertube, { forceRefresh } = {}) {
    if (forceRefresh)
        resetBotGuardState();
    if (webPoMinter)
        return webPoMinter;
    if (initializationPromise)
        return await initializationPromise;
    const userAgent = innertube.session.context.client.userAgent || bgutils_js_1.USER_AGENT;
    ensureDomEnvironment(userAgent);
    initializationPromise = (async () => {
        const challengeResponse = await innertube.getAttestationChallenge("ENGAGEMENT_TYPE_UNBOUND");
        const challenge = challengeResponse?.bg_challenge;
        if (!challenge)
            throw new Error("Failed to retrieve BotGuard challenge.");
        const interpreterUrl = challenge.interpreter_url?.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
        if (!interpreterUrl)
            throw new Error("BotGuard challenge did not provide an interpreter URL.");
        if (!domWindow.document.getElementById(interpreterUrl)) {
            const interpreterResponse = await fetch(`https:${interpreterUrl}`, {
                headers: {
                    "user-agent": userAgent,
                },
            });
            const interpreterJavascript = await interpreterResponse.text();
            if (!interpreterJavascript)
                throw new Error("Failed to download BotGuard interpreter script.");
            const script = domWindow.document.createElement("script");
            script.type = "text/javascript";
            script.id = interpreterUrl;
            script.textContent = interpreterJavascript;
            domWindow.document.head.appendChild(script);
            activeScriptId = script.id;
            const executeInterpreter = new domWindow.Function(interpreterJavascript);
            executeInterpreter.call(domWindow);
        }
        botguardClient = await bgutils_js_1.BG.BotGuardClient.create({
            program: challenge.program,
            globalName: challenge.global_name,
            globalObj: globalThis,
        });
        const webPoSignalOutput = [];
        const botguardSnapshot = await botguardClient.snapshot({ webPoSignalOutput });
        const integrityResponse = await fetch((0, bgutils_js_1.buildURL)("GenerateIT", true), {
            method: "POST",
            headers: {
                "content-type": "application/json+protobuf",
                "x-goog-api-key": bgutils_js_1.GOOG_API_KEY,
                "x-user-agent": "grpc-web-javascript/0.1",
                "user-agent": userAgent,
            },
            body: JSON.stringify([REQUEST_KEY, botguardSnapshot]),
        });
        const integrityPayload = await integrityResponse.json();
        const integrityToken = integrityPayload?.[0];
        if (typeof integrityToken !== "string")
            throw new Error("BotGuard integrity token generation failed.");
        webPoMinter = await bgutils_js_1.BG.WebPoMinter.create({ integrityToken }, webPoSignalOutput);
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
function requireBinding(binding) {
    if (!binding)
        throw new Error("Content binding is required to mint a WebPo Token");
    return binding;
}
async function getWebPoMinter(innertube, options = {}) {
    const minter = await initializeBotGuard(innertube, options);
    return {
        generatePlaceholder(binding) {
            return bgutils_js_1.BG.PoToken.generateColdStartToken(requireBinding(binding));
        },
        async mint(binding) {
            return await minter.mintAsWebsafeString(requireBinding(binding));
        },
    };
}
function invalidateWebPoMinter() {
    resetBotGuardState();
}
