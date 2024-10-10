import { YoutubeiExtractor } from "../Extractor/Youtube";

export function getYoutubeiInstance() {
  return YoutubeiExtractor.instance?.innerTube;
}
