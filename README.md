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