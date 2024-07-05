import Innertube, { UniversalCache } from "youtubei.js";

let innerTube: Innertube

export async function createInnertubeClient() {
    if(innerTube) return innerTube
    innerTube = await Innertube.create({
        cache: new UniversalCache(true, `${process.cwd()}/.dpy`)
    })
    return innerTube
}