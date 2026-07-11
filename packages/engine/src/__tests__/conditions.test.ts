import { describe, it, expect } from "vitest";
import type { Condition, GameTime } from "@mythxengine/types";
import {
  addCondition,
  removeCondition,
  removeAllConditionsById,
  isConditionExpired,
  getActiveConditions,
  getConditionsWithEffect,
  getEffectsOfType,
  getTotalAbilityModifier,
  getTotalSkillModifier,
  hasAdvantage,
  hasDisadvantage,
  getResistance,
  getVulnerability,
  tickConditionDurations,
  clearRestConditions,
} from "../conditions/stacking.js";
import { compareGameTime } from "../time/expiration.js";

// Test fixtures
const makeCondition = (overrides: Partial<Condition> = {}): Condition => ({
  id: "test",
  name: "Test",
  description: "A test condition",
  duration: 3,
  effects: [],
  stackable: false,
  ...overrides,
});

const wounded: Condition = {
  id: "wounded",
  name: "Wounded",
  description: "-1 to all tests",
  duration: "until_rest",
  effects: [
    { type: "MODIFY_ABILITY", ability: "STR", amount: -1 },
    { type: "MODIFY_ABILITY", ability: "AGI", amount: -1 },
  ],
  stackable: false,
};

const blessed: Condition = {
  id: "blessed",
  name: "Blessed",
  description: "Advantage on all rolls",
  duration: 3,
  effects: [{ type: "GRANT_ADVANTAGE", scope: "all" }],
  stackable: false,
};

const fireResistant: Condition = {
  id: "fire_resistant",
  name: "Fire Resistant",
  description: "Half fire damage",
  duration: "permanent",
  effects: [{ type: "RESISTANCE", damageType: "fire" }],
  stackable: false,
};

const fireVulnerable: Condition = {
  id: "fire_vulnerable",
  name: "Fire Vulnerable",
  description: "Double fire damage",
  duration: "permanent",
  effects: [{ type: "VULNERABILITY", damageType: "fire" }],
  stackable: false,
};

describe("addCondition", () => {
  it("adds a new condition", () => {
    const result = addCondition({
      conditions: [],
      condition: wounded,
    });

    expect(result.added).toBe(true);
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0].id).toBe("wounded");
  });

  it("prevents duplicate non-stackable conditions", () => {
    const result = addCondition({
      conditions: [wounded],
      condition: wounded,
    });

    expect(result.added).toBe(false);
    expect(result.conditions).toHaveLength(1);
    expect(result.message).toContain("non-stackable");
  });

  it("allows duplicate stackable conditions", () => {
    const stackableCondition = makeCondition({
      id: "stack",
      name: "Stackable",
      stackable: true,
    });

    const result = addCondition({
      conditions: [stackableCondition],
      condition: stackableCondition,
    });

    expect(result.added).toBe(true);
    expect(result.conditions).toHaveLength(2);
    expect(result.message).toContain("stacked");
  });
});

describe("removeCondition", () => {
  it("removes a condition by ID", () => {
    const result = removeCondition({
      conditions: [wounded, blessed],
      conditionId: "wounded",
    });

    expect(result.removed).toBe(true);
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0].id).toBe("blessed");
  });

  it("returns false if condition not found", () => {
    const result = removeCondition({
      conditions: [wounded],
      conditionId: "nonexistent",
    });

    expect(result.removed).toBe(false);
    expect(result.conditions).toHaveLength(1);
  });
});

describe("removeAllConditionsById", () => {
  it("removes all instances of a stackable condition", () => {
    const stack1 = makeCondition({ id: "stack", stackable: true });
    const stack2 = makeCondition({ id: "stack", stackable: true });

    const result = removeAllConditionsById([stack1, stack2, wounded], "stack");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wounded");
  });
});

describe("compareGameTime", () => {
  it("returns negative when a < b", () => {
    const a: GameTime = { day: 1, hour: 10, minute: 0 };
    const b: GameTime = { day: 1, hour: 12, minute: 0 };
    expect(compareGameTime(a, b)).toBeLessThan(0);
  });

  it("returns positive when a > b", () => {
    const a: GameTime = { day: 2, hour: 10, minute: 0 };
    const b: GameTime = { day: 1, hour: 12, minute: 0 };
    expect(compareGameTime(a, b)).toBeGreaterThan(0);
  });

  it("returns 0 when equal", () => {
    const a: GameTime = { day: 1, hour: 10, minute: 30 };
    const b: GameTime = { day: 1, hour: 10, minute: 30 };
    expect(compareGameTime(a, b)).toBe(0);
  });
});

describe("isConditionExpired", () => {
  const currentTime: GameTime = { day: 1, hour: 12, minute: 0 };

  it("permanent conditions never expire", () => {
    expect(isConditionExpired(fireResistant, currentTime)).toBe(false);
  });

  it("until_rest conditions don't expire by time", () => {
    expect(isConditionExpired(wounded, currentTime)).toBe(false);
  });

  it("time-based condition expires when time passes", () => {
    const condition = makeCondition({
      expiresAtGameTime: { day: 1, hour: 11, minute: 0 },
    });
    expect(isConditionExpired(condition, currentTime)).toBe(true);
  });

  it("time-based condition not expired when time hasn't passed", () => {
    const condition = makeCondition({
      expiresAtGameTime: { day: 1, hour: 13, minute: 0 },
    });
    expect(isConditionExpired(condition, currentTime)).toBe(false);
  });
});

describe("getActiveConditions", () => {
  it("filters out expired conditions", () => {
    const currentTime: GameTime = { day: 1, hour: 12, minute: 0 };
    const expired = makeCondition({
      id: "expired",
      expiresAtGameTime: { day: 1, hour: 10, minute: 0 },
    });
    const active = makeCondition({
      id: "active",
      expiresAtGameTime: { day: 1, hour: 14, minute: 0 },
    });

    const result = getActiveConditions([expired, active, wounded], currentTime);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain("active");
    expect(result.map((c) => c.id)).toContain("wounded");
  });
});

describe("getConditionsWithEffect", () => {
  it("finds conditions with specific effect type", () => {
    const conditions = [wounded, blessed, fireResistant];
    const result = getConditionsWithEffect(conditions, "GRANT_ADVANTAGE");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("blessed");
  });
});

describe("getEffectsOfType", () => {
  it("extracts all effects of a type", () => {
    const conditions = [wounded, blessed];
    const effects = getEffectsOfType(conditions, "MODIFY_ABILITY");

    expect(effects).toHaveLength(2);
    expect(effects[0].ability).toBe("STR");
    expect(effects[1].ability).toBe("AGI");
  });
});

describe("getTotalAbilityModifier", () => {
  it("sums modifiers for a specific ability", () => {
    const conditions = [
      wounded,
      makeCondition({
        id: "bonus",
        effects: [{ type: "MODIFY_ABILITY", ability: "STR", amount: 2 }],
      }),
    ];

    const result = getTotalAbilityModifier(conditions, "STR");
    expect(result).toBe(1); // -1 + 2
  });

  it("returns 0 if no modifiers", () => {
    const result = getTotalAbilityModifier([blessed], "STR");
    expect(result).toBe(0);
  });
});

describe("getTotalSkillModifier", () => {
  it("sums modifiers for a specific skill", () => {
    const conditions = [
      makeCondition({
        id: "c1",
        effects: [{ type: "MODIFY_SKILL", skillId: "combat", amount: -2 }],
      }),
      makeCondition({
        id: "c2",
        effects: [{ type: "MODIFY_SKILL", skillId: "combat", amount: 1 }],
      }),
    ];

    const result = getTotalSkillModifier(conditions, "combat");
    expect(result).toBe(-1);
  });
});

describe("hasAdvantage", () => {
  it("returns true if condition grants advantage for scope", () => {
    expect(hasAdvantage([blessed], "attacks")).toBe(true);
    expect(hasAdvantage([blessed], "defense")).toBe(true);
  });

  it("returns false if no advantage condition", () => {
    expect(hasAdvantage([wounded], "attacks")).toBe(false);
  });

  it("matches specific scope", () => {
    const attackAdvantage = makeCondition({
      id: "atk",
      effects: [{ type: "GRANT_ADVANTAGE", scope: "attacks" }],
    });
    expect(hasAdvantage([attackAdvantage], "attacks")).toBe(true);
    expect(hasAdvantage([attackAdvantage], "defense")).toBe(false);
  });
});

describe("hasDisadvantage", () => {
  it("returns true if condition grants disadvantage", () => {
    const cursed = makeCondition({
      id: "cursed",
      effects: [{ type: "GRANT_DISADVANTAGE", scope: "all" }],
    });
    expect(hasDisadvantage([cursed], "attacks")).toBe(true);
  });
});

describe("getResistance", () => {
  it("returns resistance info for matching damage type", () => {
    const result = getResistance([fireResistant], "fire");

    expect(result).not.toBeNull();
    expect(result?.multiplier).toBe(0.5);
    expect(result?.source).toBe("Fire Resistant");
  });

  it("returns null if no resistance", () => {
    const result = getResistance([fireResistant], "cold");
    expect(result).toBeNull();
  });

  it("handles case-insensitive damage types", () => {
    const result = getResistance([fireResistant], "FIRE");
    expect(result).not.toBeNull();
  });
});

describe("getVulnerability", () => {
  it("returns vulnerability info for matching damage type", () => {
    const result = getVulnerability([fireVulnerable], "fire");

    expect(result).not.toBeNull();
    expect(result?.multiplier).toBe(2);
    expect(result?.source).toBe("Fire Vulnerable");
  });

  it("returns null if no vulnerability", () => {
    const result = getVulnerability([fireVulnerable], "cold");
    expect(result).toBeNull();
  });
});

describe("tickConditionDurations", () => {
  it("decrements numeric durations", () => {
    const { conditions, expired } = tickConditionDurations([blessed]);

    expect(conditions).toHaveLength(1);
    expect(conditions[0].duration).toBe(2);
    expect(expired).toHaveLength(0);
  });

  it("removes conditions when duration reaches 0", () => {
    const aboutToExpire = makeCondition({ duration: 1 });
    const { conditions, expired } = tickConditionDurations([aboutToExpire]);

    expect(conditions).toHaveLength(0);
    expect(expired).toHaveLength(1);
    expect(expired[0].id).toBe("test");
  });

  it("does not tick permanent conditions", () => {
    const { conditions } = tickConditionDurations([fireResistant]);
    expect(conditions[0].duration).toBe("permanent");
  });

  it("does not tick until_rest conditions", () => {
    const { conditions } = tickConditionDurations([wounded]);
    expect(conditions[0].duration).toBe("until_rest");
  });
});

describe("clearRestConditions", () => {
  it("removes until_rest conditions", () => {
    const { conditions, cleared } = clearRestConditions([wounded, blessed, fireResistant]);

    expect(conditions).toHaveLength(2);
    expect(cleared).toHaveLength(1);
    expect(cleared[0].id).toBe("wounded");
  });

  it("keeps permanent and numeric conditions", () => {
    const { conditions } = clearRestConditions([blessed, fireResistant]);

    expect(conditions).toHaveLength(2);
  });
});
