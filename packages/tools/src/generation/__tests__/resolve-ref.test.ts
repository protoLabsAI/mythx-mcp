/**
 * Tests for `resolveRef` / `resolveRefs` — the fuzzy-match helper
 * that recovers from wave-1/wave-2 manifest drift (e.g. typo'd
 * cross-references like `nanoite-repair-paste` vs the canonical
 * `nanite-repair-paste`).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveRef, resolveRefs } from "../manifest-helpers.js";

const items = new Set([
  "item:nanite-repair-paste",
  "item:plasma-cutter",
  "item:oxygen-recycler-mask",
  "item:emp-grenade",
]);

describe("resolveRef", () => {
  it("returns exact matches unchanged", () => {
    const r = resolveRef("item:plasma-cutter", items);
    expect(r.outcome).toBe("exact");
    expect(r.resolved).toBe("item:plasma-cutter");
  });

  it("fuzzy-matches a single-char typo (distance 1)", () => {
    const r = resolveRef("item:nanoite-repair-paste", items);
    expect(r.outcome).toBe("fuzzy");
    expect(r.resolved).toBe("item:nanite-repair-paste");
  });

  it("fuzzy-matches a two-char typo (distance 2)", () => {
    // "plazma" vs "plasma" = distance 1 (z↔s); add another char to push to 2
    const r = resolveRef("item:plazsma-cutter", items);
    expect(r.outcome).toBe("fuzzy");
    expect(r.resolved).toBe("item:plasma-cutter");
  });

  it("misses when distance exceeds threshold", () => {
    // "rifle-pulse" is a transposition of "pulse-rifle" — Levenshtein
    // distance for full reordering is way more than 2
    const refs = new Set(["item:pulse-rifle"]);
    const r = resolveRef("item:rifle-pulse", refs);
    expect(r.outcome).toBe("missing");
    expect(r.resolved).toBeNull();
  });

  it("misses when the manifest is empty", () => {
    const r = resolveRef("item:any", new Set());
    expect(r.outcome).toBe("missing");
  });

  it("treats ambiguous fuzzy matches as misses (no silent guess)", () => {
    // Two manifest entries equidistant from the input — must NOT pick one
    const tied = new Set(["item:cat", "item:bat"]);
    const r = resolveRef("item:hat", tied); // distance 1 to both
    expect(r.outcome).toBe("missing");
    expect(r.resolved).toBeNull();
  });

  it("does not match across very different IDs even at small distance", () => {
    // "xxx" has no near match in the manifest
    const r = resolveRef("item:xxx", items);
    expect(r.outcome).toBe("missing");
  });
});

describe("resolveRefs", () => {
  // Suppress the warn output in tests; it's a logged side-effect we
  // cover with a separate spy assertion below
  afterEach(() => vi.restoreAllMocks());

  it("preserves exact matches and substitutes fuzzy matches", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveRefs(
      ["item:plasma-cutter", "item:nanoite-repair-paste", "item:emp-grenade"],
      items,
      "test"
    );
    expect(result).toEqual(["item:plasma-cutter", "item:nanite-repair-paste", "item:emp-grenade"]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Fuzzy-resolved 1"));
  });

  it("drops missing refs and warns", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveRefs(["item:emp-grenade", "item:totally-unrelated-thing"], items, "test");
    expect(result).toEqual(["item:emp-grenade"]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Dropped 1 unresolvable"));
  });

  it("returns empty for empty input without warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveRefs([], items, "test")).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
