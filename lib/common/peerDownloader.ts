import type { PeerInfo } from "../Extractor/Youtube";
import { defaultPeerUrlBuilder } from "../utils";

export default function peerDownloader(id: string, peer: PeerInfo) {
    const peerUrl = typeof peer.parse === "function" ? peer.parse(peer.url, id) : defaultPeerUrlBuilder(peer.url, id)
    return peerUrl
}