import type { DOMWindow } from "jsdom";
import { createCanvas, ImageData as CanvasImageData } from "@napi-rs/canvas";

export function patchCanvasSupport(window: DOMWindow): void {
    if (canvasPatched) return;
    
    const HTMLCanvasElement = window.HTMLCanvasElement;
    if (!HTMLCanvasElement) return;

    Object.defineProperty(HTMLCanvasElement.prototype, "_napiCanvasState", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: null,
    });

    HTMLCanvasElement.prototype.getContext = (type: string, options: CanvasRenderingContext2DSettings): any => {
        if(type !== "2d") return null;

        const width: number = Number.isFinite(this.width) && this.width > 0 ? this.width : 300;
        const height: number = Number.isFinite(this.height) && this.height > 0 ? this.height : 150;

        const state = this._napiCanvasState || {};

        if(!state.canvas) {
            state.canvas = createCanvas(width, height);
        } else if(state.canvas.width !== width || state.canvas.height !== height) {
            state.canvas.width = width;
            state.canvas.height = height;
        }

        state.context = state.canvas.getContext("2d", options);
        this._napiCanvasState = state;
        return state.context;
    }

    HTMLCanvasElement.prototype.toDataURL = (...args: [type?: string, quality?: number]): string => {
        if (!this._napiCanvasState?.canvas) {
            const width = Number.isFinite(this.width) && this.width > 0 ? this.width : 300;
            const height = Number.isFinite(this.height) && this.height > 0 ? this.height : 150;
            this._napiCanvasState = {
                canvas: createCanvas(width, height),
                context: null,
            };
        }

        return this._napiCanvasState.canvas.toDataURL(...args);
    }

    if(!window.ImageData) window.ImageData = CanvasImageData;

    if(!Reflect.has(globalThis, "ImageData")) {
        Object.defineProperty(globalThis, "ImageData", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: CanvasImageData,
        });
    }

    canvasPatched = true;
}