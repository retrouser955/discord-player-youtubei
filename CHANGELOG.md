# 1.2.x Change Logs

## Breaking changes

* Removed the ability to use raw oauth2 objects inside `authentication`
* Removed youtubei.js' cache system
* Removed `createYoutubeiStream` function

## None-breaking changes

* Implemented `bridge` method on `YoutubeiExtractor` allowing discord-player to bridge from other sources

## Features

* Added the ability to bridge from YouTube Music
* Added [live chat](./docs/GET_LIVE_CHAT.md)

## Internal Changes

* Upgraded youtubei.js to latest (^16.0.1)
