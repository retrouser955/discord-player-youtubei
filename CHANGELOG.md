# 1.2.x Change Logs

## Breaking changes

* Removed the ability to use raw oauth2 objects inside `authentication`
* Removed youtubei.js' cache system
* Removed `createYoutubeiStream` function

## None-breaking changes

* Implemented `bridge` method on `YoutubeiExtractor` allowing discord-player to bridge from other sources

## Features

* Added the ability to [rotate authentication tokens](./Rotator.md)
* Added the ability to bridge from YouTube Music

## Internal Changes

* Upgraded youtubei.js to latest (10.2.0)