import { type YTNode } from "youtubei.js/dist/src/parser/helpers";
import { LiveChatAuthor } from "./LiveChatAuthor";
import type {
  LiveChatPaidMessage,
  LiveChatPaidSticker,
  LiveChatTextMessage,
} from "youtubei.js/dist/src/parser/nodes";

export enum ChatMessageType {
  Regular = 1,
  Premium = 2,
  PremiumSticker = 3,
}

export class LiveChatMessage {
  author: LiveChatAuthor;
  type: ChatMessageType;
  content?: string;
  timestamp: number;

  constructor(chatUpdate: YTNode, type: ChatMessageType) {
    this.author = new LiveChatAuthor(
      (
        chatUpdate as
          | LiveChatTextMessage
          | LiveChatPaidMessage
          | LiveChatPaidSticker
      ).author,
    );
    this.type = type;
    this.timestamp =
      (
        chatUpdate as
          | LiveChatTextMessage
          | LiveChatPaidMessage
          | LiveChatPaidSticker
      ).timestamp || Date.now();

    if (
      chatUpdate.type === "LiveChatTextMessage" ||
      chatUpdate.type === "LiveChatPaidMessage"
    ) {
      this.content = (
        chatUpdate as LiveChatTextMessage | LiveChatPaidMessage
      ).message.toString();
    }
  }
}
