# Discord Player Youtubei

Discord Player Youtubei is a youtube extractor for discord-player.

# Installation

## Extractorpack

We recommend setting up [extractorpack](github.com/discord-player/extractorpack/) for managing your extractors. See the link above for instructions on how to use it.

```bash
npx --no extractorpack add discord-player-youtubei
```

## Manual

You can install discord-player-youtubei via npm.

```bash
# npm
npm install discord-player-youtubei
# yarn
yarn add discord-player-youtubei
# pnpm
pnpm add discord-player-youtubei
# deno
deno add npm:discord-player-youtubei
```

## After installation

`discord-player-youtubei` relies heavily on [`simple-ytdl-core`](https://github.com/retrouser955/simple-ytdl-core) for its streaming functionality as well as [`bgutils-js@4`](https://github.com/LuanRT/BgUtils/) and [`googlevideo@4`](https://github.com/LuanRT/googlevideo/) for extracting YouTube tokens. These dependencies are intentionally kept as peer/dev dependency to allow the user to upgrade these without having to wait for an update on `discord-player-youtubei`. Install these packages prior by using the following.

```bash
# npm
npm install simple-ytdl-core bgutils-js googlevideo
# yarn 
yarn add simple-ytdl-core bgutils-js googlevideo
# pnpm
pnpm add simple-ytdl-core bgutils-js googlevideo
# deno
deno add npm:simple-ytdl-core npm:bgutils-js npm:googlevideo
```

*`discord-player-youtubei` is tested with the major version 4 of both `bgutils-js` and `googlevideo`. Other versions may not work as intended. However, any version of `simple-ytdl-core` will work as this was made explicitly for `discord-player-youtubei`*

# Registering

We strongly recommend using extractorpack to manage your extractors

## Registering via extractorpack

```js
// extractorpack.config.mjs
import { defineConfig } from "@extractorpack/extractorpack"

export default defineConfig({
    "discord-player-youtubei": {}
})
```

## Registering manually

```js
const { YoutubeExtractor } = require("discord-player-youtubei");

await player.extractors.register(YoutubeExtractor, {});
```

## Available Options

```ts
export interface YoutubeOptions {
    // override the streaming behavior of youtube extractor
    createStream?: (q: Track, ext: YoutubeExtractor) => Promise<string|Readable>;
    // disable player fetching
    disablePlayer?: boolean;
    // add cookies
    cookie?: string;
    // add proxy
    proxy?: ProxyAgent;
    // add peers.
    peer?: PeerOptions[];
}
```

# Development roadmap

- [x] Implement metadata fetching
- [x] Implement single video streaming
- [x] Implement SABR streaming for single videos
- [x] Implement yt-dlp fallback if installed
- [x] Implement live streaming
- [x] Add support for extractorpack
- [x] Implement streaming from peers

# Testing

`discord-player-youtubei` has been tested to be functioning with `discord-player@7.2.0`.