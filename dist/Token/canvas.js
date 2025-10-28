"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchCanvasSupport = patchCanvasSupport;
const canvas_1 = require("@napi-rs/canvas");
function patchCanvasSupport(window) {
    if (canvasPatched)
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
    canvasPatched = true;
}
