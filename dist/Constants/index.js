"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OPTIONS = exports.DEFAULT_EXPIRE_DURATION = exports.TEN_MB = exports.YOUTUBE_REQUEST_KEY = exports.YOUTUBE_LOGO = exports.YOUTUBE_REGEX = void 0;
const utils_1 = require("googlevideo/utils");
exports.YOUTUBE_REGEX = /^https:\/\/(www\.)?youtu(\.be\/.{11}(.+)?|be\.com\/watch\?v=.{11}(&.+)?)/;
exports.YOUTUBE_LOGO = "https://www.iconpacks.net/icons/2/free-youtube-logo-icon-2431-thumb.png";
exports.YOUTUBE_REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
exports.TEN_MB = 1048576 * 10;
exports.DEFAULT_EXPIRE_DURATION = 10800000;
exports.DEFAULT_OPTIONS = {
    audioQuality: "AUDIO_QUALITY_MEDIUM",
    enabledTrackTypes: utils_1.EnabledTrackTypes.AUDIO_ONLY,
};
