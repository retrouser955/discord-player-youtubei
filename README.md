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
const oauthTokens = getOauthTokens() // The tokens printed from step above

player.extractors.register(YoutubeiExtractor, {
    authentication: oauthTokens
})
```

## Rotating your token

Since Youtube has a hard limt (which is not that strict), we can provide a rotator config when registering the extractor. View [Rotator](./Rotator.md)

## Types

#### RotatorShardOptions

| name | type | required |
| ---- | ---- | -------- |
| authentications | Array of string | true |
| rotationStrategy | "shard" | true |
| currentShard | number | true |

#### RotatorRandomOptions

| name | type | required |
| ---- | ---- | -------- |
| authentications | Array of string | true |
| rotationStrategy | "random" | true |

#### RotatorConfig

```ts
type RotatorConfig = RotatorShardOptions | RotatorRandomOptions
```

#### StreamOptions

| name | type | description | required |
| ---- | ---- | ----------- | -------- |
| useClient | [InnerTubeClient](https://github.com/LuanRT/YouTube.js/blob/main/src/Innertube.ts#L49) | Which client to get the stream from | false |

#### YoutubeiOptions

| name | type | description |
| ---- | ---- | ----------- |
| authentication | string | [The auth token](#signing-into-youtube) |
| overrideDownloadOptions | [DownloadOptions](https://github.com/LuanRT/YouTube.js/blob/main/src/types/FormatUtils.ts#L29) | Override the default download options |
| createStream | fn ([q](https://discord-player.js.org/docs/discord-player/class/Track), [ext](https://discord-player.js.org/docs/discord-player/class/BaseExtractor)): Promise<string\|Readable> | Override the streaming function |
| signOutOnDeactive | boolean | Revoke the tokens after deactivation |
| rotator | [RotatorConfig](#rotatorconfig) | The config of the rotator |
| overrideBridgeMode | "ytmusic" or "yt" | Override the bridging behavior |
| streamOptions | [StreamOptions](#streamoptions) | Configure streaming behavior |
| disablePlayer | boolean | Disable the JavaScript player. Use ANDORID client for streaming when using this |

## Raw Types

```ts
interface RotatorShardOptions {
	authentications: string[];
	rotationStrategy: "shard";
	currentShard: number;
}

interface RotatorRandomOptions {
	authentications: string[];
	rotationStrategy: "random";
}

type RotatorConfig = RotatorShardOptions | RotatorRandomOptions

interface YoutubeiOptions {
	authentication?: string;
	overrideDownloadOptions?: DownloadOptions;
	createStream?: (q: Track, extractor: BaseExtractor<object>) => Promise<string | Readable>;
	signOutOnDeactive?: boolean;
	streamOptions?: {
		useClient?: InnerTubeClient
	};
	rotator?: RotatorConfig;
	overrideBridgeMode?: "ytmusic" | "yt"
}
```

## Functions

| class | function | params | static | description |
| ----- | -------- | ------ | ------ | ----------- |
| YoutubeiExtractor | setClientMode | [InnerTubeClient](https://github.com/LuanRT/YouTube.js/blob/main/src/Innertube.ts#L49) | true | Set the innertube client on the fly |

### Want to support us?

Just star this repo!

### Notice Regarding YouTube Streaming

Streaming from YouTube is against their Terms of Service (ToS). Refer to [`LEGAL.md`](./LEGAL.md) to view the risks using YouTube.
