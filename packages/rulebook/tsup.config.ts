import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "schema/index": "src/schema/index.ts",
    "content/index": "src/content/index.ts",
  },
  format: ["esm"],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  sourcemap: true,
  clean: true,
  treeshake: true,
});
