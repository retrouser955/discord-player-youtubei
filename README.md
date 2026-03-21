# Discord Player Youtubei

Discord Player Youtubei is a youtube extractor for discord-player.

# Installation

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

(comming soon)

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
    // override the download options passed to youtubei.js
    overrideDownloadOptions?: Types.DownloadOptions;
    // disable player fetching
    disablePlayer?: boolean;
    // add cookies
    cookie?: string;
    // add proxy. will be removed soon
    proxy?: ProxyAgent[];
    // add peers
    peer?: peerOptions[];
}
```

# Development roadmap

- [x] Implement metadata fetching
- [x] Implement single video streaming
- [x] Implement SABR streaming for single videos
- [ ] Implement yt-dlp fallback if installed
- [ ] Implement live streaming
- [ ] Implement live streaming for SABR
- [ ] Add support for extractorpack
- [ ] Add ability to change stream behavior using options
- [ ] Remove proxies
- [ ] Implement streaming from peers