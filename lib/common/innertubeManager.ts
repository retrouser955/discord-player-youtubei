import Innertube, { Session, type OAuth2Tokens, type InnertubeConfig } from "youtubei.js";

let innertube: Innertube

export async function getInnertube(options: Omit<InnertubeConfig, "retrieve_player"> = {}, disablePlayer: boolean = false) {
    if(!innertube) {
        innertube = await Innertube.create({
			retrieve_player: disablePlayer == undefined ? true : !disablePlayer,
			...(options || {})
		})
    }

    return innertube
}

export async function refreshInnertube(currentTokens: OAuth2Tokens, onInnertubeTokensUpdate: (tokens: OAuth2Tokens) => any) {
    if(!innertube) return null

    const preservedSession = new Session(
        innertube.session.context,
        innertube.session.key,
        innertube.session.api_version,
        innertube.session.account_index,
        innertube.session.player,
        undefined,
        innertube.session.http.fetch,
        innertube.session.cache
    )

    if(innertube.session.logged_in) {
        if(innertube.session.oauth.shouldRefreshToken()) await innertube.session.oauth.refreshAccessToken()

        const previousExpiary = new Date(currentTokens.expiry_date).getTime()
        const newTokens = new Date(innertube.session.oauth.oauth2_tokens!.expiry_date).getTime()
    
        if(previousExpiary !== newTokens) {
            onInnertubeTokensUpdate(innertube.session.oauth.oauth2_tokens!)
        }
    }

    innertube = new Innertube(preservedSession)

    return innertube
}