import { defineConfig } from "tsup"

export default defineConfig({
    format: "cjs",
    entry: ['./lib/index.ts', "./lib/utils/index.ts"],
    outDir: "./dist",
    skipNodeModulesBundle: true,
    dts: true
})