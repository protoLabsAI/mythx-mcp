import { describe, it, expect } from "vitest";
import {
  detectEntityType,
  extractEntityId,
  resolveEntityLookup,
  searchEntities,
  getEntityCounts,
  listEntityIds,
} from "../lookup/entity-resolver.js";
import { formatEntityAsMarkdown, formatMultipleEntities } from "../lookup/formatter.js";
import type { WorldContentPack } from "@mythxengine/worlds";

// Minimal mock world pack for testing
const mockWorldPack: WorldContentPack = {
  meta: {
    id: "test-world",
    name: "Test World",
    tagline: "A test world",
    version: "1.0.0",
    aesthetic: { visualStyle: "fantasy", inspirations: [], palette: [] },
    settings: {
      era: "medieval",
      magicLevel: "medium",
      technologyLevel: "medieval",
      tone: { primary: "adventure", secondary: [] },
    },
    contentCounts: {
      archetypes: 1,
      items: 1,
      monsters: 1,
      encounters: 1,
      locations: 1,
      npcs: 1,
      conditions: 1,
    },
  },
  archetypes: {
    warrior: {
      id: "warrior",
      name: "Warrior",
      tagline: "Master of arms",
      description: "A skilled fighter",
      starting: { hp: 12, abilities: { STR: 3, AGI: 1, WIT: 0, CON: 2 } },
      startingItems: ["sword", "leather-armor"],
      features: [{ name: "Combat Training", description: "+1 to attack rolls", sourceLevel: 1 }],
      playstyle: "Front-line combatant",
      background: "Military training",
      flavor: "Iron and blood",
    },
  },
  items: {
    sword: {
      id: "sword",
      name: "Steel Sword",
      kind: "weapon",
      description: "A reliable blade",
      flavor: "Forged in the northern mountains",
      tags: ["martial", "metal"],
      slots: 1,
      weapon: { damage: "d8", ability: "STR", properties: [] },
    },
    "leather-armor": {
      id: "leather-armor",
      name: "Leather Armor",
      kind: "armor",
      description: "Light protection",
      flavor: "Worn but sturdy",
      tags: ["light"],
      slots: 2,
      armor: { damageReduction: 1, properties: [] },
    },
  },
  monsters: {
    goblin: {
      id: "goblin",
      name: "Goblin",
      description: "A small, nasty creature",
      hp: 4,
      armor: 0,
      abilities: { STR: -1, AGI: 2, WIT: 0, CON: -1 },
      threat: "minion",
      attacks: [{ name: "Rusty Dagger", damage: "d4", description: "A quick stab" }],
      specialAbilities: ["Pack Tactics"],
      morale: { breakpoint: "50% HP or allies flee", fleeBehavior: "scatter" },
      tactics: { preferred: "ambush", fallback: "flee", targetPriority: "isolated" },
      lore: "Goblins live in tribes",
      encounterText: "You hear chittering in the shadows",
      deathText: "The goblin falls with a shriek",
    },
  },
  encounters: {
    "goblin-ambush": {
      id: "goblin-ambush",
      name: "Goblin Ambush",
      type: "combat",
      description: "Goblins attack from hiding",
      text: "Arrows fly from the bushes!",
      gmGuidance: "Start with surprise round",
      outcomes: ["Victory: loot", "Flee: lose supplies"],
      combat: {
        monsters: [{ monsterId: "goblin", count: 3 }],
        surprise: "enemies",
      },
    },
  },
  conditions: {
    poisoned: {
      id: "poisoned",
      name: "Poisoned",
      description: "Taking ongoing damage",
      duration: 3,
      effects: [{ type: "MODIFY_ABILITY", ability: "CON", amount: -2 }],
      stackable: false,
    },
  },
  locations: {
    "forest-clearing": {
      id: "forest-clearing",
      name: "Forest Clearing",
      description: "A peaceful glade",
      type: "wilderness",
      atmosphere: "Dappled sunlight",
      features: ["Old oak tree", "Small stream"],
      connections: ["dark-cave"],
      encounters: ["goblin-ambush"],
      npcs: ["old-hermit"],
      secrets: ["Hidden cache under oak"],
      gmNotes: "Good spot for random encounters",
    },
    "dark-cave": {
      id: "dark-cave",
      name: "Dark Cave",
      description: "A foreboding entrance",
      type: "dungeon",
      atmosphere: "Cold and damp",
      features: ["Stalactites", "Bat colony"],
      connections: ["forest-clearing"],
      encounters: [],
      npcs: [],
    },
  },
  npcs: {
    "old-hermit": {
      id: "old-hermit",
      name: "Old Hermit",
      description: "A weathered old man",
      personality: "Cryptic but kind",
      motivation: "Protect the forest",
      attitude: "neutral",
      dialogueHints: ["Speaks in riddles", "Knows local history"],
      narrativeRole: "information",
      locations: ["forest-clearing"],
      secrets: ["Was once a knight"],
    },
  },
  narrativeGuidance: {
    themes: ["nature vs civilization"],
    toneGuide: "Light adventure",
    openingHook: "A mysterious letter arrives",
    sampleScenes: [],
    gmTips: [],
  },
} as unknown as WorldContentPack;

describe("detectEntityType", () => {
  it("detects monster from keywords", () => {
    expect(detectEntityType("find the monster")).toBe("monster");
    expect(detectEntityType("enemy stats")).toBe("monster");
    expect(detectEntityType("creature details")).toBe("monster");
  });

  it("detects npc from keywords", () => {
    expect(detectEntityType("who is this npc")).toBe("npc");
    expect(detectEntityType("character info")).toBe("npc");
  });

  it("detects location from keywords", () => {
    expect(detectEntityType("location details")).toBe("location");
    expect(detectEntityType("the town")).toBe("location");
  });

  it("returns null for ambiguous queries", () => {
    expect(detectEntityType("hello world")).toBeNull();
    expect(detectEntityType("")).toBeNull();
  });
});

describe("extractEntityId", () => {
  it("extracts quoted strings", () => {
    expect(extractEntityId('find "goblin-warrior"')).toBe("goblin-warrior");
    expect(extractEntityId("find 'Old Hermit'")).toBe("old-hermit");
  });

  it("extracts ID-like patterns", () => {
    expect(extractEntityId("monster goblin-warrior stats")).toBe("goblin-warrior");
  });

  it("extracts name words after type keyword", () => {
    expect(extractEntityId("monster goblin")).toBe("goblin");
    expect(extractEntityId("npc hermit")).toBe("hermit");
  });
});

describe("resolveEntityLookup", () => {
  it("finds entity by exact ID", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "monster",
      id: "goblin",
    });

    expect(result.found).toBe(true);
    expect(result.entity).not.toBeNull();
    expect((result.entity as { name: string }).name).toBe("Goblin");
  });

  it("finds entity by case-insensitive ID", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "monster",
      id: "GOBLIN",
    });

    expect(result.found).toBe(true);
  });

  it("finds entity by fuzzy name match", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "npc",
      id: "old hermit",
    });

    expect(result.found).toBe(true);
    expect((result.entity as { name: string }).name).toBe("Old Hermit");
  });

  it("returns not found for missing entity", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "monster",
      id: "dragon",
    });

    expect(result.found).toBe(false);
    expect(result.entity).toBeNull();
    expect(result.error).toContain("not found");
  });

  it("strips secrets when includeSecrets is false", () => {
    const withSecrets = resolveEntityLookup(mockWorldPack, {
      type: "npc",
      id: "old-hermit",
      includeSecrets: true,
    });

    const withoutSecrets = resolveEntityLookup(mockWorldPack, {
      type: "npc",
      id: "old-hermit",
      includeSecrets: false,
    });

    expect((withSecrets.entity as { secrets?: string[] }).secrets).toBeDefined();
    expect((withoutSecrets.entity as { secrets?: string[] }).secrets).toBeUndefined();
  });

  it("resolves references when requested", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "location",
      id: "forest-clearing",
      resolveReferences: true,
    });

    expect(result.found).toBe(true);
    expect(result.references).toBeDefined();
    expect(result.references?.connections).toHaveLength(1);
    expect(result.references?.npcs).toHaveLength(1);
  });
});

describe("searchEntities", () => {
  it("finds entities by name", () => {
    const results = searchEntities(mockWorldPack, "goblin");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Goblin");
  });

  it("returns empty array for no matches", () => {
    const results = searchEntities(mockWorldPack, "xyzzyx");
    expect(results).toHaveLength(0);
  });

  it("respects type filter", () => {
    const results = searchEntities(mockWorldPack, "goblin", ["npc"]);
    expect(results).toHaveLength(0);
  });

  it("respects limit", () => {
    const results = searchEntities(mockWorldPack, "a", undefined, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe("getEntityCounts", () => {
  it("returns counts for all types", () => {
    const counts = getEntityCounts(mockWorldPack);

    expect(counts.monster).toBe(1);
    expect(counts.npc).toBe(1);
    expect(counts.location).toBe(2);
    expect(counts.item).toBe(2);
  });
});

describe("listEntityIds", () => {
  it("lists all IDs for a type", () => {
    const ids = listEntityIds(mockWorldPack, "location");
    expect(ids).toContain("forest-clearing");
    expect(ids).toContain("dark-cave");
  });

  it("returns empty array for unknown type", () => {
    const ids = listEntityIds(mockWorldPack, "unknown" as never);
    expect(ids).toHaveLength(0);
  });
});

describe("formatEntityAsMarkdown", () => {
  it("formats monster with full details", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "monster",
      id: "goblin",
    });
    const markdown = formatEntityAsMarkdown(result, { template: "full", accessLevel: "gm" });

    expect(markdown).toContain("## Goblin");
    expect(markdown).toContain("**Threat:** minion");
    expect(markdown).toContain("**HP:** 4");
    expect(markdown).toContain("Rusty Dagger");
    expect(markdown).toContain("### Morale");
    expect(markdown).toContain("### Tactics");
  });

  it("formats monster with summary template", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "monster",
      id: "goblin",
    });
    const markdown = formatEntityAsMarkdown(result, { template: "summary" });

    expect(markdown).toContain("## Goblin");
    expect(markdown).toContain("**HP:** 4");
    // Summary includes attacks but not full GM info
  });

  it("formats location with references", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "location",
      id: "forest-clearing",
      resolveReferences: true,
    });
    const markdown = formatEntityAsMarkdown(result, {
      template: "full",
      accessLevel: "gm",
      includeReferences: true,
    });

    expect(markdown).toContain("## Forest Clearing");
    expect(markdown).toContain("**Type:** wilderness");
    expect(markdown).toContain("### Connections");
    expect(markdown).toContain("Dark Cave");
    expect(markdown).toContain("### NPCs");
    expect(markdown).toContain("Old Hermit");
    expect(markdown).toContain("### Secrets (GM Only)");
  });

  it("hides secrets for player access", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "location",
      id: "forest-clearing",
      includeSecrets: false,
    });
    const markdown = formatEntityAsMarkdown(result, {
      template: "full",
      accessLevel: "player",
    });

    expect(markdown).toContain("## Forest Clearing");
    expect(markdown).not.toContain("### Secrets");
    expect(markdown).not.toContain("Hidden cache");
  });

  it("formats not found result", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "monster",
      id: "dragon",
    });
    const markdown = formatEntityAsMarkdown(result);

    expect(markdown).toContain("**Not Found:**");
    expect(markdown).toContain("monster/dragon");
  });

  it("formats encounter with combat setup", () => {
    const result = resolveEntityLookup(mockWorldPack, {
      type: "encounter",
      id: "goblin-ambush",
      resolveReferences: true,
    });
    const markdown = formatEntityAsMarkdown(result, {
      template: "full",
      accessLevel: "gm",
      includeReferences: true,
    });

    expect(markdown).toContain("## Goblin Ambush");
    expect(markdown).toContain("**Type:** combat");
    expect(markdown).toContain("### Combat");
    expect(markdown).toContain("3x **Goblin** (minion)");
  });
});

describe("formatMultipleEntities", () => {
  it("formats multiple results with separators", () => {
    const results = [
      resolveEntityLookup(mockWorldPack, { type: "monster", id: "goblin" }),
      resolveEntityLookup(mockWorldPack, { type: "npc", id: "old-hermit" }),
    ];

    const markdown = formatMultipleEntities(results, { template: "reference" });

    expect(markdown).toContain("## Goblin");
    expect(markdown).toContain("---");
    expect(markdown).toContain("## Old Hermit");
  });
});
