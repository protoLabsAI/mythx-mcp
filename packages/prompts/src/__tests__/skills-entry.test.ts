/**
 * Guards the "./skills" subpath export (docs/public-repo-extraction-plan.md
 * §1.2): the skills loader must stay free of langfuse / @langchain /
 * langfuse-executor / generated / raw so the public mcp-server dependency
 * tree never drags in telemetry deps or private prompt IP.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listSkills as listSkillsFromSrc } from "../skills.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Extract every static import/export-from specifier from a TS/JS source. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/\b(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g)].map(
    (m) => m[1]
  );
}

describe("skills subpath entry isolation", () => {
  it("src/skills.ts imports only node builtins", () => {
    const source = readFileSync(resolve(packageRoot, "src/skills.ts"), "utf-8");
    const specifiers = importSpecifiers(source);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier, `src/skills.ts must not import "${specifier}"`).toMatch(/^node:/);
    }
  });

  it("compiled dist/skills.js contains no langfuse/langchain/generated/raw traces", () => {
    const distEntry = resolve(packageRoot, "dist/skills.js");
    expect(
      existsSync(distEntry),
      "dist/skills.js missing — build @mythxengine/prompts before running tests (pnpm build)"
    ).toBe(true);
    const compiled = readFileSync(distEntry, "utf-8");

    // External deps would survive bundling as import specifiers; relative
    // modules (langfuse-executor / generated / raw) would be inlined — so
    // scan the whole bundle for their tell-tale tokens, not just imports.
    for (const forbidden of [/langfuse/i, /@langchain\//, /generated\/prompt-names/, /src\/raw/]) {
      expect(compiled, `dist/skills.js must not contain ${forbidden}`).not.toMatch(forbidden);
    }

    // tsup/esbuild may strip the `node:` prefix in the bundle, so accept
    // bare builtin names too — but nothing outside the Node stdlib.
    const specifiers = importSpecifiers(compiled);
    for (const specifier of specifiers) {
      const isBuiltin = specifier.startsWith("node:") || builtinModules.includes(specifier);
      expect(isBuiltin, `dist/skills.js must not import "${specifier}"`).toBe(true);
    }
  });

  it("package.json exposes ./skills pointing at the standalone entry", () => {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf-8")) as {
      exports: Record<string, { types: string; import: string; default: string }>;
    };
    expect(pkg.exports["./skills"]).toEqual({
      types: "./dist/skills.d.ts",
      import: "./dist/skills.js",
      default: "./dist/skills.js",
    });
    expect(
      existsSync(resolve(packageRoot, "dist/skills.d.ts")),
      "dist/skills.d.ts missing — the ./skills types condition points at nothing"
    ).toBe(true);
  });

  it("compiled dist/skills.js loads the same skills as the src loader", async () => {
    // Locks the runtime claim behind the repoint: the subpath entry's
    // __dirname resolution must find dist/skills/*.md (the tsup onSuccess
    // copy) and yield the same catalog as the src loader over src/skills/.
    // Dynamic import via a computed URL so typecheck never needs dist/.
    const distEntryUrl = pathToFileURL(resolve(packageRoot, "dist/skills.js")).href;
    const distModule = (await import(distEntryUrl)) as typeof import("../skills.js");

    const distList = distModule.listSkills();
    expect(distList).toEqual(listSkillsFromSrc());

    // The five runtime skills the public load_skill tool depends on
    // (extraction plan §1.2) must always ship.
    const names = distList.map((s) => s.name);
    for (const required of [
      "combat-runner",
      "companion-intelligence",
      "engine-flows",
      "image-generation",
      "player-interaction",
    ]) {
      expect(names).toContain(required);
    }

    const skill = distModule.getSkill("combat-runner");
    expect(skill.body.length).toBeGreaterThan(0);
  });
});
