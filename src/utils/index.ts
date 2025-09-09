import Innertube, { Platform } from "youtubei.js";
import { ProxyAgent } from "undici";
import { YoutubeOptions } from "../types";
import type { InnerTubeConfig } from "youtubei.js/dist/src/types";

export type ProxyAgentOptions = ProxyAgent.Options | string;

export function createProxy(options: ProxyAgentOptions) {
    return new ProxyAgent(options);
}

let tube: Innertube | null = null;

export function buildVideoUrl(id: string) {
    return `https://www.youtube.com/watch?v=${id}`;
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