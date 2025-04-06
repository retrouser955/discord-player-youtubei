import { JSDOM } from "jsdom";
import { Innertube } from "youtubei.js";
import { BG, BgConfig } from "bgutils-js";

export async function generateToken(innertube: Innertube) {
  const requestKey = "O43z0dpjhgX20SCx4KAo";
  const visitorData = innertube.session.context.client.visitorData;

  if (!visitorData) throw new Error("Could not get visitor data");

  const bgConfig: BgConfig = {
    fetch: (input: string | URL | globalThis.Request, init?: RequestInit) =>
      fetch(input, init),
    globalObj: globalThis,
    identifier: visitorData,
    requestKey,
  };

  const dom = new JSDOM();
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });

  const bgChallenge = await BG.Challenge.create(bgConfig);

  if (!bgChallenge) throw new Error("Could not get challenge");

  const interpreterJavascript =
    bgChallenge.interpreterJavascript
      .privateDoNotAccessOrElseSafeScriptWrappedValue;

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else throw new Error("Could not load VM");

  const poTokenResult = {
    ...(await BG.PoToken.generate({
      program: bgChallenge.program,
      globalName: bgChallenge.globalName,
      bgConfig,
    })),
    visitorData,
  };

  try {
    globalThis.document.close();
  } catch {
    // no-op
  }
  // Clean up after jsdom is ran
  // @ts-expect-error
  delete globalThis.window;
  // @ts-expect-error
  delete globalThis.document;

  return poTokenResult;
}
