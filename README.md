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

const player = useMainPlayer()

player.extractors.register(YoutubeiExtractor, {})
```

#### CommonJS

```ts
const { YoutubeiExtractor } = require("discord-player-youtubei")

const player = useMainPlayer()

player.extractors.register(YoutubeiExtractor, {})
```

## Signing into YouTube

First run the following command
```bash
$ npx --no dpy-generate-tokens
```

The token will be printed out shortly

```ts
import { YoutubeiExtractor } from "discord-player-youtubei"

const player = useMainPlayer()
const oauthTokens = getOauthTokens() // The tokens printed from step above

player.extractors.register(YoutubeiExtractor, {
    authentication: oauthTokens
})
```

## Options for YoutubeiExtractor

```ts
interface YoutubeiOptions {
    authentication?: OAuth2Tokens | string;
    overrideDownloadOptions?: DownloadOptions;
    createStream?: (q: Track, extractor: BaseExtractor<object>) => Promise<string | Readable>;
    signOutOnDeactive?: boolean;
    streamOptions?: {
        useClient?: InnerTubeClient;
    };
    cache?: {
        cacheDir?: string;
        enableCache?: boolean;
    };
}
```

## Using the bridge provider

Discord Player Youtubei provides a function that is supported by most of the default discord-player extractors. Here is an example using SpotifyExtractor

```ts
import { YoutubeiExtractor, createYoutubeiStream } from "discord-player-youtubei"
import { SpotifyExtractor } from "@discord-player/extractor"

const player = useMainPlayer()

await player.extractors.register(YoutubeiExtractor, {})
await player.extractors.register(SpotifyExtractor, {
    createStream: createYoutubeiStream
})
```

Notice how we are registering the YoutubeiExtractor before the Spotify extractor. This is because the `createYoutubeiStream` uses the `YoutubeiExtractor.instance` property which is only available after discord-player internally calls `<YoutubeiExtractor>.activate()`.

### Notice Regarding YouTube Streaming

Streaming from YouTube is against their Terms of Service (ToS). Refer to `LEGAL.md` to view the risks using YouTube.
