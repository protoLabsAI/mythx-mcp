#!/usr/bin/env node
/* global console, process */
/**
 * Assemble the Claude Desktop `.mcpb` bundle for @mythxengine/mcp-server.
 *
 * The bundle is the unpacked npm tarball plus production node_modules and an
 * MCPB manifest. Reusing the tarball layout (package root = bundle root:
 * dist/, bundled-packs/, skills/, package.json) means the server's
 * package-root-relative asset resolution — bundled packs and skill .md
 * files both walk up to the nearest package.json — works unchanged inside
 * the extracted extension directory.
 *
 * Steps:
 *   1. `pnpm pack` in packages/mcp-server (prepack runs the tsup publish
 *      bundle, inlining all @mythxengine/* workspace deps).
 *   2. Extract the tarball into a staging dir.
 *   3. Strip devDependencies from the staged package.json, then
 *      `npm install --omit=dev` — an .mcpb has no install step, so the four
 *      real externals (@modelcontextprotocol/sdk, zod, zod-to-json-schema,
 *      lodash-es) must ship inside the bundle. The strip is load-bearing:
 *      `pnpm pack` rewrites the workspace:* dev deps to concrete versions
 *      (@mythxengine/prompts@0.1.0, ...) that don't exist on the public npm
 *      registry, and with no lockfile in the extracted package npm resolves
 *      the FULL ideal tree (dev edges included) even under --omit=dev, so
 *      the install dies with E404 unless the dev edges are removed first.
 *   4. Write manifest.json (MCPB manifest_version 0.3, node server type).
 *   5. `npx -y @anthropic-ai/mcpb pack` -> <out>/mythxengine-<version>.mcpb
 *      (skipped with --skip-pack for offline/CI-less runs).
 *
 * Usage: node scripts/build-mcpb.mjs [--out <dir>] [--skip-pack]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG_DIR = join(REPO_ROOT, "packages", "mcp-server");

let outDir = join(REPO_ROOT, "release-artifacts");
let skipPack = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--out") {
    if (!argv[i + 1]) throw new Error("--out requires a directory");
    outDir = resolve(argv[++i]);
  } else if (argv[i] === "--skip-pack") {
    skipPack = true;
  } else {
    throw new Error(`unknown argument: ${argv[i]}`);
  }
}

const pkg = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf-8"));
const version = pkg.version;

const workDir = mkdtempSync(join(tmpdir(), "mythx-mcpb-"));
console.log(`staging in ${workDir}`);

// 1. Pack the publish tarball (prepack -> tsup bundle).
execFileSync("pnpm", ["pack", "--pack-destination", workDir], {
  cwd: PKG_DIR,
  stdio: "inherit",
});
const tarball = readdirSync(workDir).find((f) => f.endsWith(".tgz"));
if (!tarball) throw new Error("pnpm pack produced no .tgz");

// 2. Extract — npm tarballs unpack to a top-level `package/` dir.
execFileSync("tar", ["-xzf", join(workDir, tarball), "-C", workDir], { stdio: "inherit" });
const bundleDir = join(workDir, "package");

// 3. Vendor production dependencies into the bundle. devDependencies must
// go first: pnpm pack rewrote the workspace:* dev deps to concrete
// @mythxengine/* versions that aren't on the registry, and npm resolves
// dev edges during ideal-tree construction even with --omit=dev when the
// package has no lockfile — leaving them in fails the install with E404.
execFileSync("npm", ["pkg", "delete", "devDependencies"], {
  cwd: bundleDir,
  stdio: "inherit",
});
execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
  cwd: bundleDir,
  stdio: "inherit",
});

// 4. MCPB manifest (manifest_version 0.3). ${__dirname} is substituted by
// the MCPB host with the extension's install directory; the data directory
// is user-configurable and mapped to RPG_MCP_DATA_DIR (the >=0.2.0 server
// also defaults to ~/.mythxengine/data on its own when the env is unset).
const manifest = {
  manifest_version: "0.3",
  name: "mythxengine",
  display_name: "MythxEngine",
  version,
  description: "Tabletop RPG engine: dice, combat, stress, clocks, and four bundled worlds",
  long_description:
    "A complete tabletop RPG engine over MCP — deterministic dice, five-tier outcomes, " +
    "FitD-style stress, combat tracking, situation clocks, investigations, and world " +
    "generation, with four complete starter worlds bundled in. Claude becomes your GM; " +
    "the engine keeps the rules honest.",
  author: { name: "protoLabs Studio", url: "https://mythxengine.com" },
  license: "MIT",
  repository: { type: "git", url: "https://github.com/protoLabsAI/mythx-mcp" },
  homepage: "https://mythxengine.com",
  server: {
    type: "node",
    entry_point: "dist/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/dist/index.js"],
      env: {
        RPG_MCP_DATA_DIR: "${user_config.data_dir}",
      },
    },
  },
  user_config: {
    data_dir: {
      type: "directory",
      title: "Data directory",
      description: "Where game sessions and world packs are stored",
      required: false,
      default: "${HOME}/.mythxengine/data",
    },
  },
  compatibility: {
    platforms: ["darwin", "win32", "linux"],
    runtimes: { node: ">=22.13" },
  },
};
writeFileSync(join(bundleDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest.json written (v${version})`);

if (skipPack) {
  console.log(`--skip-pack: bundle dir left at ${bundleDir}`);
  process.exit(0);
}

// 5. Pack the bundle. `mcpb pack` zips the directory (validating the
// manifest) into a single distributable file.
mkdirSync(outDir, { recursive: true });
const mcpbPath = join(outDir, `mythxengine-${version}.mcpb`);
execFileSync("npx", ["-y", "@anthropic-ai/mcpb", "pack", bundleDir, mcpbPath], {
  stdio: "inherit",
});
rmSync(workDir, { recursive: true, force: true });
console.log(`\nbuilt ${mcpbPath}`);
console.log("sha256 (for server.json fileSha256):");
execFileSync("shasum", ["-a", "256", mcpbPath], { stdio: "inherit" });
