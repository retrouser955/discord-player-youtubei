export const youtubeMusicRegex = /^https:\/\/music\.youtube\.com\/(playlist|watch)\?/
export const youtubeMusicTrackRegex = /^https:\/\/music\.youtube\.com\/watch\?/
export const youtubeMusicPlaylistRegex = /^https:\/\/music\.youtube\.com\/playlist\?/

export type YTMuSearchQueryType = "search"|"playlist"|"track"|"unknown"

export function isURL(q: string) {
    try {
        new URL(q)
        return true
    } catch {
        return false
    }
}

export function isYoutubeMusic(query: string) {
    return isURL(query) && youtubeMusicRegex.test(query) && (query.includes("v=") || query.includes("list="))
}

export function extractSearchQueryType(query: string): YTMuSearchQueryType {
    if(!isURL(query)) return "search"
    if(youtubeMusicTrackRegex.test(query) && query.includes("v=")) return "track"
    if(youtubeMusicPlaylistRegex.test(query) && query.includes("list=")) return "playlist"
    return "unknown"
}