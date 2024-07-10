import type { Player } from "discord-player";
import Innertube, { UniversalCache } from "youtubei.js";
import { Agent as HttpAgent } from "http";

let innerTube: Innertube

export async function createInnertubeClient(player: Player) {
    if(innerTube) return innerTube
    innerTube = await Innertube.create({
        cache: new UniversalCache(true, `${process.cwd()}/.dpy`),
        fetch: (i, init) => {
            const planner = player.routePlanner
            const agent = new HttpAgent({
                localAddress: planner ? planner.getIP().ip : undefined
            })

            return fetch(i, {
                ...init,
                // @ts-expect-error
                dispatcher: agent
            })
        }
    })
    return innerTube
}