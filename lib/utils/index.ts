import type { Player } from "discord-player";
import { Agent, type ProxyAgent } from "undici";
import { Platform } from "youtubei.js";

export * from "./live/getLiveChat";
export { LiveChatEvents } from "./live/LiveChat";
export { ChatMessageType } from "./live/LiveChatMessage";
export * from "./downloader/index";

export function defaultPeerUrlBuilder(url: string, id: string) {
    return `${url}/${id}`
}

export function defaultFetch(player: Player, input: RequestInfo | URL, init?: globalThis.RequestInit, proxy?: ProxyAgent) {
    let requestInit: globalThis.RequestInit = {
        ...init
    }

    if (proxy) {
        // @ts-expect-error
        requestInit.dispatcher = proxy

        return Platform.shim.fetch(input, requestInit)
    } else {
        try {
            const rotator = player.routePlanner?.getIP()
            if(rotator?.ip) {
                const dispatch = new Agent({
                    localAddress: rotator.ip
                })
    
                // @ts-expect-error
                requestInit.dispatcher = dispatch
            }
        } catch {
            // noop
        }

        return Platform.shim.fetch(input, requestInit)
    }
}