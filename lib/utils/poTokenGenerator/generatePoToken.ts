import type { PuppeteerLaunchOptions } from "puppeteer";

async function hasPuppeteer() {
  try {
    await import("puppeteer");
    return true;
  } catch {
    return false;
  }
}

export interface GeneratorReturnData {
  visitorData: string;
  poToken: string;
}

export interface GeneratorOptions {
  puppeteerOptions?: Omit<PuppeteerLaunchOptions, "headless">;
  timeout?: number;
  embeddedVideoUrl?: string;
  skipPuppeteerCheck?: boolean;
}

export async function generateTrustedToken(options: GeneratorOptions = {}) {
  if (!options.skipPuppeteerCheck && !(await hasPuppeteer()))
    throw new Error("ERR_NO_DEP: Puppeteer not found");
  if (
    options.embeddedVideoUrl &&
    !options.embeddedVideoUrl.startsWith("https://www.youtube.com/embed/")
  )
    throw new Error("ERR_INVALID_YT_EMBED: That is not a valid youtube embed");

  return new Promise<GeneratorReturnData>(async (resolve, reject) => {
    const puppet = await import("puppeteer");

    const browser = await puppet.launch({
      ...options.puppeteerOptions,
      headless: false,
    });

    const page = await browser.newPage();

    const client = await page.createCDPSession();
    await client.send("Debugger.enable");
    await client.send("Debugger.setAsyncCallStackDepth", { maxDepth: 32 });
    await client.send("Network.enable");

    const timeout = setTimeout(() => {
      client.removeAllListeners();
      reject(
        "ERR_PUPPETEER_TIMEOUT: Timeout exceeded. Use GeneratorOptions.timeout to increase it",
      );
    }, options.timeout ?? 10_000).unref();

    client.on("Network.requestWillBeSent", (e) => {
      if (e.request.url.includes("/youtubei/v1/player")) {
        const jsonData = JSON.parse(e.request.postData!);

        // cleanup
        browser.close();
        client.removeAllListeners();

        clearTimeout(timeout);

        if (
          !jsonData["serviceIntegrityDimensions"]["poToken"] ||
          !jsonData["context"]["client"]["visitorData"]
        )
          reject("Unable to get poToken or visitorData");

        resolve({
          poToken: jsonData["serviceIntegrityDimensions"]["poToken"],
          visitorData: jsonData["context"]["client"]["visitorData"],
        });
      }
    });

    await page.goto(
      options.embeddedVideoUrl ?? "https://www.youtube.com/embed/jNQXAC9IVRw",
      {
        waitUntil: "networkidle2",
      },
    );

    // Start playing the video
    const playButton = (await page.$("#movie_player"))!;

    await playButton.click();
  });
}
