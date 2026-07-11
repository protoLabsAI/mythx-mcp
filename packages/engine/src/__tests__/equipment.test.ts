import { describe, it, expect } from "vitest";
import {
  parseWeaponString,
  parseArmorString,
  parseWeapons,
  formatWeaponString,
  formatArmorString,
} from "../equipment/parser.js";

describe("parseWeaponString", () => {
  describe("basic parsing", () => {
    it("parses name only (no parentheses)", () => {
      const result = parseWeaponString("Longsword");
      expect(result).toEqual({
        name: "Longsword",
        damage: "d4",
        ability: "STR",
      });
    });

    it("parses name with damage dice", () => {
      const result = parseWeaponString("Longsword (d8)");
      expect(result).toEqual({
        name: "Longsword",
        damage: "d8",
        ability: "STR",
      });
    });

    it("parses multi-word weapon name", () => {
      const result = parseWeaponString("Great Axe (2d6)");
      expect(result).toEqual({
        name: "Great Axe",
        damage: "2d6",
        ability: "STR",
      });
    });

    it("handles whitespace", () => {
      const result = parseWeaponString("  Sword  ( d8 )  ");
      expect(result.name).toBe("Sword");
      expect(result.damage).toBe("d8");
    });

    it("parses dice expression with damage suffix word (world-gen format)", () => {
      // Archetype starting items emit "(1d4 damage, 6 shots)" — the suffix
      // word and second prop must not block dice extraction.
      const result = parseWeaponString("Snub-nosed .38 revolver (1d6+1 damage, 6 shots)");
      expect(result.name).toBe("Snub-nosed .38 revolver");
      expect(result.damage).toBe("1d6+1");
      expect(result.properties).toEqual(["6 shots"]);
    });

    it("parses dice expression with damage suffix only", () => {
      const result = parseWeaponString("Slim switchblade (1d4 damage)");
      expect(result.name).toBe("Slim switchblade");
      expect(result.damage).toBe("1d4");
      expect(result.properties).toBeUndefined();
    });
  });

  describe("ranged weapons", () => {
    it("parses ranged weapon with AGI ability", () => {
      const result = parseWeaponString("Longbow (d8, ranged)");
      expect(result).toEqual({
        name: "Longbow",
        damage: "d8",
        ability: "AGI",
        properties: ["ranged"],
      });
    });

    it("parses thrown weapon with AGI ability", () => {
      const result = parseWeaponString("Javelin (d6, thrown)");
      expect(result).toEqual({
        name: "Javelin",
        damage: "d6",
        ability: "AGI",
        properties: ["thrown"],
      });
    });

    it("parses crossbow", () => {
      const result = parseWeaponString("Light Crossbow (d8, crossbow)");
      expect(result.ability).toBe("AGI");
      expect(result.properties).toContain("crossbow");
    });
  });

  describe("ability overrides", () => {
    it("parses explicit STR ability", () => {
      const result = parseWeaponString("Hammer (d10, str)");
      expect(result.ability).toBe("STR");
    });

    it("parses explicit AGI ability", () => {
      const result = parseWeaponString("Rapier (d8, agi)");
      expect(result.ability).toBe("AGI");
    });

    it("parses WIT ability for magic weapons", () => {
      const result = parseWeaponString("Fire Bolt (d10, ranged, wit)");
      expect(result).toEqual({
        name: "Fire Bolt",
        damage: "d10",
        ability: "WIT",
        properties: ["ranged"],
      });
    });

    it("parses dexterity as AGI", () => {
      const result = parseWeaponString("Stiletto (d4, dex)");
      expect(result.ability).toBe("AGI");
    });

    it("explicit ability overrides ranged default", () => {
      const result = parseWeaponString("Magic Bow (d8, ranged, str)");
      expect(result.ability).toBe("STR");
    });
  });

  describe("properties", () => {
    it("parses finesse property", () => {
      const result = parseWeaponString("Dagger (d4, finesse)");
      expect(result.properties).toContain("finesse");
    });

    it("parses multiple properties", () => {
      const result = parseWeaponString("Shortsword (d6, light, finesse)");
      expect(result.properties).toContain("light");
      expect(result.properties).toContain("finesse");
    });

    it("excludes dice and ability from properties", () => {
      const result = parseWeaponString("Staff (d6, two-handed, wit)");
      expect(result.properties).toEqual(["two-handed"]);
      expect(result.properties).not.toContain("d6");
      expect(result.properties).not.toContain("wit");
    });
  });

  describe("custom defaults", () => {
    it("uses custom default ability", () => {
      const result = parseWeaponString("Spell", { defaultAbility: "WIT" });
      expect(result.ability).toBe("WIT");
    });

    it("uses custom default damage", () => {
      const result = parseWeaponString("Fists", { defaultDamage: "d2" });
      expect(result.damage).toBe("d2");
    });
  });
});

describe("parseArmorString", () => {
  it("parses armor with numeric value in parens", () => {
    const result = parseArmorString("Chainmail (3)");
    expect(result).toEqual({
      name: "Chainmail",
      value: 3,
    });
  });

  it("parses armor with +N format", () => {
    const result = parseArmorString("Leather (+1)");
    expect(result).toEqual({
      name: "Leather",
      value: 1,
    });
  });

  it("parses armor with description in parens", () => {
    const result = parseArmorString("Light armor (+2 defense)");
    expect(result).toEqual({
      name: "Light armor",
      value: 2,
    });
  });

  it("parses armor with no value", () => {
    const result = parseArmorString("Robes");
    expect(result).toEqual({
      name: "Robes",
      value: 0,
    });
  });

  it("handles whitespace", () => {
    const result = parseArmorString("  Plate Mail  ( 5 )  ");
    expect(result.name).toBe("Plate Mail");
    expect(result.value).toBe(5);
  });
});

describe("parseWeapons", () => {
  it("parses multiple weapon strings", () => {
    const weapons = ["Sword (d8)", "Dagger (d4, finesse)", "Bow (d6, ranged)"];
    const result = parseWeapons(weapons);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Sword");
    expect(result[1].properties).toContain("finesse");
    expect(result[2].ability).toBe("AGI");
  });

  it("applies options to all weapons", () => {
    const weapons = ["Spell 1", "Spell 2"];
    const result = parseWeapons(weapons, {
      defaultAbility: "WIT",
      defaultDamage: "d6",
    });

    expect(result[0].ability).toBe("WIT");
    expect(result[0].damage).toBe("d6");
    expect(result[1].ability).toBe("WIT");
    expect(result[1].damage).toBe("d6");
  });
});

describe("formatWeaponString", () => {
  it("formats basic weapon", () => {
    const result = formatWeaponString({
      name: "Longsword",
      damage: "d8",
      ability: "STR",
    });
    expect(result).toBe("Longsword (d8)");
  });

  it("includes non-STR ability", () => {
    const result = formatWeaponString({
      name: "Staff",
      damage: "d6",
      ability: "WIT",
    });
    expect(result).toBe("Staff (d6, WIT)");
  });

  it("includes properties", () => {
    const result = formatWeaponString({
      name: "Bow",
      damage: "d8",
      ability: "AGI",
      properties: ["ranged"],
    });
    expect(result).toBe("Bow (d8, ranged, AGI)");
  });

  it("omits STR ability (default)", () => {
    const result = formatWeaponString({
      name: "Axe",
      damage: "d10",
      ability: "STR",
      properties: ["two-handed"],
    });
    expect(result).toBe("Axe (d10, two-handed)");
  });
});

describe("formatArmorString", () => {
  it("formats armor with value", () => {
    const result = formatArmorString({ name: "Chainmail", value: 3 });
    expect(result).toBe("Chainmail (3)");
  });

  it("formats armor with zero value as name only", () => {
    const result = formatArmorString({ name: "Robes", value: 0 });
    expect(result).toBe("Robes");
  });
});
