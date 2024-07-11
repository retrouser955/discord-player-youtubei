import type { Player } from "discord-player";
import Innertube, { UniversalCache } from "youtubei.js";

let innerTube: Innertube

export async function createInnertubeClient(player: Player) {
    if(innerTube) return innerTube
    innerTube = await Innertube.create({
        cache: new UniversalCache(true, `${__dirname}/.dpy`)
    })
    return innerTube
}