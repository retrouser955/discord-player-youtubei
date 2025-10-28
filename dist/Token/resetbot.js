"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetBotGuardState = resetBotGuardState;
async function resetBotGuardState() {
    if (botGuardClient?.shutdown) {
        try {
            await botGuardClient.shutdown();
        }
        finally {
            // no actions needed
        }
    }
    if (activeScriptId && domWindow?.document)
        domWindow.document.getElementById(activeScriptId)?.remove();
    botGuardClient = undefined;
    webPoMinter = undefined;
    activeScriptId = null;
    initializationPromise = null;
}
