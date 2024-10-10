const { Worker } = require("node:worker_threads");
const { YoutubeiExtractor } = require("../../dist/index.js"); // replace "../../dist/index.js" with "discord-player-youtubei"

const generateToken = () =>
  new Promise((resolve, reject) => {
    const worker = new Worker(`${__dirname}/potoken.worker.js`);

    worker.once("message", (v) => {
      resolve(v);
    });

    worker.once("error", (v) => {
      reject(v);
    });
  });

// Register YoutubeiExtractor somewhere around here

// Then, set the tokens to the youtubei extractor
generateToken().then((tokens) => {
  const instance = YoutubeiExtractor.getInstance();

  if (instance) instance.setTrustedTokens(tokens);
});
