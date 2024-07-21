import type Innertube from "youtubei.js";

export async function debugSignIn(innerTube: Innertube, debug: (msg: string) => void) {
    const info = await innerTube.account.getInfo()

    debug(info.contents?.contents ? `Signed into YouTube using the name: ${info.contents.contents[0]?.account_name?.text ?? "UNKNOWN ACCOUNT"}` : `Signed into YouTube using the client name: ${innerTube.session.client_name}@${innerTube.session.client_version}`)
}