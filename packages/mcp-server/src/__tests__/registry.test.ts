/**
 * Tool registry tests
 *
 * Asserts the MCP tool registry exposes every bridged domain, has no
 * duplicate tool names, and matches the documented total (CLAUDE.md /
 * README "MCP Tools (N tools)" count). If you add or remove a tool,
 * update EXPECTED_TOTAL and the docs together.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import type { MCPToolEntry, MCPToolRegistry } from "@mythxengine/types";

// The state managers open the SQLite database at import time, so the
// data dir must point somewhere disposable before the tools index loads.
process.env.RPG_MCP_DATA_DIR = mkdtempSync(join(tmpdir(), "mythx-registry-test-"));

const EXPECTED_TOTAL = 158;

/** Tool names per bridged play domain (v0.3.0 additions). */
const BRIDGED_DOMAINS: Record<string, string[]> = {
  stress: ["get_stress", "push_roll", "resist_consequence", "recover_stress", "flashback"],
  lookup: ["quick_research", "batch_lookup", "lookup_rule"],
  location: ["set_party_location"],
  shop: ["browse_shop", "buy_item", "sell_item"],
  rest: ["take_rest"],
  dialogue: ["start_dialogue", "advance_dialogue"],
  inventory: [
    "upgrade_inventory",
    "list_inventory",
    "add_item",
    "remove_item",
    "modify_gold",
    "equip_item",
    "unequip_item",
    "use_item",
    "transfer_item",
  ],
};

let allTools: MCPToolEntry[];
let registry: MCPToolRegistry;

beforeAll(async () => {
  // Dynamic import so the env var above is set before module evaluation.
  const tools = await import("../tools/index.js");
  allTools = tools.allTools;
  registry = tools.createToolRegistry();
});

describe("tool registry", () => {
  it("has no duplicate tool names", () => {
    const names = allTools.map((t) => t.name);
    const dupes = names.filter((name, i) => names.indexOf(name) !== i);
    expect(dupes).toEqual([]);
    expect(registry.size).toBe(allTools.length);
  });

  it(`exposes ${EXPECTED_TOTAL} tools total`, () => {
    expect(allTools.length).toBe(EXPECTED_TOTAL);
  });

  describe.each(Object.entries(BRIDGED_DOMAINS))("%s domain", (_domain, toolNames) => {
    it.each(toolNames)("registers %s", (name) => {
      const entry = registry.get(name);
      expect(entry).toBeDefined();
      expect(entry?.name).toBe(name);
      expect(entry?.description).toBeTruthy();
      expect(entry?.inputSchema).toBeDefined();
      expect(typeof entry?.handler).toBe("function");
    });
  });

  it("does not register imagegen tools (web-app-only infra)", async () => {
    // Assert against the real imagegen tool list rather than hardcoded
    // names, so a rename or addition in the imagegen domain can't
    // silently make this check vacuous.
    const { imagegenTools } = await import("@mythxengine/tools");
    expect(imagegenTools.length).toBeGreaterThan(0);
    for (const tool of imagegenTools) {
      expect(
        registry.get(tool.name),
        `${tool.name} must not be in the MCP registry`
      ).toBeUndefined();
    }
  });

  it("registers notes tools once, via the sessions bridge", () => {
    const addNoteCount = allTools.filter((t) => t.name === "add_note").length;
    const searchNotesCount = allTools.filter((t) => t.name === "search_notes").length;
    expect(addNoteCount).toBe(1);
    expect(searchNotesCount).toBe(1);
  });
});
