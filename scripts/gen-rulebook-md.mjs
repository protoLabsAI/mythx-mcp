#!/usr/bin/env node
/**
 * gen-rulebook-md.mjs — render the canonical rulebook to docs/RULEBOOK.md.
 *
 * The rules of MythxEngine live as structured content in
 * `packages/rulebook` (the same source `lookup_rule` and `generate_rulebook`
 * serve at runtime). This script materializes the whole thing to a single
 * browsable Markdown file so the rules are readable straight from the repo —
 * and, because it renders from that one source, the doc can never drift from
 * the engine.
 *
 * Run it after the rulebook package is built (`dist/` present):
 *   node scripts/gen-rulebook-md.mjs
 *
 * The private→public export runs this automatically on every sync, so the
 * committed RULEBOOK.md is always freshly generated. Do not hand-edit the
 * output — change `packages/rulebook/src/content/*.ts` and regenerate.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const rulebookEntry = join(here, "..", "packages", "rulebook", "dist", "index.js");
const outPath = join(here, "..", "docs", "RULEBOOK.md");

const { rulebook, renderForAudience } = await import(rulebookEntry);

// `both` renders every entry (player + gm + both), grouped by chapter.
const body = renderForAudience(rulebook, "both");

const header = [
  "<!--",
  "  GENERATED FILE — DO NOT EDIT BY HAND.",
  "  Source of truth: packages/rulebook/src/content/*.ts",
  "  Regenerate:      node scripts/gen-rulebook-md.mjs",
  "  The private→public export regenerates this on every sync.",
  "-->",
  "",
].join("\n");

const footer = [
  "",
  "---",
  "",
  "_This rulebook is generated from `packages/rulebook` — the same structured",
  "content the engine serves at runtime through the `lookup_rule` and",
  "`generate_rulebook` tools. For how the engine fits together, see",
  "[engine.md](./engine.md); for running a game, see the",
  "[agent-kit](../agent-kit/)._",
  "",
].join("\n");

writeFileSync(outPath, header + body + footer, "utf8");
console.log(`wrote ${outPath} (${body.length} chars, ${body.split("\n").length} lines)`);
