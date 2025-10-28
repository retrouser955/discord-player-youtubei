"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProxy = createProxy;
exports.buildVideoUrl = buildVideoUrl;
exports.buildPlaylistUrl = buildPlaylistUrl;
exports.getVideoId = getVideoId;
exports.getPlaylistId = getPlaylistId;
exports.createYoutubeFetch = createYoutubeFetch;
exports.createPeer = createPeer;
exports.toNodeReadable = toNodeReadable;
exports.isUrl = isUrl;
exports.getInnertube = getInnertube;
const undici_1 = require("undici");
const Constants_1 = require("../Constants");
const youtubei_js_1 = __importStar(require("youtubei.js"));
const node_stream_1 = require("node:stream");
function createProxy(options) {
    return new undici_1.ProxyAgent(options);
}
function buildVideoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}
function buildPlaylistUrl(playlistId, videoId) {
    return `https://www.youtube.com/playlist?list=${playlistId}${videoId ? `&v=${videoId}` : ""}`;
}
function getVideoId(url) {
    if (!Constants_1.YOUTUBE_REGEX.test(url))
        throw new Error("Invalid Youtube Link.");
    let id = new URL(url).searchParams.get("v");
    if (!id)
        id = url.split("/").at(-1)?.split("?").at(0);
    return id;
}
function getPlaylistId(url) {
    const parsed = new URL(url);
    const playlistId = parsed.searchParams.get("list");
    const videoId = parsed.searchParams.get("v");
    return {
        playlistId,
        videoId,
        isMix: playlistId ? playlistId.startsWith("RD") : false,
    };
}
function createYoutubeFetch(options) {
    const f = (input, init) => {
        if (options?.proxy) {
            init.dispatcher = options.proxy[Math.floor(Math.random() * options.proxy.length)];
        }
        return youtubei_js_1.Platform.shim.fetch(input, init);
    };
    return f;
}
function createPeer(option) {
    return {
        url: option.url,
        parse: option.parse || ((url, id) => `${url}/${id}`),
    };
}
function toNodeReadable(stream) {
    const nodeStream = new node_stream_1.PassThrough();
    const reader = stream.getReader();
    (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (value) {
                    if (!nodeStream.write(Buffer.from(value)))
                        await (0, node_stream_1.once)(nodeStream, "drain");
                }
            }
        }
        finally {
            nodeStream.end();
        }
    })();
    return nodeStream;
}
function isUrl(input) {
    try {
        const url = new URL(input);
        return ["http:", "https:"].includes(url.protocol);
    }
    catch (error) {
        return false;
    }
}
youtubei_js_1.Platform.shim.eval = async (data, env) => {
    const properties = [];
    if (env.n)
        properties.push(`n: exportedVars.nFunction("${env.n}")`);
    if (env.sig)
        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    return new Function(code)();
};
async function getInnertube(options) {
    if (tube && !options?.force)
        return tube;
    tube = await youtubei_js_1.default.create({
        retrieve_player: !options?.disablePlayer,
        fetch: createYoutubeFetch(options),
        cookie: options.cookie,
    });
    return tube;
}
