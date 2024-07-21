import { type OAuth2Tokens } from "youtubei.js"

export function getRandomOauthToken(tokens: OAuth2Tokens[]) {
    const randomInt = Math.round(Math.random() * (tokens.length - 1))

    return tokens[randomInt]
}