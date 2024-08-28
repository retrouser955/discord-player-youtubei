# Generating trusted token from YouTube

YouTube now requires a po_token to be present when using the ANDROID and WEB clients that requires a full browser or the YouTube Android app to generate. `discord-player-youtubei` provides a way to generate this token using puppeteer. For space reasons, `puppeteer` is not install by default. To use the function exported by `discord-player-youtubei`, you need to install puppeteer.

```bash
$ npm install puppeteer
# -------- or --------
$ yarn add puppeteer
```

Keep in mind, this will also install Chromium which will add about 50mb to your project.

Finally, you can run this function

```ts
import { generateTrustedToken } from "discord-player-youtubei"

const { poToken, visitorData } = await generateTrustedToken()
```

This is a trusted token issued to botguard from YouTube thus it will only be valid for the WEB client. Make sure you are using the WEB client if you are trusted to set the PoToken

```ts
import { generateTrustedToken, YoutubeiExtractor } from "discord-player-youtubei"

const tokens = await generateTrustedToken()

await player.extractors.register(YoutubeiExtractor, {
    streamOptions: {
        useClient: "WEB"
    },
    trustedTokens: tokens
})
```

These tokens will expire every 1-2 weeks so it is recommended to keep refreshing it every week. You can either set up your own cron job or use the built-in `generateTrustedTokenInterval()` function which generates a token every week.

Looks a bit like this

```ts
import { generateTrustedToken, generateTrustedTokenInterval, YoutubeiExtractor } from "discord-player-youtubei"

const tokens = await generateTrustedToken()

await player.extractors.register(YoutubeiExtractor, {
    streamOptions: {
        useClient: "WEB"
    },
    trustedTokens: tokens
})

// By default, the function will run once a week. To modify this, you can set the `interval` to a number in milliseconds
// Keep in mind, this is NOT a silver bullet.
// Use a package like [node-cron](https://www.npmjs.com/package/node-cron) to properly schedule your PoToken generation crons.
const cronJob = generateTrustedTokenInterval({
    onGenerate: (tokens) => {
        const instance = YoutubeiExtractor.getInstance() // gets the current instance of YoutubeiExtractor

        instance.setTrustedTokens(tokens) // set the trusted tokens for the current instance
    },
    onError: (err) => {
        console.log(err)
    }
})

cronJob.background() // place it in the background of your process.
```

You can also directly set the PoToken while the process is running like this

```ts
import { YoutubeiExtractor } from "discord-player-youtubei"

const currentInstance = YoutubeiExtractor.getInstance();

const tokens = await generateTrustedToken()

currentInstance.setTrustedTokens(tokens)
```

This will clone the current YouTube session with the new trusted poToken

# Best Practices

Since it is running puppeteer, it will be very CPU and RAM heavy. Thus, it is recommended to run this process inside a worker. Refer to [this example](../examples/trustedToken/) for more info.

# Types

## GeneratorReturnData

| name | type | description | required |
| ---- | ---- | ----------- | -------- |
| visitorData | string | The visitor data that YouTube returns | true |
| poToken | string | The current trusted token of YouTube | true |