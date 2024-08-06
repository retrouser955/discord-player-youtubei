import { TypedEmitter } from "tiny-typed-emitter";
import { type VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import { ChatMessageType, LiveChatMessage } from "./LiveChatMessage";
import { YTNodes } from "youtubei.js";
import type { ChatAction } from "youtubei.js/dist/src/parser/youtube/LiveChat";

export enum LiveChatEvents {
    MessageCreate = "messageCreate"
}

export interface LiveChatEventsData {
    [LiveChatEvents.MessageCreate]: (message: LiveChatMessage) => void
}

export class LiveChat extends TypedEmitter<LiveChatEventsData> {
    chat: ReturnType<typeof VideoInfo['prototype']['getLiveChat']>

    // this is scuffed but i cant access 'this' inside other non-arrow functions
    chatUpdateHandler = (action: ChatAction) => {
        if(action.is(YTNodes.AddChatItemAction)) {
            const { item } = action.as(YTNodes.AddChatItemAction)

            switch(item.type) {
                case "LiveChatTextMessage": {
                    this.emit(LiveChatEvents.MessageCreate, new LiveChatMessage(item, ChatMessageType.Regular))
                    break;
                }
                case "LiveChatPaidMessage": {
                    this.emit(LiveChatEvents.MessageCreate, new LiveChatMessage(item, ChatMessageType.Premium))
                    break;
                }
                case "LiveChatPaidSticker": {
                    this.emit(LiveChatEvents.MessageCreate, new LiveChatMessage(item, ChatMessageType.PremiumSticker))
                    break;
                }
                default: {
                    // noop
                    break;
                }
            }
        }
    }

    constructor(chat: ReturnType<typeof VideoInfo['prototype']['getLiveChat']>) {
        super()

        chat.on("chat-update", this.chatUpdateHandler)

        this.chat = chat
    }

    destroy() {
        this.chat.off("chat-update", this.chatUpdateHandler)

        this.chat.stop()
    }
}