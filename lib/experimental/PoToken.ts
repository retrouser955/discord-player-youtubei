import Innertube from "youtubei.js";
import { BG, type PoTokenResult, type BgConfig } from "bgutils-js";
import { Window } from "happy-dom";

const HARD_CODED_REQ_KEY = "O43z0dpjhgX20SCx4KAo";

// Again, this is an example script from LuanRT's BgUtils package
// https://github.com/LuanRT/BgUtils/blob/main/examples/node/index.ts
// All credits goes to him.
export async function poTokenExtraction(
  innertube: Innertube,
): Promise<PoTokenResult> {
  const visitorData = innertube.session.context.client.visitorData;

  if (!visitorData)
    throw new Error("Innertube instance does not contain visitor data");

  const window = new Window();
  // spooky 👻
  Object.assign(globalThis, {
    document: window.document,
    window: window,
  });

  const bgConfig: BgConfig = {
    // excuse my variable naming
    fetch: (i, a) => fetch(i, a),
    globalObj: globalThis,
    identifier: visitorData,
    requestKey: HARD_CODED_REQ_KEY,
  };

  const challenge = await BG.Challenge.create(bgConfig);

  if (!challenge)
    throw new Error("Unable to retrieve challenge data from botguard");

  const jsInter =
    challenge.interpreterJavascript
      .privateDoNotAccessOrElseSafeScriptWrappedValue;

  if (jsInter) {
    new Function(jsInter)();
  } else throw new Error("Unable to load botguard's VM");

  return BG.PoToken.generate({
    bgConfig,
    program: challenge.program,
    globalName: challenge.globalName,
  });
}
