const { Worker } = require("node:worker_threads")

const generateToken = () => new Promise((resolve, reject) => {
    const worker = new Worker(`${__dirname}/potoken.worker.js`)

    worker.once("message", (v) => {
        resolve(v)
    })

    worker.once("error", (v) => {
        reject(v)
    })
});

generateToken().then(console.log)