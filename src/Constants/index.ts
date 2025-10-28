import { SabrPlaybackOptions } from "googlevideo/sabr-stream";
import { EnabledTrackTypes } from "googlevideo/utils";

export const YOUTUBE_REGEX = /^https:\/\/(www\.)?youtu(\.be\/.{11}(.+)?|be\.com\/watch\?v=.{11}(&.+)?)/;
export const YOUTUBE_LOGO = "https://www.iconpacks.net/icons/2/free-youtube-logo-icon-2431-thumb.png";
export const YOUTUBE_REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
export const TEN_MB = 1048576 * 10;
export const DEFAULT_EXPIRE_DURATION = 10800000;

export const DEFAULT_OPTIONS: SabrPlaybackOptions = {
    audioQuality: "AUDIO_QUALITY_MEDIUM",
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
}