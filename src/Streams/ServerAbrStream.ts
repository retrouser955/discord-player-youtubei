import { SabrStream } from "googlevideo/sabr-stream";
import { buildSabrFormat, EnabledTrackTypes } from "googlevideo/utils";
import { YoutubeTrack } from "../Classes";

const DEFAULT_OPTIONS = {
    audioQuality: "AUDIO_QUALITY_MEDIUM",
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY
}

export async function createServerAbrStream(ytTrack: YoutubeTrack) {
    
}