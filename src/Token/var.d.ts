import type { BG } from "bgutils-js";
import type { DOMWindow } from "jsdom";
import Innertube from "youtubei.js";

declare global {
    var domWindow: DOMWindow;
    var initializationPromise: Promise<BG.WebPoMinter> | null = null;
    var botGuardClient: BG.BotGuardClient;
    var webPoMinter: BG.WebPoMinter;
    var activeScriptId: string | null;
    var canvasPatched: boolean = false;
}