import { type OAuth2Tokens } from "youtubei.js";

export function objectToToken(tokens: OAuth2Tokens) {
    return Object.entries(tokens).map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString : v}`).join("; ")
}

export function tokenToObject(token: string): OAuth2Tokens {
    const kvPair = token.split("; ")
    const validKeys = ["access_token", 'expiry_date', 'expires_in', 'refresh_token', 'scope', 'token_type', 'client']
    // @ts-ignore
    let finalObject: OAuth2Tokens = {}
    for (let kv of kvPair) {
        const [key, value] = kv.split("=")
        if (!validKeys.includes(key)) continue;
        // @ts-expect-error
        finalObject[key as keyof OAuth2Tokens] = Number.isNaN(Number(value)) ? value : Number(value)
    }

    return finalObject
}