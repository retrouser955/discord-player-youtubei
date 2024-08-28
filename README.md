# Discord Player YouTubei

This is a preview the v7 version of the YouTube system that discord-player will be using made backwards compatiable with v6.

* Warning: the documentation on GitHub is for the edge version of this package. Refer to [this](#something-isnt-working) for more information

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

const player = useMainPlayer() // or new Player()

player.extractors.register(YoutubeiExtractor, {})
```

#### CommonJS

```ts
const { YoutubeiExtractor } = require("discord-player-youtubei")

const player = useMainPlayer() // or new Player()

player.extractors.register(YoutubeiExtractor, {})
```

*I have seen many people registering the extractor in their commands. DO NOT DO THIS*

## How Discord Player Youtubei handles bridging

As of `1.2.1`, discord-player-youtubei will detect if you are signed in or not and will use YouTube music streaming system. If this is not available, the extractor will use normal YouTube.

You can override this behavior using the `overrideBridgeMode` option. See the extractor options below for more information regarding the types

## Signing into YouTube

First run the following command
```bash
$ npx --no discord-player-youtubei
```

The token will be printed out shortly

*In case of errors, you can directly run the `generateOauthTokens` function exported by discord-player-youtubei*

```ts
import { YoutubeiExtractor } from "discord-player-youtubei"

const player = useMainPlayer()
/**
 * getOauthTokens is not a real function exported by discord-player-youtubei.
 * It is simply a placeholder for the actual oauth tokens
 * 
 * Do not just put in access token. Put in the entire string.
 */
const oauthTokens = getOauthTokens() // The tokens printed from step above

player.extractors.register(YoutubeiExtractor, {
    authentication: oauthTokens
})
```

## Types

#### StreamOptions

| name | type | description | required |
| ---- | ---- | ----------- | -------- |
| useClient | [InnerTubeClient](https://github.com/LuanRT/YouTube.js/blob/main/src/Innertube.ts#L49) | Which client to get the stream from | false |
| highWaterMark | number | How many bytes the stream can hold. The more bytes allocated, the smoother the stream at the cost of more memory usage | false |

#### YoutubeiOptions

| name | type | description |
| ---- | ---- | ----------- |
| authentication | string | [The auth token](#signing-into-youtube) |
| overrideDownloadOptions | [DownloadOptions](https://github.com/LuanRT/YouTube.js/blob/main/src/types/FormatUtils.ts#L29) | Override the default download options |
| createStream | fn ([q](https://discord-player.js.org/docs/discord-player/class/Track), [ext](https://discord-player.js.org/docs/discord-player/class/BaseExtractor)): Promise<string\|Readable> | Override the streaming function |
| signOutOnDeactive | boolean | Revoke the tokens after deactivation |
| overrideBridgeMode | "ytmusic" or "yt" | Override the bridging behavior |
| streamOptions | [StreamOptions](#streamoptions) | Configure streaming behavior |
| disablePlayer | boolean | Disable the JavaScript player. Use ANDORID client for streaming when using this |
| innertubeConfigRaw | [InntertubeConfigRaw](https://github.com/LuanRT/YouTube.js/blob/main/src/core/Session.ts#L109) | Options passed to <Innertube>.create() |
| trustedTokens | [TrustedTokenConfig](#trustedtokenconfig) | The trusted tokens passed to YouTube to avoid bans |
| cookie | string | The cookies passed to innertube similar to ytdl cookies |

### TrustedTokenConfig

*Rename of [`GeneratorReturnData`](./docs/GENERATE_TRUSTED_TOKEN.md#generatorreturndata)*  
*All properties are required*

| name | type | description |
| ---- | ---- | ----------- |
| visitorData | string | The visitor data of the PoToken |
| poToken | string | The trusted token of the YouTube client |

## Raw Types

```ts
interface YoutubeiOptions {
	authentication?: string;
	overrideDownloadOptions?: DownloadOptions;
	createStream?: (q: Track, extractor: BaseExtractor<object>) => Promise<string | Readable>;
	signOutOnDeactive?: boolean;
	streamOptions?: StreamOptions;
	overrideBridgeMode?: "ytmusic" | "yt";
	disablePlayer?: boolean;
	ignoreSignInErrors?: boolean;
	innertubeConfigRaw?: Omit<Omit<Omit<InnertubeConfig, "retrieve_player">, "visitor_data">, "cookie">;
	trustedTokens?: TrustedTokenConfig;
	cookie?: string;
}
```

## Functions

| class | function | params | static | description |
| ----- | -------- | ------ | ------ | ----------- |
| YoutubeiExtractor | setClientMode | [InnerTubeClient](https://github.com/LuanRT/YouTube.js/blob/main/src/Innertube.ts#L49) | true | Set the innertube client on the fly |

## Something isn't working?

Try installing an alpha or a beta build using `npm install discord-player-youtubei@alpha` or `npm install discord-player-youtubei@beta`. If no beta has been released, you can test the edge version by installing directly from github using `npm install github:retrouser955/discord-player-youtubei --save` If this still does not work or you installed a version that is lower than the main version, feel free to open an issue on our [GitHub page](https://github.com/retrouser955/discord-player-youtubei/issues)

If you know how to fix it, please clone this repository and send us a pull request. As this is an open source project, any contributions are welcome!

### Want to support us?

Just star this repo!

### Notice Regarding YouTube Streaming

Streaming from YouTube is against their Terms of Service (ToS). Refer to [`LEGAL.md`](./LEGAL.md) to view the risks using YouTube.
