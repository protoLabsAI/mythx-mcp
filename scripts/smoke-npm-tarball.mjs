#!/usr/bin/env node
/* global console, process, setTimeout, clearTimeout */
/**
 * Smoke test for the publishable @mythxengine/mcp-server npm tarball.
 *
 * What it proves (the npx acceptance path, no bun, no workspace):
 *   1. `pnpm pack` produces a self-contained tarball (prepack runs the
 *      tsup publish bundle, inlining all workspace deps).
 *   2. A fresh `npm install <tarball>` in a temp dir under plain
 *      Node >= 22.13 resolves only real npm dependencies.
 *   3. The `./state` subpath export is importable from the installed
 *      package (apps/agent consumes it in the workspace).
 *   4. Without RPG_MCP_DATA_DIR, data lands in ~/.mythxengine/data — and
 *      never in the consumer's project, even when the consumer looks like
 *      a monorepo (a decoy turbo.json is planted next to node_modules).
 *   5. The bin speaks MCP over stdio: initialize → tools/list →
 *      tools/call load_skill → tools/call list_world_packs.
 *   6. Assertions: >= 100 tools listed, the 4 bundled packs imported on
 *      first run, load_skill returns markdown.
 *
 * Usage (from the repo root):
 *   node scripts/smoke-npm-tarball.mjs
 */

import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG_DIR = join(REPO_ROOT, "packages", "mcp-server");
const MIN_NODE = [22, 13];

const EXPECTED_BUNDLED_PACK_IDS = [
  "world:bundled-port-miriam",
  "world:bundled-aethelgard",
  "world:bundled-threshold-deep",
  "world:bundled-treehouse-anthology",
];

function fail(msg) {
  console.error(`\nFAIL: ${msg}`);
  process.exit(1);
}

function step(msg) {
  console.log(`\n=== ${msg}`);
}

// ---------------------------------------------------------------------------
// 0. Runtime check — this script must itself run under plain Node >= 22.13.
// ---------------------------------------------------------------------------
if (process.versions.bun) {
  fail("run this with plain `node`, not bun — the point is the no-bun path");
}
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  fail(`Node >= ${MIN_NODE.join(".")} required (node:sqlite); found ${process.versions.node}`);
}
console.log(`node ${process.versions.node} OK`);

// ---------------------------------------------------------------------------
// 1. Pack the tarball (pnpm pack triggers prepack → tsup publish bundle and
//    rewrites workspace:* versions).
// ---------------------------------------------------------------------------
const workDir = mkdtempSync(join(tmpdir(), "mythx-smoke-"));
step(`packing tarball into ${workDir}`);
execFileSync("pnpm", ["pack", "--pack-destination", workDir], {
  cwd: PKG_DIR,
  stdio: "inherit",
});
const tarball = readdirSync(workDir).find((f) => f.endsWith(".tgz"));
if (!tarball) fail("pnpm pack produced no .tgz");
console.log(`tarball: ${tarball}`);

// ---------------------------------------------------------------------------
// 2. Fresh install in a temp project with plain npm.
// ---------------------------------------------------------------------------
const installDir = join(workDir, "consumer");
const dataDir = join(workDir, "data");
step(`npm install into ${installDir}`);
mkdirSync(installDir, { recursive: true });
writeFileSync(
  join(installDir, "package.json"),
  JSON.stringify({ name: "mythx-smoke-consumer", private: true, type: "module" }, null, 2)
);
execFileSync("npm", ["install", join(workDir, tarball), "--no-audit", "--no-fund"], {
  cwd: installDir,
  stdio: "inherit",
});

const serverEntry = join(
  installDir,
  "node_modules",
  "@mythxengine",
  "mcp-server",
  "dist",
  "index.js"
);

// ---------------------------------------------------------------------------
// 3. The `./state` subpath export must survive bundling — apps/agent
//    imports `@mythxengine/mcp-server/state` (SessionManager and friends).
// ---------------------------------------------------------------------------
step("importing @mythxengine/mcp-server/state from the installed package");
writeFileSync(
  join(installDir, "check-state.mjs"),
  [
    'const state = await import("@mythxengine/mcp-server/state");',
    'for (const name of ["SessionManager", "WorldPackManager", "listWorldPacks"]) {',
    '  if (typeof state[name] !== "function") throw new Error(`missing export: ${name}`);',
    "}",
    "",
  ].join("\n")
);
let stateSubpathError = null;
try {
  execFileSync(process.execPath, ["check-state.mjs"], {
    cwd: installDir,
    env: { ...process.env, RPG_MCP_DATA_DIR: dataDir },
    stdio: ["ignore", "inherit", "inherit"],
  });
} catch (err) {
  stateSubpathError = err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// 3b. Data-dir fallback: with no RPG_MCP_DATA_DIR, an installed copy must
//     use ~/.mythxengine/data — and must NOT latch onto the consumer's
//     workspace markers (paths.ts skips repo-root derivation under
//     node_modules). The decoy turbo.json makes the consumer project look
//     like a monorepo root; without the guard the server would create
//     <consumer>/data. HOME is redirected so nothing touches the real one.
// ---------------------------------------------------------------------------
step("data-dir fallback: no RPG_MCP_DATA_DIR, decoy consumer turbo.json, HOME redirected");
writeFileSync(join(installDir, "turbo.json"), "{}\n");
const fakeHome = join(workDir, "home");
mkdirSync(fakeHome, { recursive: true });
const fallbackEnv = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome };
delete fallbackEnv.RPG_MCP_DATA_DIR;
delete fallbackEnv.MYTHX_DB_PATH;
try {
  // stdin is /dev/null (immediate EOF) so the server exits on its own; the
  // db is created during module init, well before that. Exit code doesn't
  // matter — the assertions below are on the filesystem.
  execFileSync(process.execPath, [serverEntry], {
    cwd: installDir,
    env: fallbackEnv,
    stdio: ["ignore", "ignore", "pipe"],
    timeout: 30_000,
    killSignal: "SIGKILL",
  });
} catch {
  // Timeout/kill or nonzero exit — fine, see above.
}
const fallbackDbCreated = existsSync(join(fakeHome, ".mythxengine", "data", "mythx.db"));
const consumerRepoUntouched = !existsSync(join(installDir, "data"));

// ---------------------------------------------------------------------------
// 4. Drive the MCP handshake over stdio.
// ---------------------------------------------------------------------------
step(`starting server (RPG_MCP_DATA_DIR=${dataDir})`);
const child = spawn(process.execPath, [serverEntry], {
  cwd: installDir,
  env: { ...process.env, RPG_MCP_DATA_DIR: dataDir },
  stdio: ["pipe", "pipe", "pipe"],
});
child.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

const pending = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // not JSON-RPC, ignore
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve: res, reject: rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`RPC error for id ${msg.id}: ${JSON.stringify(msg.error)}`));
      else res(msg.result);
    }
  }
});

let nextId = 1;
function request(method, params, timeoutMs = 120_000) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  return new Promise((res, rej) => {
    const timer = setTimeout(
      () => rej(new Error(`timeout waiting for ${method} (id ${id})`)),
      timeoutMs
    );
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        res(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        rej(e);
      },
    });
    child.stdin.write(payload + "\n");
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

/** tools/call results come back as MCP content: [{type:"text", text}] */
function toolText(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (typeof text !== "string") {
    throw new Error(`tool result had no text content: ${JSON.stringify(result).slice(0, 400)}`);
  }
  return text;
}

const failures = [];
function check(label, ok, detail) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
}

check("./state subpath export importable", stateSubpathError === null, stateSubpathError);
check(
  "data dir falls back to ~/.mythxengine/data when RPG_MCP_DATA_DIR is unset",
  fallbackDbCreated
);
check(
  "installed copy ignores consumer repo markers (no <consumer>/data created)",
  consumerRepoUntouched
);

try {
  // -- initialize ----------------------------------------------------------
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-npm-tarball", version: "0.0.0" },
  });
  check(
    "initialize handshake",
    init?.serverInfo?.name === "mythxengine",
    `serverInfo: ${JSON.stringify(init?.serverInfo)}`
  );
  console.log(`serverInfo: ${JSON.stringify(init?.serverInfo)}`);
  notify("notifications/initialized", {});

  // -- tools/list ----------------------------------------------------------
  const toolsResult = await request("tools/list", {});
  const toolNames = (toolsResult?.tools ?? []).map((t) => t.name);
  console.log(`tools listed: ${toolNames.length}`);
  check(`tools/list returns >= 100 tools`, toolNames.length >= 100, `got ${toolNames.length}`);
  check("load_skill tool present", toolNames.includes("load_skill"));
  check("list_world_packs tool present", toolNames.includes("list_world_packs"));

  // -- tools/call load_skill ----------------------------------------------
  const skillResult = await request("tools/call", {
    name: "load_skill",
    arguments: { name: "combat-runner" },
  });
  const skillPayload = JSON.parse(toolText(skillResult));
  check(
    "load_skill returns the combat-runner skill",
    skillPayload?.status === "ok" && skillPayload?.name === "combat-runner"
  );
  check(
    "load_skill body is markdown",
    typeof skillPayload?.body === "string" &&
      skillPayload.body.length > 200 &&
      skillPayload.body.includes("#"),
    `body head: ${String(skillPayload?.body).slice(0, 80)}`
  );

  // -- tools/call list_world_packs ------------------------------------------
  const packsResult = await request("tools/call", {
    name: "list_world_packs",
    arguments: {},
  });
  const packsPayload = JSON.parse(toolText(packsResult));
  const packIds = (packsPayload?.packs ?? []).map((p) => p.id);
  console.log(`world packs: ${JSON.stringify(packIds)}`);
  for (const id of EXPECTED_BUNDLED_PACK_IDS) {
    check(`bundled pack imported: ${id}`, packIds.includes(id));
  }
} catch (err) {
  check("MCP conversation completed", false, err instanceof Error ? err.message : String(err));
} finally {
  child.kill();
}

if (failures.length > 0) {
  // Leave workDir in place for debugging.
  fail(`${failures.length} check(s) failed: ${failures.join(", ")} (artifacts kept at ${workDir})`);
}
rmSync(workDir, { recursive: true, force: true });
console.log("\nSMOKE TEST PASSED");
