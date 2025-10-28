"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDomEnvironment = ensureDomEnvironment;
const jsdom_1 = require("jsdom");
const canvas_1 = require("./canvas");
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
    (0, canvas_1.patchCanvasSupport)(domWindow);
    return domWindow;
}
