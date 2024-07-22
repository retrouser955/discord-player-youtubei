# Rotating authentication tokens

## The shard rotation strategy

Below is a template of the rotator config

```ts
player.extractors.register(YoutubeiExtractor, {
    rotator: {
        rotationStrategy: "shard",
        authentication: ["array", "of", "your", "access", "tokens"],
        currentShard: 1
    }
})
```

Let's look over the option `rotationStrategy` for now. In the example, it is set to "shard" which means the extractor will pick out the authentication token that matches with the shard number. For example, shard 1 will use token 1. If the amount of shards exceeds the amount of tokens, the extractor will start counting from the start again.

For example

```js
player.extractors.register(YoutubeiExtractor, {
    rotator: {
        rotationStrategy: "shard",
        authentication: ["I", "have", "four", "tokens"],
        currentShard: 5
    }
})
```

The current shard has been set to 5 so the extractor will now use the authentication token `I` (counting from the start again).

## The random rotation strategy

* Warning: if your bot is used to the point of needing this, I recommend you start working on sharding.

```ts
player.extractors.register(YoutubeiExtractor, {
    rotator: {
        rotationStrategy: "random",
        authentication: ["array", "of", "your", "access", "tokens"],
    }
})
```

This is the more simple out of the two options. Random sharding option just picks out a random token before requesting and signs in to youtube