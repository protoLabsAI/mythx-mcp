/**
 * Rulebook integrity tests.
 *
 * - Authored content parses against the schema
 * - All entry / chapter ids are unique
 * - Every cross-reference resolves
 * - Every world-overridable extensibility configPath resolves against
 *   the real `ResolvedRules` shape (so a future rename of e.g.
 *   `mechanics.criticals.damageMultiplier` surfaces as a test failure
 *   here, not a silent drift in the rulebook)
 */

import { describe, expect, it } from "vitest";
import { getDefaultRules } from "@mythxengine/types";
import { rulebook } from "../content/index.js";
import { buildRulebookIndex, RulebookSchema, validateRulebook } from "../index.js";

describe("rulebook content", () => {
  it("parses against the schema", () => {
    expect(() => RulebookSchema.parse(rulebook)).not.toThrow();
  });

  it("has unique entry ids and chapter ids", () => {
    const issues = validateRulebook(rulebook);
    const dupes = issues.filter(
      (i) => i.code === "duplicate-entry-id" || i.code === "duplicate-chapter-id"
    );
    expect(dupes).toEqual([]);
  });

  it("has unique chapter numbers", () => {
    const issues = validateRulebook(rulebook);
    const collisions = issues.filter((i) => i.code === "chapter-number-collision");
    expect(collisions).toEqual([]);
  });

  it("has no broken cross-references", () => {
    const issues = validateRulebook(rulebook);
    const broken = issues.filter((i) => i.code === "broken-xref");
    expect(broken).toEqual([]);
  });

  it("has every world-overridable configPath resolve against ResolvedRules", () => {
    // ResolvedRules has every mechanics knob filled in; if a path
    // doesn't resolve here, the rulebook is claiming an override that
    // the engine doesn't actually expose.
    const defaults = getDefaultRules();
    const issues = validateRulebook(rulebook, {
      worldRulesShape: defaults as unknown as Record<string, unknown>,
    });
    const unknownPaths = issues.filter((i) => i.code === "extensibility-config-path-unknown");
    expect(unknownPaths).toEqual([]);
  });
});

describe("rulebook index", () => {
  it("indexes every entry by id", () => {
    const index = buildRulebookIndex(rulebook);
    let total = 0;
    for (const chapter of rulebook.chapters) {
      for (const section of chapter.sections) {
        for (const entry of section.entries) {
          total += 1;
          expect(index.entries.get(entry.id)?.entry.id).toBe(entry.id);
        }
      }
    }
    expect(index.entries.size).toBe(total);
  });

  it("indexes every chapter by id", () => {
    const index = buildRulebookIndex(rulebook);
    expect(index.chapters.size).toBe(rulebook.chapters.length);
  });
});
