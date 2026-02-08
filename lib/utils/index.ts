import type { Player } from "discord-player";
import { type ProxyAgent } from "undici";
import { Platform } from "youtubei.js";

export function defaultPeerUrlBuilder(url: string, id: string) {
  return `${url}/${id}`;
}

export function defaultFetch(
  _player: Player,
  input: RequestInfo | URL,
  init?: globalThis.RequestInit,
  proxy?: ProxyAgent,
) {
  let requestInit: globalThis.RequestInit = {
    ...init,
  };

  if (proxy) {
    // @ts-expect-error
    requestInit.dispatcher = proxy;

    return Platform.shim.fetch(input, requestInit);
  } else {
    return Platform.shim.fetch(input, requestInit);
  }
}
