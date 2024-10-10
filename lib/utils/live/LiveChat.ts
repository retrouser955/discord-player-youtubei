import { TypedEmitter } from "tiny-typed-emitter";
import { type VideoInfo } from "youtubei.js/dist/src/parser/youtube";
import { ChatMessageType, LiveChatMessage } from "./LiveChatMessage";
import { YTNodes } from "youtubei.js";
import type { ChatAction } from "youtubei.js/dist/src/parser/youtube/LiveChat";

export const LiveChatEvents = {
  MessageCreate: "messageCreate",
  StreamEnd: "streamEnd",
} as const;

type LiveChatReturnType = ReturnType<
  (typeof VideoInfo)["prototype"]["getLiveChat"]
>;

export type LiveChatEvents =
  (typeof LiveChatEvents)[keyof typeof LiveChatEvents];

export interface LiveChatEventsData {
  [LiveChatEvents.MessageCreate]: (message: LiveChatMessage) => any;
  [LiveChatEvents.StreamEnd]: () => any;
}

export class LiveChat {
  chat: ReturnType<(typeof VideoInfo)["prototype"]["getLiveChat"]>;
  #eventEmitter = new TypedEmitter<LiveChatEventsData>();

  #hasListener: Record<LiveChatEvents, boolean> = {
    [LiveChatEvents.MessageCreate]: false,
    [LiveChatEvents.StreamEnd]: false,
  };

  // this is scuffed but i cant access 'this' inside other non-arrow functions
  chatUpdateHandler = (action: ChatAction) => {
    if (action.is(YTNodes.AddChatItemAction)) {
      const { item } = action.as(YTNodes.AddChatItemAction);

      switch (item.type) {
        case "LiveChatTextMessage": {
          this.#eventEmitter.emit(
            LiveChatEvents.MessageCreate,
            new LiveChatMessage(item, ChatMessageType.Regular),
          );
          break;
        }
        case "LiveChatPaidMessage": {
          this.#eventEmitter.emit(
            LiveChatEvents.MessageCreate,
            new LiveChatMessage(item, ChatMessageType.Premium),
          );
          break;
        }
        case "LiveChatPaidSticker": {
          this.#eventEmitter.emit(
            LiveChatEvents.MessageCreate,
            new LiveChatMessage(item, ChatMessageType.PremiumSticker),
          );
          break;
        }
        default: {
          // noop
          break;
        }
      }
    }
  };

  #chatEndHandler = () => {
    this.#eventEmitter.emit(LiveChatEvents.StreamEnd);
  };

  constructor(chat: LiveChatReturnType) {
    this.chat = chat;
  }

  on<T extends LiveChatEvents>(event: T, handler: LiveChatEventsData[T]) {
    switch (event) {
      case LiveChatEvents.MessageCreate: {
        if (!this.#hasListener[LiveChatEvents.MessageCreate]) {
          this.chat.on("chat-update", this.chatUpdateHandler);
          this.#hasListener[LiveChatEvents.MessageCreate] = true;
        }
        this.#eventEmitter.on(event, handler);
      }
      case LiveChatEvents.StreamEnd: {
        if (!this.#hasListener[LiveChatEvents.StreamEnd]) {
          this.chat.on("end", this.#chatEndHandler);
        }
      }
    }
  }

  destroy() {
    if (this.#hasListener[LiveChatEvents.MessageCreate])
      this.chat.off("chat-update", this.chatUpdateHandler);
    if (this.#hasListener[LiveChatEvents.StreamEnd])
      this.chat.off("end", this.#chatEndHandler);

    this.chat.stop();
  }
}
