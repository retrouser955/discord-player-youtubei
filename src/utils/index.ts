import { ProxyAgent } from "undici";
import { YOUTUBE_REGEX } from "../Constants";
import type { PlaylistObj, YoutubeOptions } from "../types";
import Innertube, { Platform, Types, Player } from "youtubei.js";
import { once, PassThrough, Readable } from "node:stream";

let tube: Innertube|null = null;

export type ProxyAgentOptions = ProxyAgent.Options | string;

export function createProxy(options: ProxyAgentOptions): ProxyAgent {
    return new ProxyAgent(options);
}

export function buildVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildPlaylistUrl(playlistId: string, videoId?: string): string {
    return `https://www.youtube.com/playlist?list=${playlistId}${videoId ? `&v=${videoId}` : ""}`;
}

export function getVideoId(url: string): string {
    if (!YOUTUBE_REGEX.test(url)) throw new Error("Invalid Youtube Link.");

    let id = new URL(url).searchParams.get("v");
    if (!id) id = url.split("/").at(-1)?.split("?").at(0);

    return id;
}

export function getPlaylistId(url: string): PlaylistObj {
    const parsed = new URL(url);
    const playlistId = parsed.searchParams.get("list");
    const videoId = parsed.searchParams.get("v");

    return {
        playlistId,
        videoId,
        isMix: playlistId ? playlistId.startsWith("RD") : false,
    }
}

export function createYoutubeFetch(options?: YoutubeOptions): any {
    const f: typeof fetch = (input: URL | RequestInfo, init: RequestInit): Promise<Response> => {
        if (options?.proxy) {
            init ??= {};
            (init as any).dispatcher = options.proxy;
        }
        return Platform.shim.fetch(input, init);
    }

    return f;
}

export function toNodeReadable(stream: any): Readable | null {
    const nodeStream = new PassThrough();
    const reader = stream.getReader();

    (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    if (!nodeStream.write(Buffer.from(value))) await once(nodeStream, "drain");
                }
            }
        } finally {
            nodeStream.end();
        }
    })();

    return nodeStream;
}

export function isUrl(input: string) {
    try {
        const url = new URL(input);
        return ["http:", "https:"].includes(url.protocol);
    } catch (error) {
        return false;
    }
}

Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
    const properties = [];
    if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
    if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    return new Function(code)();
};

export async function getInnertube(options?: YoutubeOptions & { force?: boolean }): Promise<Innertube> {
    if (!tube) {
        tube = await Innertube.create({
            retrieve_player: !options?.disablePlayer,
            fetch: createYoutubeFetch(options),
            cookie: options.cookie ?? null,
        });
    }
    return tube;
}

export async function decipherLiveStreamUrl(url: string, player: Player, poToken: string): Promise<string> {
    const urlObject = new URL(url);
    
    if (urlObject.searchParams.size > 0) {
        urlObject.searchParams.set('pot', poToken);
        urlObject.searchParams.set('mpd_version', '7');

        return await player.decipher(urlObject.toString());
    }

    const pathPrefix = '/api/manifest/dash';

    const pathParts = urlObject.pathname
        .replace(pathPrefix, '')
        .split('/')
        .filter(part => part.length > 0);

    urlObject.pathname = pathPrefix;

    for (let i = 0; i + 1 < pathParts.length; i+=2) {
        urlObject.searchParams.set(pathParts[i], decodeURIComponent(pathParts[i+1]))
    }

    const deciphered = await player.decipher(urlObject.toString());
    const decipheredUrlObject = new URL(deciphered);

    for (const [key, value] of decipheredUrlObject.searchParams) {
        decipheredUrlObject.pathname += `/${key}/${encodeURIComponent(value)}`
    }

    decipheredUrlObject.search = ``;
    decipheredUrlObject.pathname += `/pot/${encodeURIComponent(poToken)}`;
    decipheredUrlObject.pathname += `/mpd_version/7`;

    return decipheredUrlObject.toString();
}