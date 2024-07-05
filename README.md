# Discord Player YouTubei

This is a preview the v7 version of the YouTube system that discord-player will be using made backwards compatiable with v6.

## Installation

```bash
$ npm install discord-player-youtubei
# ----------- or -----------
$ yarn add discord-player-youtubei
```

## Usage

#### Typescript and ESM

```ts
import { YoutubeiExtractor } from "discord-player-youtubei"

const player = getPlayerSomehow()

player.extractors.register(YoutubeiExtractor, {})
```

#### CommonJS

```ts
const { YoutubeiExtractor } = require("discord-player-youtubei")

const player = getPlayerSomehow()

player.extractors.register(YoutubeiExtractor, {})
```

## Signing into YouTube

With the power of youtubei.js, we can sign into YouTube through their YouTube TV API.

```ts
import { generateOauthTokens } from "discord-player-youtubei";

(async () => {
    await generateOauthTokens()
})()
```

*Oauth Tokens will be printed out shortly*

These tokens can be used as an option for `YoutubeiExtractor`

```ts
import { YoutubeiExtractor } from "discord-player-youtubei"

const player = getPlayerSomehow()
const oauthTokens = getOauthTokens() // The tokens printed from `generateOauthTokens()

player.extractors.register(YoutubeiExtractor, {
    authentication: oauthTokens
})
```

## Options for YoutubeiExtractor

```ts
interface YoutubeiOptions {
    authentication?: OAuth2Tokens;
    overrideDownloadOptions?: DownloadOptions;
    createStream?: (q: string, extractor: BaseExtractor<object>) => Promise<string|Readable>;
    signOutOnDeactive?: boolean;
}
```

## Using the bridge provider

Discord Player Youtubei provides a function that is supported by most of the default discord-player extractors. Here is an example using SpotifyExtractor

```ts
import { YoutubeiExtractor, createYoutubeiStream } from "discord-player-youtubei"
import { SpotifyExtractor } from "@discord-player/extractor"

const player = getPlayerSomehow()

await player.extractors.register(YoutubeiExtractor, {})
await player.extractors.register(SpotifyExtractor, {
    createStream: createYoutubeiStream
})
```

Notice how we are registering the YoutubeiExtractor before the Spotify extractor. This is because the `createYoutubeiStream` uses the `YoutubeiExtractor.instance` property which is only available after discord-player internally calls `<YoutubeiExtractor>.activate()`.

### Notice Regarding YouTube Streaming

Streaming from YouTube is against their Terms of Service (ToS). Refer to `LEGAL.md` to view the risks using YouTube.