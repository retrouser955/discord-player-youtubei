# Peer streaming

Peer streaming is a way to offload the streaming engine onto many different IPs and servers. This can heavily reduce the amount of requests being sent to YouTube and YouTube flagging your single IP for spam.

# Setting up a peer

A peer is just a simple HTTPs streaming server that meets the following requirements.

1. Authentication must be done via the headers or inside the URL.
2. Peers must keep alive the connection. Peers must not drop the connection midway through the stream.
3. Peers must not rate-limit the extractor. If the peer is a publically available YouTube downloader, maybe add authentication to bypass ratelimit.

> [!TIP]
> Take a look at [`simple-ytdl-core`](https://github.com/retrouser955/simple-ytdl-core) which is used internally by discord-player-youtubei to stream. This will provide you with a simple audio only downloader which you can then connect up to a HTTP server.

# Configuring Peers

You can configure peers by using the following options.
```ts
player.extractors.register(YoutubeExtractor, {
    // your array of peers
    peers: [
        {
            parseUrl: (youtubeId) => `https://my-peer-downloader.com/download?id=${youtubeId}`,
            // optional headers. Useful for authorization
            headers: {
                "Authorization": `Bot token`
            }
        }
    ]
})
```

You can add unlimited peers and the extractor will automatically try to download from each peer at random.