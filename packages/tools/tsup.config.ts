import { defineConfig } from "tsup";
import { cpSync } from "fs";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "context/index": "src/context/index.ts",
    "events/index": "src/events/index.ts",
  },
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  external: [
    // Workspace dependencies - keep external to avoid bundling
    "@mythxengine/engine",
    // prompts MUST stay external: skills/load-skill.ts imports
    // "@mythxengine/prompts/skills", whose __dirname-relative lookup of
    // dist/skills/*.md only works from inside the prompts package.
    "@mythxengine/prompts",
    "@mythxengine/types",
    "@mythxengine/worlds",
    // Runtime dependencies - keep external
    "lodash-es",
    "zod",
    "zod-to-json-schema",
  ],
  // Copy template markdown files after build (since clean: true deletes them)
  onSuccess: async () => {
    cpSync("src/imagegen/templates", "dist/templates", { recursive: true });
    console.log("Copied imagegen templates to dist/templates");
  },
});
