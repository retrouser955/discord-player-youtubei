# Getting the live chat of a live video

discord-player-youtubei random functions that is used for all sorts of stuff. Live chat is one of them.

```ts
import { getLiveChat, LiveChatEvents, ChatMessageType } from "discord-player-youtubei"

const chat = await getLiveChat("videourl") // must be live video. or else it will throw an error

chat.on(LiveChatEvents.MessageCreate, (message) => {
    if(message.type === ChatMessageType.Regular || message.type === ChatMessageType.Premium) {
        console.log(`[${message.author.username}] ${message.content})`)
    }
})
```

As you can see, the live chat API tries to act closely to discord.js' event systems to implement easy access to its users.

If you finally want to stop listening to chat events, you can implement `chat.destroy()`.