import { type BaseExtractor, QueryResolver, QueryType } from "discord-player";
import { YoutubeiExtractor } from "../Extractor/Youtube";
import { type Readable } from "node:stream"

export async function createYoutubeiStream(ext: BaseExtractor<Object>, url: string): Promise<string | Readable> {
    if(!YoutubeiExtractor.instance) throw new Error("Unable to find youtubei extractor. Register this first!")

    const queryType = QueryResolver.resolve(url).type
    const { tracks } = await ext.handle(url, {
        type: queryType
    })

    const track = tracks[0]

    const bridgedQuery = `${track.author} - ${track.title} audio`
    const { tracks: bridgedTracks } = await YoutubeiExtractor.instance.handle(bridgedQuery, {
        type: QueryType.YOUTUBE_SEARCH
    })

    return (await YoutubeiExtractor.instance._stream(bridgedTracks[0], YoutubeiExtractor.instance)) as string
}