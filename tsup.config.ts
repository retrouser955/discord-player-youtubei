import { defineConfig } from "tsup"

export default defineConfig({
    format: ["cjs", "esm"],
    entry: ['./src/index.ts', "./src/Streams/index.ts"],
    outDir: "./dist",
    skipNodeModulesBundle: true,
    dts: true
})