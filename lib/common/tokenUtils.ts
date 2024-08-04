import { type OAuth2Tokens } from "youtubei.js";

export function objectToToken(tokens: OAuth2Tokens) {
    return Object.entries(tokens).map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : v}`).join("; ")
}

export function tokenToObject(token: string): OAuth2Tokens {
    if(!token.includes("; ") || !token.includes("=")) throw new Error("Error: this is not a valid authentication token. Make sure you are putting the entire string instead of just what's behind access_token=")

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

    // perform final checks
    const requiredKeys = ['access_token', 'expiry_date', 'refresh_token']

    for(const key of requiredKeys) {
        if(!(key in finalObject)) throw new Error(`Error: Invalid authentication keys. Missing the required key ${key}. Make sure you are putting the entire string instead of just what's behind access_token=`)
    }

    return finalObject
}