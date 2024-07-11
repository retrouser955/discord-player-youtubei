import type { Player } from "discord-player";
import Innertube, { UniversalCache } from "youtubei.js";
import { Agent } from "undici"

let innerTube: Innertube

export async function createInnertubeClient(player: Player) {
    if(innerTube) return innerTube
    innerTube = await Innertube.create({
        cache: new UniversalCache(true, `${__dirname}/.dpy`),
        fetch: (i, init) => {
            const planner = player.routePlanner

            return fetch(i.toString(), {
                ...init,
                // @ts-expect-error,
                dispatcher: new Agent({
                    localAddress: planner?.getIP().ip ?? undefined
                })
            })
        }
    })
    return innerTube
}