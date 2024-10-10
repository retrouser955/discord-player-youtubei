import { type Author } from "youtubei.js/dist/src/parser/misc";

export class LiveChatAuthor {
  username: string;
  url: string;
  thumbnail: string;
  verifiedChannel: boolean;
  verifiedArtist: boolean;
  isMod: boolean;
  id: string;

  raw: Author;

  constructor(author: Author) {
    this.username = author.name;
    this.url = author.url;
    this.thumbnail = author.best_thumbnail?.url ?? author.thumbnails[0].url;
    this.verifiedChannel = author.is_verified || false;
    this.verifiedArtist = author.is_verified_artist || false;
    this.isMod = author.is_moderator || false;
    this.id = author.id;

    this.raw = author;
  }
}
