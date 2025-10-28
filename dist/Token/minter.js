"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebPoMinter = getWebPoMinter;
exports.invalidateWebPoMinter = invalidateWebPoMinter;
const inibot_1 = require("./inibot");
const bgutils_js_1 = __importDefault(require("bgutils-js"));
const resetbot_1 = require("./resetbot");
function requireBinding(binding) {
    if (!binding)
        throw new Error("Content binding is required for mind a PoToken.");
    return binding;
}
async function getWebPoMinter(innertube, options = {}) {
    const minter = await (0, inibot_1.initializeBotGuard)(innertube, options);
    return {
        generatePlaceholder(binding) {
            return bgutils_js_1.default.PoToken.generateColdStartToken(requireBinding(binding));
        },
        async mint(binding) {
            return await minter.mintAsWebsafeString(requireBinding(binding));
        },
    };
}
async function invalidateWebPoMinter() {
    await (0, resetbot_1.resetBotGuardState)();
}
