import Innertube from "youtubei.js";
import { InitOptions, minterResult } from "../types";
import { initializeBotGuard } from "./inibot";
import BG from "bgutils-js";
import { resetBotGuardState } from "./resetbot";

function requireBinding(binding: string | undefined | null): string {
    if(!binding) throw new Error("Content binding is required for mind a PoToken.");
    return binding;
}

export async function getWebPoMinter(innertube: Innertube, options: InitOptions = {}): Promise<minterResult> {
    const minter = await initializeBotGuard(innertube, options);
    
    return {
        generatePlaceholder(binding: string | undefined | null): string {
            return BG.PoToken.generateColdStartToken(requireBinding(binding));
        },
        async mint(binding: string | undefined | null): Promise<string> {
            return await minter.mintAsWebsafeString(requireBinding(binding));
        },
    };
}

export async function invalidateWebPoMinter(): Promise<void> {
    await resetBotGuardState();
}