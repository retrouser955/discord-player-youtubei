const { generateTrustedToken } = require("../../dist/index.js");
const { parentPort } = require("node:worker_threads");

generateTrustedToken().then((v) => {
  parentPort.postMessage(v);
});
