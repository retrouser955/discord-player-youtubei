import Innertube, { Platform, UniversalCache } from "youtubei.js";
import { ProxyAgent } from "undici";
import { YoutubeOptions } from "../types";
import type { InnerTubeConfig } from "youtubei.js/dist/src/types";

// New import from youtubei.js/web
import { Types } from "youtubei.js/web";

export type ProxyAgentOptions = ProxyAgent.Options | string;

export function createProxy(options: ProxyAgentOptions) {
    return new ProxyAgent(options);
}

let tube: Innertube | null = null;

export function buildVideoUrl(id: string) {
    return `https://www.youtube.com/watch?v=${id}`;
}

export function buildPlaylistUrl(id: string, vidId?: string) {
    return `https://www.youtube.com/playlist?list=${id}${vidId ? `&v=${vidId}` : ""}`;
}

export function getPlaylistId(url: string) {
    const parsed = new URL(url);
    const playlistId = parsed.searchParams.get("list");
    const videoId = parsed.searchParams.get("v");

    return {
        playlistId,
        videoId,
        isMix: playlistId ? playlistId.startsWith("RD") : false
    }
}

export function createYoutubeFetch(options?: YoutubeOptions) {
    const f: typeof fetch = (input, init) => {
        if(options?.proxy) {
            // @ts-expect-error
            init.dispatcher = options.proxy[Math.floor(Math.random() * options.proxy.length)];
        }
        return Platform.shim.fetch(input, init);
    }

    return f;
}

// Added this thingy here
Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
  const properties = [];
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
  return new Function(code)();
};

export async function getInnertube(options?: YoutubeOptions & { force?: boolean }) {
    if(tube && !options?.force) return tube;

    tube = await Innertube.create({
        retrieve_player: !options?.disablePlayer,
        fetch: createYoutubeFetch(options),
        cookie: options?.cookie
    })

    return tube
}

export interface PeerOptions {
    url: string;
    parse?: (url: string, youtubeId: string) => string;
}

export function createPeer(option: PeerOptions) {
    return {
        url: option.url,
        parse: option.parse || ((url, id) => `${url}/${id}`)
    } as PeerOptions;
}