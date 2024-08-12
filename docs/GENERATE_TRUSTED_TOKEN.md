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
