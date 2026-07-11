/**
 * Tests for the rulebook → Markdown formatter.
 *
 * Coverage:
 *   - Each block kind renders with the expected Markdown shape
 *   - Audience filter respects player/gm/both semantics
 *   - Quick-start render only surfaces flagged entries
 *   - Empty chapters are dropped so the output stays focused
 */

import { describe, it, expect } from "vitest";
import type { Rulebook } from "../schema/structure.js";
import { renderForAudience, renderQuickStart, renderEntry } from "../format.js";
import { buildRulebookIndex } from "../helpers.js";

// Test fixture helpers — all entries get the schema-required
// `summary` and `extensibility` fields. Real fixtures with the full
// shape make sure renderForAudience() works against valid Rulebook
// data, not just a TypeScript-cast subset.
const NON_OVERRIDABLE = { kind: "fixed" as const };

function makeRulebook(): Rulebook {
  return {
    title: "Test Rulebook",
    version: "1.0.0",
    chapters: [
      {
        id: "ch-1",
        number: 1,
        title: "Tests",
        summary: "All about rolling.",
        sections: [
          {
            id: "sec-1",
            title: "Outcomes",
            summary: "Five tiers.",
            entries: [
              {
                id: "1.1-tiers",
                title: "Outcome tiers",
                kind: "mechanic",
                audience: "both",
                summary: "Every test resolves to one of five outcomes.",
                extensibility: NON_OVERRIDABLE,
                surfaceInQuickStart: true,
                tags: [],
                body: [
                  { kind: "prose", text: "Every test resolves to one of five outcomes." },
                  {
                    kind: "table",
                    caption: "The ladder",
                    headers: ["Outcome", "Margin"],
                    rows: [
                      ["critical_success", "≥10"],
                      ["success", "0..9"],
                      ["partial", "-4..-1"],
                      ["failure", "<-4"],
                    ],
                  },
                ],
              },
              {
                id: "1.2-gm-only",
                title: "GM-only details",
                kind: "concept",
                audience: "gm",
                summary: "Hidden from players.",
                extensibility: NON_OVERRIDABLE,
                surfaceInQuickStart: false,
                tags: [],
                body: [{ kind: "prose", text: "Hidden from players." }],
              },
              {
                id: "1.3-player-only",
                title: "Player tips",
                kind: "concept",
                audience: "player",
                summary: "How to play your stress wisely.",
                extensibility: NON_OVERRIDABLE,
                surfaceInQuickStart: true,
                tags: [],
                body: [
                  {
                    kind: "callout",
                    tone: "tip",
                    title: "Spending stress",
                    text: "Push when failure stings; resist when consequences will hurt.",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "ch-2",
        number: 2,
        title: "GM-Only Chapter",
        summary: "Only GM entries.",
        sections: [
          {
            id: "sec-2",
            title: "Behind the screen",
            summary: "Behind the screen.",
            entries: [
              {
                id: "2.1-gm",
                title: "Behind the screen",
                kind: "concept",
                audience: "gm",
                summary: "GM-only details for the curtain side.",
                extensibility: NON_OVERRIDABLE,
                surfaceInQuickStart: false,
                tags: [],
                body: [{ kind: "prose", text: "GM-only." }],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("renderForAudience", () => {
  it("renders prose, table, and callout blocks with markdown shapes", () => {
    const md = renderForAudience(makeRulebook(), "both");
    expect(md).toContain("# Test Rulebook");
    expect(md).toContain("## Chapter 1: Tests");
    expect(md).toContain("### Outcome tiers (1.1-tiers)");
    expect(md).toContain("Every test resolves to one of five outcomes.");
    expect(md).toContain("| Outcome | Margin |");
    expect(md).toContain("| critical_success | ≥10 |");
    expect(md).toContain("**Spending stress**");
  });

  it("includes only player + both entries when audience is 'player'", () => {
    const md = renderForAudience(makeRulebook(), "player");
    expect(md).toContain("Outcome tiers"); // audience: both
    expect(md).toContain("Player tips"); // audience: player
    expect(md).not.toContain("GM-only details");
    expect(md).not.toContain("Behind the screen");
    // Chapter 2 has only gm-audience entries and should be omitted entirely.
    expect(md).not.toContain("## Chapter 2");
  });

  it("includes only gm + both entries when audience is 'gm'", () => {
    const md = renderForAudience(makeRulebook(), "gm");
    expect(md).toContain("Outcome tiers");
    expect(md).toContain("GM-only details");
    expect(md).toContain("Behind the screen");
    expect(md).not.toContain("Player tips");
  });

  it("omits chapters that have no audience-visible entries", () => {
    // With audience player, chapter 2 has zero player entries — header
    // and summary should not render.
    const md = renderForAudience(makeRulebook(), "player");
    expect(md).not.toContain("## Chapter 2");
    expect(md).not.toContain("Only GM entries.");
  });
});

describe("renderQuickStart", () => {
  it("includes only entries marked surfaceInQuickStart", () => {
    const md = renderQuickStart(makeRulebook(), "player");
    expect(md).toContain("Outcome tiers");
    expect(md).toContain("Player tips");
    expect(md).not.toContain("GM-only details");
  });
});

describe("renderEntry", () => {
  it("renders a single entry with id citation in the heading", () => {
    const index = buildRulebookIndex(makeRulebook());
    const loc = index.entries.get("1.1-tiers");
    expect(loc).toBeDefined();
    const md = renderEntry(loc!);
    expect(md.startsWith("### Outcome tiers (1.1-tiers)")).toBe(true);
  });
});
