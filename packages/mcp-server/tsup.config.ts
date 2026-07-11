import { defineConfig } from "tsup";
import { cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Anchor asset copies to this config's directory (the package dir) rather
// than cwd — bundle-require loads the config from a temp file in the same
// directory, so this stays correct however tsup is invoked.
const pkgDir = dirname(fileURLToPath(import.meta.url));

/**
 * npm-publish bundle. The normal dev build stays `tsc` (multi-file dist,
 * used by turbo + the web app's workspace imports); this config is what
 * `prepack` / `build:publish` run so the published tarball is
 * self-contained.
 *
 * The workspace `@mythxengine/*` packages are NOT published to npm, so
 * they are inlined (`noExternal`). Real externals stay external and live
 * in `dependencies` so `npm install` provides them: the MCP SDK, zod,
 * zod-to-json-schema, lodash-es.
 *
 * `bun:sqlite` / `node:sqlite` are loaded lazily by storage's
 * connection.ts through `createRequire(import.meta.url)` — a dynamic
 * `req("...")` call esbuild leaves untouched, so the runtime-adaptive
 * driver pick survives bundling. They're listed as externals anyway as a
 * guard against future static imports.
 *
 * Both entries are standalone (splitting: false): `dist/index.js` is the
 * bin, `dist/state/index.js` keeps the `./state` subpath export working.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "state/index": "src/state/index.ts",
  },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  sourcemap: false,
  clean: true,
  splitting: false,
  minify: false,
  noExternal: [/^@mythxengine\//],
  external: [
    "@modelcontextprotocol/sdk",
    "zod",
    "zod-to-json-schema",
    "lodash-es",
    "bun:sqlite",
    "node:sqlite",
  ],
  onSuccess: async () => {
    // Runtime assets that the bundled code resolves from disk:
    // 1. Skill .md files — prompts' skills.ts falls back to
    //    `<package root>/skills` when its own dist/skills doesn't exist
    //    (the bundled case). Shipped via the "skills" entry in `files`.
    cpSync(join(pkgDir, "../prompts/src/skills"), join(pkgDir, "skills"), { recursive: true });
    // 2. Imagegen prompt templates — tools' prompt-loader resolves
    //    `<__dirname>/templates`, which is `dist/templates` once bundled.
    cpSync(join(pkgDir, "../tools/src/imagegen/templates"), join(pkgDir, "dist/templates"), {
      recursive: true,
    });
    console.log("Copied skills/ (from prompts) and dist/templates (from tools)");
  },
});
