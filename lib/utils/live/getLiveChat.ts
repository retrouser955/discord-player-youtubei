import { YoutubeiExtractor } from "../../Extractor/Youtube";
import { LiveChat } from "./LiveChat";

const YOUTUBE_URL_REGEX = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(?:-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|live\/|v\/)?)([\w\-]+)(\S+)?$/

function parseYoutubeVideo(videoUrl: string) {
    if(!YOUTUBE_URL_REGEX.test(videoUrl)) throw new Error("This is not a valid video URL")

    const idExtractor = new URL(videoUrl)

    let id = idExtractor.searchParams.get("v")
    
    if(!id) id = videoUrl.split("/").at(-1)?.split("?").at(0)!

    return id
}

export async function getLiveChat(videoUrl: string, ext?: YoutubeiExtractor) {
    const instance = YoutubeiExtractor.instance ?? ext

    if(!instance) throw new Error("Invoked getLiveChat before player.extractors.register")

    const innertube = instance.innerTube

    const videoId = parseYoutubeVideo(videoUrl)

    const info = await innertube.getInfo(videoId)

    if(!info.basic_info.is_live) return null

    const chat = info.getLiveChat()

    chat.start()

    return new LiveChat(chat)
}