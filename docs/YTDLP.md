# Download via YT-DLP

If all else fails, you may configure the extractor to download from yt-dlp. This is simply done by installing the package `youtube-dl-exec`

```bash
npm i youtube-dl-exec
```

# Configuring yt-dlp

You can configure ytdlp using **download > ytdlp** property in extractor options.

```ts
player.extractors.register(YoutubeExtractor, {
    downloads: {
        ytdlp: {
            cookiePath: "path/to/your/cookie/file"
        }
    }
})
```