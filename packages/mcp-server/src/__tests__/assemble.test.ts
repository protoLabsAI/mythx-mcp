import { describe, it, expect } from "vitest";
import { mergeById } from "@mythxengine/tools";

interface TestItem {
  id: string;
  name?: string;
  value?: number;
  nested?: {
    a?: number;
    b?: number;
  };
  tags?: string[];
}

describe("mergeById", () => {
  it("returns base items when no expansions", () => {
    const base: TestItem[] = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ];

    const result = mergeById(base, []);
    expect(result).toEqual(base);
  });

  it("adds new items from expansions", () => {
    const base: TestItem[] = [{ id: "a", name: "Alpha" }];
    const expanded: TestItem[] = [{ id: "b", name: "Beta" }];

    const result = mergeById(base, expanded);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.id === "b")).toEqual({ id: "b", name: "Beta" });
  });

  it("deep merges matching items by ID", () => {
    const base: TestItem[] = [{ id: "x", name: "Original", value: 1, nested: { a: 10, b: 20 } }];
    const expanded: TestItem[] = [{ id: "x", value: 99, nested: { b: 200 } }];

    const result = mergeById(base, expanded);
    expect(result[0]).toEqual({
      id: "x",
      name: "Original", // preserved
      value: 99, // overwritten
      nested: { a: 10, b: 200 }, // deep merged
    });
  });

  it("does not mutate original arrays", () => {
    const base: TestItem[] = [{ id: "a", name: "Original", nested: { a: 1 } }];
    const expanded: TestItem[] = [{ id: "a", nested: { b: 2 } }];

    const baseCopy = JSON.parse(JSON.stringify(base));
    mergeById(base, expanded);

    expect(base).toEqual(baseCopy);
  });

  it("handles complex archetype-like expansion", () => {
    interface Archetype {
      id: string;
      name: string;
      features: string[];
      stats: { hp: number; armor: number };
      skills?: string[];
    }

    const base: Archetype[] = [
      {
        id: "fighter",
        name: "Fighter",
        features: ["Attack", "Defend"],
        stats: { hp: 12, armor: 2 },
      },
    ];

    const expanded: Archetype[] = [
      {
        id: "fighter",
        name: "Fighter",
        features: ["Attack", "Defend"],
        stats: { hp: 12, armor: 2 },
        skills: ["Cleave", "Shield Bash"],
      },
    ];

    const result = mergeById(base, expanded);
    const fighter = result[0];

    expect(fighter.name).toBe("Fighter");
    expect(fighter.features).toEqual(["Attack", "Defend"]);
    expect(fighter.stats).toEqual({ hp: 12, armor: 2 });
    expect(fighter.skills).toEqual(["Cleave", "Shield Bash"]);
  });

  it("preserves order with base items first", () => {
    const base: TestItem[] = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ];
    const expanded: TestItem[] = [
      { id: "c", value: 3 },
      { id: "a", value: 100 },
    ];

    const result = mergeById(base, expanded);
    const ids = result.map((i) => i.id);

    expect(ids).toEqual(["a", "b", "c"]);
    expect(result[0].value).toBe(100); // merged value
  });
});
