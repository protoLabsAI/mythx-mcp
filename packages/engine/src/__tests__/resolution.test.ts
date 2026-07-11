/**
 * Tests for test and combat resolution with advantage/disadvantage
 */

import { describe, it, expect } from "vitest";
import { resolveTest } from "../resolution/test.js";
import { resolveAttack } from "../resolution/combat.js";
import { createRNG } from "../rng/index.js";
import type { Character, Enemy, Weapon } from "@mythxengine/types";

// Test character factory
function createTestCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "test-char",
    name: "Test Character",
    abilities: { STR: 2, AGI: 1, WIT: 0, CON: 1 },
    hp: { current: 20, max: 20 },
    skills: [
      { id: "combat", name: "Combat", ability: "STR", bonus: 2, description: "Fighting" },
      { id: "stealth", name: "Stealth", ability: "AGI", bonus: 3, description: "Sneaking" },
    ],
    specialAbilities: [],
    conditions: [],
    flags: [],
    background: "Test background",
    personality: [],
    psychology: { fears: [], goals: [], ambitions: [], bonds: [], flaws: [] },
    archetypeId: "test",
    equipment: { weapons: [], armor: null, gear: [] },
    ...overrides,
  };
}

// Test enemy factory
function createTestEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: "test-enemy",
    name: "Test Enemy",
    description: "A test enemy",
    abilities: { STR: 1, AGI: 0, WIT: -1, CON: 0 },
    hp: { current: 15, max: 15 },
    conditions: [],
    attacks: [{ name: "Claw", damage: "d6", ability: "STR" }],
    armor: 1,
    threat: "standard",
    ...overrides,
  };
}

describe("resolveTest with advantage", () => {
  it("returns normal advantage state by default", () => {
    const character = createTestCharacter();
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      skill: "Stealth",
      difficulty: 12,
      rng,
    });

    expect(result.advantageState).toBe("normal");
    expect(result.roll.advantage).toBeUndefined();
  });

  it("applies explicit advantage sources", () => {
    const character = createTestCharacter();
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      skill: "Stealth",
      difficulty: 12,
      rng,
      advantageSources: ["hiding in shadows"],
    });

    expect(result.advantageState).toBe("advantage");
    expect(result.roll.advantage).toBeDefined();
    expect(result.roll.advantage!.type).toBe("advantage");
  });

  it("applies explicit disadvantage sources", () => {
    const character = createTestCharacter();
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      skill: "Stealth",
      difficulty: 12,
      rng,
      disadvantageSources: ["noisy armor"],
    });

    expect(result.advantageState).toBe("disadvantage");
    expect(result.roll.advantage).toBeDefined();
    expect(result.roll.advantage!.type).toBe("disadvantage");
  });

  it("cancels advantage and disadvantage", () => {
    const character = createTestCharacter();
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      skill: "Stealth",
      difficulty: 12,
      rng,
      advantageSources: ["hiding in shadows"],
      disadvantageSources: ["noisy armor"],
    });

    expect(result.advantageState).toBe("normal");
    expect(result.roll.advantage).toBeUndefined();
  });

  it("applies advantage from conditions", () => {
    const character = createTestCharacter({
      conditions: [
        {
          id: "blessed",
          name: "Blessed",
          description: "Advantage on all rolls",
          duration: 3,
          effects: [{ type: "GRANT_ADVANTAGE", scope: "all" }],
          stackable: false,
        },
      ],
    });
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      skill: "Stealth",
      difficulty: 12,
      rng,
    });

    expect(result.advantageState).toBe("advantage");
  });

  it("applies disadvantage from conditions", () => {
    const character = createTestCharacter({
      conditions: [
        {
          id: "cursed",
          name: "Cursed",
          description: "Disadvantage on all rolls",
          duration: 3,
          effects: [{ type: "GRANT_DISADVANTAGE", scope: "skill_tests" }],
          stackable: false,
        },
      ],
    });
    const rng = createRNG(42);

    const result = resolveTest({
      character,
      skill: "Stealth",
      difficulty: 12,
      rng,
    });

    expect(result.advantageState).toBe("disadvantage");
  });

  it("combines explicit and condition advantage sources", () => {
    const character = createTestCharacter({
      conditions: [
        {
          id: "blessed",
          name: "Blessed",
          description: "Advantage",
          duration: 3,
          effects: [{ type: "GRANT_ADVANTAGE", scope: "all" }],
          stackable: false,
        },
      ],
    });
    const rng = createRNG(42);

    // Condition gives advantage, explicit gives disadvantage - should cancel
    const result = resolveTest({
      character,
      skill: "Stealth",
      difficulty: 12,
      rng,
      disadvantageSources: ["darkness"],
    });

    expect(result.advantageState).toBe("normal");
  });
});

describe("resolveAttack with advantage", () => {
  const weapon: Weapon = { name: "Sword", damage: "d8", ability: "STR" };

  it("returns normal advantage state by default", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy();
    const rng = createRNG(42);

    const result = resolveAttack({
      attacker,
      defender,
      weapon,
      rng,
    });

    expect(result.advantageState).toBe("normal");
  });

  it("applies explicit advantage on attacks", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy();
    const rng = createRNG(42);

    const result = resolveAttack({
      attacker,
      defender,
      weapon,
      rng,
      advantageSources: ["flanking"],
    });

    expect(result.advantageState).toBe("advantage");
    expect(result.roll.advantage).toBeDefined();
  });

  it("applies advantage from attacker conditions", () => {
    const attacker = createTestCharacter({
      conditions: [
        {
          id: "hidden",
          name: "Hidden",
          description: "Advantage on attacks",
          duration: "until_rest",
          effects: [{ type: "GRANT_ADVANTAGE", scope: "attacks" }],
          stackable: false,
        },
      ],
    });
    const defender = createTestEnemy();
    const rng = createRNG(42);

    const result = resolveAttack({
      attacker,
      defender,
      weapon,
      rng,
    });

    expect(result.advantageState).toBe("advantage");
  });
});

describe("resolveAttack with resistance/vulnerability", () => {
  const weapon: Weapon = { name: "Fire Blade", damage: "d8", ability: "STR" };

  it("halves damage when defender has resistance", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({
      conditions: [
        {
          id: "fire-resist",
          name: "Fire Resistant",
          description: "Takes half fire damage",
          duration: "permanent",
          effects: [{ type: "RESISTANCE", damageType: "fire" }],
          stackable: false,
        },
      ],
    });
    // Need to find a seed that hits
    let result;
    for (let seed = 1; seed < 1000; seed++) {
      const testRng = createRNG(seed);
      result = resolveAttack({
        attacker,
        defender,
        weapon,
        rng: testRng,
        damageType: "fire",
      });
      if (result.hit && result.damage !== undefined) break;
    }

    expect(result!.hit).toBe(true);
    expect(result!.damageModification).toBeDefined();
    expect(result!.damageModification!.reason).toBe("resistance");
    expect(result!.damageModification!.damageType).toBe("fire");
    expect(result!.damageModification!.finalDamage).toBeLessThan(
      result!.damageModification!.originalDamage
    );
  });

  it("doubles damage when defender has vulnerability", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({
      conditions: [
        {
          id: "fire-vuln",
          name: "Fire Vulnerable",
          description: "Takes double fire damage",
          duration: "permanent",
          effects: [{ type: "VULNERABILITY", damageType: "fire" }],
          stackable: false,
        },
      ],
    });

    // Find a seed that hits
    let result;
    for (let seed = 1; seed < 1000; seed++) {
      const testRng = createRNG(seed);
      result = resolveAttack({
        attacker,
        defender,
        weapon,
        rng: testRng,
        damageType: "fire",
      });
      if (result.hit && result.damage !== undefined) break;
    }

    expect(result!.hit).toBe(true);
    expect(result!.damageModification).toBeDefined();
    expect(result!.damageModification!.reason).toBe("vulnerability");
    expect(result!.damageModification!.finalDamage).toBeGreaterThan(
      result!.damageModification!.originalDamage
    );
  });

  it("cancels resistance and vulnerability", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({
      conditions: [
        {
          id: "fire-resist",
          name: "Fire Resistant",
          description: "Takes half fire damage",
          duration: "permanent",
          effects: [{ type: "RESISTANCE", damageType: "fire" }],
          stackable: false,
        },
        {
          id: "fire-vuln",
          name: "Cursed Vulnerability",
          description: "Takes double fire damage",
          duration: 3,
          effects: [{ type: "VULNERABILITY", damageType: "fire" }],
          stackable: false,
        },
      ],
    });

    // Find a seed that hits
    let result;
    for (let seed = 1; seed < 1000; seed++) {
      const testRng = createRNG(seed);
      result = resolveAttack({
        attacker,
        defender,
        weapon,
        rng: testRng,
        damageType: "fire",
      });
      if (result.hit && result.damage !== undefined) break;
    }

    expect(result!.hit).toBe(true);
    // When they cancel, there should be no damageModification
    expect(result!.damageModification).toBeUndefined();
  });

  it("does not apply resistance to different damage types", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({
      conditions: [
        {
          id: "fire-resist",
          name: "Fire Resistant",
          description: "Takes half fire damage",
          duration: "permanent",
          effects: [{ type: "RESISTANCE", damageType: "fire" }],
          stackable: false,
        },
      ],
    });

    // Find a seed that hits
    let result;
    for (let seed = 1; seed < 1000; seed++) {
      const testRng = createRNG(seed);
      result = resolveAttack({
        attacker,
        defender,
        weapon,
        rng: testRng,
        damageType: "cold", // Different damage type
      });
      if (result.hit && result.damage !== undefined) break;
    }

    expect(result!.hit).toBe(true);
    expect(result!.damageModification).toBeUndefined();
  });
});

describe("resolveAttack effectLevel multiplier", () => {
  function findHittingResult(
    attacker: Character,
    defender: Enemy,
    weapon: Weapon,
    effectLevel: "limited" | "standard" | "great",
    seedStart = 1
  ) {
    for (let seed = seedStart; seed < 5000; seed++) {
      const rng = createRNG(seed);
      const result = resolveAttack({
        attacker,
        defender: { ...defender, hp: { ...defender.hp } },
        weapon,
        rng,
        effectLevel,
      });
      if (result.hit && result.damage !== undefined) {
        return { result, seed };
      }
    }
    throw new Error("No hitting seed in range");
  }

  it("standard effect produces baseline damage", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({ armor: 0 });
    const weapon: Weapon = { name: "Test Sword", damage: "d6", ability: "STR" };

    const { result } = findHittingResult(attacker, defender, weapon, "standard");
    expect(result.effectLevel).toBe("standard");
    expect(result.damage).toBeGreaterThan(0);
  });

  it("limited effect halves damage relative to standard", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({ armor: 0 });
    const weapon: Weapon = { name: "Test Sword", damage: "d6", ability: "STR" };

    // Same seed → same dice → standard vs limited differ only by multiplier.
    const baseSeed = 7;
    const standardResult = resolveAttack({
      attacker,
      defender: { ...defender, hp: { ...defender.hp } },
      weapon,
      rng: createRNG(baseSeed),
      effectLevel: "standard",
    });
    const limitedResult = resolveAttack({
      attacker,
      defender: { ...defender, hp: { ...defender.hp } },
      weapon,
      rng: createRNG(baseSeed),
      effectLevel: "limited",
    });

    if (standardResult.hit && standardResult.damage !== undefined) {
      expect(limitedResult.hit).toBe(true);
      expect(limitedResult.damage).toBe(Math.floor(standardResult.damage * 0.5));
      expect(limitedResult.effectLevel).toBe("limited");
    }
  });

  it("great effect scales damage to 1.5×", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({ armor: 0 });
    const weapon: Weapon = { name: "Test Sword", damage: "d6", ability: "STR" };

    const baseSeed = 7;
    const standardResult = resolveAttack({
      attacker,
      defender: { ...defender, hp: { ...defender.hp } },
      weapon,
      rng: createRNG(baseSeed),
      effectLevel: "standard",
    });
    const greatResult = resolveAttack({
      attacker,
      defender: { ...defender, hp: { ...defender.hp } },
      weapon,
      rng: createRNG(baseSeed),
      effectLevel: "great",
    });

    if (standardResult.hit && standardResult.damage !== undefined) {
      expect(greatResult.hit).toBe(true);
      expect(greatResult.damage).toBe(Math.floor(standardResult.damage * 1.5));
      expect(greatResult.effectLevel).toBe("great");
    }
  });

  it("missing effectLevel defaults to standard (1× damage)", () => {
    const attacker = createTestCharacter();
    const defender = createTestEnemy({ armor: 0 });
    const weapon: Weapon = { name: "Test Sword", damage: "d6", ability: "STR" };

    const baseSeed = 7;
    const explicit = resolveAttack({
      attacker,
      defender: { ...defender, hp: { ...defender.hp } },
      weapon,
      rng: createRNG(baseSeed),
      effectLevel: "standard",
    });
    const implicit = resolveAttack({
      attacker,
      defender: { ...defender, hp: { ...defender.hp } },
      weapon,
      rng: createRNG(baseSeed),
    });

    expect(implicit.damage).toBe(explicit.damage);
    expect(implicit.effectLevel).toBe("standard");
  });

  it("scales graze damage on partial hits too", () => {
    const attacker = createTestCharacter({ abilities: { STR: 0, AGI: 0, WIT: 0, CON: 0 } });
    const defender = createTestEnemy({
      abilities: { STR: 0, AGI: 4, WIT: 0, CON: 0 },
      armor: 0,
    });
    const weapon: Weapon = { name: "Test Sword", damage: "d6", ability: "STR" };

    // Search for a seed that produces a partial outcome with both
    // standard and great effect levels (same seed → same roll → same outcome).
    for (let seed = 1; seed < 5000; seed++) {
      const standardResult = resolveAttack({
        attacker,
        defender: { ...defender, hp: { ...defender.hp } },
        weapon,
        rng: createRNG(seed),
        effectLevel: "standard",
      });
      if (standardResult.outcome !== "partial" || standardResult.grazeDamage === undefined) {
        continue;
      }
      const greatResult = resolveAttack({
        attacker,
        defender: { ...defender, hp: { ...defender.hp } },
        weapon,
        rng: createRNG(seed),
        effectLevel: "great",
      });
      expect(greatResult.outcome).toBe("partial");
      expect(greatResult.grazeDamage).toBe(Math.floor((standardResult.grazeDamage ?? 0) * 1.5));
      return;
    }
    throw new Error("No seed found that produces a partial outcome — adjust test setup.");
  });
});
