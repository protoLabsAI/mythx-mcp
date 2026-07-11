/**
 * World Book Generation Tools
 *
 * Generates world-specific books from WorldContentPacks:
 * - gm-book.txt - GM-only content (full spoilers)
 * - player-book.txt - Player-facing content (no spoilers)
 * - bestiary.txt - All monsters
 * - campaign-setting.txt - World overview
 * - appendices/ - Items, conditions, encounters
 */

import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import type { MCPToolEntry } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";
import { connectionId } from "@mythxengine/worlds";
import { loadWorldPack, getWorldBooksDir, getRulesDir } from "../../state/worldpacks.js";

/**
 * Book types that can be generated
 */
type BookType = "gm" | "player" | "bestiary" | "setting" | "items" | "conditions" | "encounters";

/**
 * Input schema for generate_world_books
 */
const GenerateWorldBooksInput = z.object({
  packId: z.string().describe("World pack ID to generate books for"),
  books: z
    .array(z.enum(["gm", "player", "bestiary", "setting", "all"]))
    .optional()
    .describe("Which books to generate (default: all)"),
});

/**
 * Build the system prompt for book generation
 */
function getBookSystemPrompt(): string {
  return `You are a technical writer creating RPG source books for Game Masters and players.

The output format is plain text optimized for zine printing:
- Use === lines for major section headers (centered title between === lines)
- Use --- lines for subsection headers
- Use *text* for emphasis
- Use fixed-width columns for tables (pad with spaces)
- Use <<<PAGE>>> for page breaks
- Maximum line width: 50 characters
- Keep language evocative but concise

Generate ONLY the formatted text content. No markdown. No code blocks.`;
}

/**
 * Build prompt for GM book
 */
function buildGMBookPrompt(pack: WorldContentPack): string {
  const locations = Object.values(pack.locations);
  const npcs = Object.values(pack.npcs);
  const situations = pack.situations ? Object.values(pack.situations) : [];
  const arcs = pack.arcs ? Object.values(pack.arcs) : [];
  const narrative = pack.narrativeGuidance;

  return `Create a GM Book for "${pack.meta.name}".

World Overview:
- Tagline: ${pack.meta.tagline}
- Tone: ${pack.meta.aesthetic.tone}
- Themes: ${pack.meta.aesthetic.themes.join(", ")}
- Lethality: ${pack.meta.settings.lethality}
- Magic Level: ${pack.meta.settings.magicLevel}

Include these sections:

1. RUNNING THIS WORLD
- Overview of the setting
- Key conflicts and tensions
- Session zero suggestions
- Tone and pacing guidance

2. OPENING SCENES
${(narrative?.openingScenes || []).map((s) => `- ${s}`).join("\n") || "- Suggest 3 compelling opening scenes"}

3. SITUATIONS (story nodes)
${situations
  .map(
    (s) => `
${s.name}:
- Status: ${s.status}
- Stakes: ${JSON.stringify(s.stakes)}
- Actors: ${(s.actors || []).map((a) => a.entityId).join(", ") || "none"}
- Clock: ${s.clock?.name || "none"}
`
  )
  .join("\n")}

4. STORY ARCS
${arcs
  .map(
    (a) => `
${a.name}: ${a.description}
- Central tension: ${a.tension.centralConflict}
- Situations: ${a.situationIds.join(", ")}
`
  )
  .join("\n")}

5. LOCATIONS (with secrets)
${locations
  .map(
    (l) => `
${l.name} (${l.type}):
- ${l.description}
- Secrets: ${(l.secrets || []).join("; ") || "none"}
- GM Notes: ${l.gmNotes || "none"}
`
  )
  .join("\n")}

6. NPCs (full details)
${npcs
  .map(
    (n) => `
${n.name} (${n.narrativeRole}):
- ${n.description}
- Motivation: ${n.motivation}
- Secrets: ${(n.secrets || []).join("; ") || "none"}
`
  )
  .join("\n")}

7. ENCOUNTER TABLES
- Random encounters by location
- Scaling guidance

Format as a printable zine with page breaks between major sections.`;
}

/**
 * Build prompt for Player book (no spoilers)
 */
function buildPlayerBookPrompt(pack: WorldContentPack): string {
  const archetypes = Object.values(pack.archetypes);
  const locations = Object.values(pack.locations);
  const npcs = Object.values(pack.npcs);
  const items = Object.values(pack.items);

  return `Create a Player Book for "${pack.meta.name}".

World Overview:
- Tagline: ${pack.meta.tagline}
- Tone: ${pack.meta.aesthetic.tone}
- Themes: ${pack.meta.aesthetic.themes.join(", ")}
- Magic Level: ${pack.meta.settings.magicLevel}
- Technology: ${pack.meta.settings.technologyLevel}

IMPORTANT: This is for PLAYERS. Do NOT include:
- Location secrets
- NPC secrets or hidden motivations
- Plot spoilers
- GM-only information

Include these sections:

1. WORLD OVERVIEW
- What the world is about
- The current situation (public knowledge)
- What adventurers do here

2. CHARACTER ARCHETYPES
${archetypes
  .map(
    (a) => `
${a.name}
- ${a.tagline}
- ${a.description}
- Playstyle: ${a.playstyle}
- Starting Abilities: STR ${a.starting.abilities.STR >= 0 ? "+" : ""}${a.starting.abilities.STR}, AGI ${a.starting.abilities.AGI >= 0 ? "+" : ""}${a.starting.abilities.AGI}, WIT ${a.starting.abilities.WIT >= 0 ? "+" : ""}${a.starting.abilities.WIT}, CON ${a.starting.abilities.CON >= 0 ? "+" : ""}${a.starting.abilities.CON}
- HP: ${a.starting.hp}
- Features: ${a.features.map((f) => f.name).join(", ")}
`
  )
  .join("\n")}

3. KNOWN LOCATIONS
${locations
  .map(
    (l) => `
${l.name} (${l.type}):
- ${l.description}
- Atmosphere: ${l.atmosphere || "mysterious"}
`
  )
  .join("\n")}

4. KNOWN FIGURES
${npcs
  .map(
    (n) => `
${n.name}: ${n.narrativeRole}
- ${n.description}
`
  )
  .join("\n")}

5. EQUIPMENT CATALOG
${items
  .slice(0, 20)
  .map((i) => `- ${i.name}: ${i.description}`)
  .join("\n")}

6. QUICK REFERENCE
- Difficulty levels
- Common actions
- Rest and recovery

Format as a printable zine with page breaks between major sections.`;
}

/**
 * Build prompt for Bestiary
 */
function buildBestiaryPrompt(pack: WorldContentPack): string {
  const monsters = Object.values(pack.monsters);
  const byTier = {
    minion: monsters.filter((m) => m.threat === "minion"),
    standard: monsters.filter((m) => m.threat === "standard"),
    elite: monsters.filter((m) => m.threat === "elite"),
    boss: monsters.filter((m) => m.threat === "boss"),
  };

  const formatAbilityLine = (m: (typeof monsters)[0]): string => {
    if (!m.abilities) return "";
    const sign = (n: number) => (n >= 0 ? "+" : "");
    const a = m.abilities;
    return `\nSTR ${sign(a.STR)}${a.STR} AGI ${sign(a.AGI)}${a.AGI} WIT ${sign(a.WIT)}${a.WIT} CON ${sign(a.CON)}${a.CON}`;
  };
  const formatMonster = (m: (typeof monsters)[0]) => `
${m.name} (${m.threat})
HP: ${m.hp} | Armor: ${m.armor}${formatAbilityLine(m)}
Attacks: ${m.attacks.map((a) => `${a.name} (${a.damage})`).join(", ")}
${m.specialAbilities?.length ? `Special: ${m.specialAbilities.join(", ")}` : ""}
Tactics: ${m.tactics?.specialBehavior || "Standard combat"}
Lore: ${m.lore}
Encounter: ${m.encounterText}
Death: ${m.deathText}
`;

  return `Create a Bestiary for "${pack.meta.name}".

World: ${pack.meta.tagline}

Organize monsters by threat tier with full stat blocks.

MINIONS (HP 4-6, easy kills)
${byTier.minion.map(formatMonster).join("\n")}

STANDARD (HP 10-14, regular threats)
${byTier.standard.map(formatMonster).join("\n")}

ELITE (HP 18-24, dangerous foes)
${byTier.elite.map(formatMonster).join("\n")}

BOSS (HP 30-40, major encounters)
${byTier.boss.map(formatMonster).join("\n")}

For each monster include:
1. Stat block (HP, Armor, Abilities, Attacks)
2. Tactics and behavior
3. Lore and background
4. Encounter description
5. Death/defeat description

Format as a printable zine with clear stat blocks and page breaks between tiers.`;
}

/**
 * Build prompt for Campaign Setting
 */
function buildSettingPrompt(pack: WorldContentPack): string {
  const locations = Object.values(pack.locations);
  const factions = pack.factions ? Object.values(pack.factions) : [];

  return `Create a Campaign Setting book for "${pack.meta.name}".

World Details:
- Name: ${pack.meta.name}
- Tagline: ${pack.meta.tagline}
- Visual Style: ${pack.meta.aesthetic.visualStyle}
- Tone: ${pack.meta.aesthetic.tone}
- Themes: ${pack.meta.aesthetic.themes.join(", ")}
- Inspirations: ${pack.meta.aesthetic.inspirations?.join(", ") || "various"}
- Lethality: ${pack.meta.settings.lethality}
- Magic Level: ${pack.meta.settings.magicLevel}
- Technology: ${pack.meta.settings.technologyLevel}
- Supernatural: ${pack.meta.settings.supernaturalPresence}

Include these sections:

1. WORLD OVERVIEW
- The land and its history
- Current state of affairs
- Major powers and conflicts

2. GEOGRAPHY
${locations
  .map(
    (l) => `
${l.name}:
- Type: ${l.type}
- ${l.description}
- Features: ${l.features?.join(", ") || "none listed"}
- Connections: ${l.connections?.length ? l.connections.map(connectionId).join(", ") : "isolated"}
`
  )
  .join("\n")}

3. FACTIONS
${
  factions
    .map(
      (f) => `
${f.name}:
- ${f.description}
- Goals: ${f.goals?.join(", ") || "unknown"}
- Resources: ${f.resources?.join(", ") || "unknown"}
`
    )
    .join("\n") || "Describe 3-5 major factions based on the world themes"
}

4. CULTURES & PEOPLES
- Who lives here
- Social structures
- Customs and beliefs

5. MAGIC & TECHNOLOGY
- How magic works (if present)
- Technology level
- Supernatural elements

6. APPENDICES
- Timeline of major events
- Common languages
- Currency and trade

Format as a printable zine with page breaks between major sections.`;
}

/**
 * generate_world_books tool
 */
export const generateWorldBooksTool: MCPToolEntry = {
  name: "generate_world_books",
  description:
    "Generate book prompts for a world pack. Returns prompts for GM book, player book, bestiary, and campaign setting.",
  inputSchema: {
    type: "object",
    properties: {
      packId: {
        type: "string",
        description: "World pack ID to generate books for",
      },
      books: {
        type: "array",
        items: {
          type: "string",
          enum: ["gm", "player", "bestiary", "setting", "all"],
        },
        description: "Which books to generate (default: all)",
      },
    },
    required: ["packId"],
  },
  handler: async (args: unknown) => {
    const input = GenerateWorldBooksInput.parse(args);

    // Load the world pack
    const pack = await loadWorldPack(input.packId);
    if (!pack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    // Determine which books to generate (treat empty array as "all")
    const requestedBooks = input.books && input.books.length > 0 ? input.books : ["all"];
    const generateAll = requestedBooks.includes("all");
    const booksToGenerate = generateAll
      ? (["gm", "player", "bestiary", "setting"] as const)
      : (requestedBooks.filter((b) => b !== "all") as BookType[]);

    // Build prompts for each book
    const prompts: Record<string, { system: string; user: string }> = {};
    const systemPrompt = getBookSystemPrompt();

    for (const bookType of booksToGenerate) {
      let userPrompt: string;
      switch (bookType) {
        case "gm":
          userPrompt = buildGMBookPrompt(pack);
          break;
        case "player":
          userPrompt = buildPlayerBookPrompt(pack);
          break;
        case "bestiary":
          userPrompt = buildBestiaryPrompt(pack);
          break;
        case "setting":
          userPrompt = buildSettingPrompt(pack);
          break;
        default:
          continue;
      }
      prompts[bookType] = { system: systemPrompt, user: userPrompt };
    }

    const directory = getWorldBooksDir(input.packId);

    return {
      packId: input.packId,
      worldName: pack.meta.name,
      directory,
      prompts,
      message: `Generation prompts ready for ${Object.keys(prompts).length} books. Execute each prompt and call save_book_result for each.`,
    };
  },
};

/**
 * Input schema for save_book_result
 */
const SaveBookResultInput = z.object({
  packId: z.string().describe("World pack ID"),
  bookType: z
    .enum(["gm", "player", "bestiary", "setting", "items", "conditions", "encounters", "rulebook"])
    .describe("Type of book being saved"),
  content: z.string().describe("The generated book content"),
});

/**
 * save_book_result tool
 */
export const saveBookResultTool: MCPToolEntry = {
  name: "save_book_result",
  description: "Save generated book content to a file.",
  inputSchema: {
    type: "object",
    properties: {
      packId: {
        type: "string",
        description: "World pack ID",
      },
      bookType: {
        type: "string",
        enum: [
          "gm",
          "player",
          "bestiary",
          "setting",
          "items",
          "conditions",
          "encounters",
          "rulebook",
        ],
        description: "Type of book being saved",
      },
      content: {
        type: "string",
        description: "The generated book content",
      },
    },
    required: ["packId", "bookType", "content"],
  },
  handler: async (args: unknown) => {
    const input = SaveBookResultInput.parse(args);

    // Use pack ID for directory (pack may not exist yet during generation)
    const worldDir = getWorldBooksDir(input.packId);

    // Determine file path based on book type
    let filePath: string;
    switch (input.bookType) {
      case "gm":
        filePath = join(worldDir, "gm-book.txt");
        break;
      case "player":
        filePath = join(worldDir, "player-book.txt");
        break;
      case "bestiary":
        filePath = join(worldDir, "bestiary.txt");
        break;
      case "setting":
        filePath = join(worldDir, "campaign-setting.txt");
        break;
      case "items":
        await mkdir(join(worldDir, "appendices"), { recursive: true });
        filePath = join(worldDir, "appendices", "items.txt");
        break;
      case "conditions":
        await mkdir(join(worldDir, "appendices"), { recursive: true });
        filePath = join(worldDir, "appendices", "conditions.txt");
        break;
      case "encounters":
        await mkdir(join(worldDir, "appendices"), { recursive: true });
        filePath = join(worldDir, "appendices", "encounters.txt");
        break;
      case "rulebook": {
        // Rulebook goes to shared rules directory
        const rulesDir = getRulesDir();
        await mkdir(rulesDir, { recursive: true });
        filePath = join(rulesDir, "core-rules.txt");
        break;
      }
      default:
        throw new Error(`Unknown book type: ${input.bookType}`);
    }

    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Write content
    await writeFile(filePath, input.content, "utf-8");

    return {
      message: `Book saved successfully`,
      bookType: input.bookType,
      path: filePath,
      packId: input.packId,
    };
  },
};

/**
 * Input schema for generate_appendices
 */
const GenerateAppendicesInput = z.object({
  packId: z.string().describe("World pack ID"),
  types: z
    .array(z.enum(["items", "conditions", "encounters"]))
    .optional()
    .describe("Which appendices to generate (default: all)"),
});

/**
 * generate_appendices tool
 */
export const generateAppendiciesTool: MCPToolEntry = {
  name: "generate_appendices",
  description: "Generate appendices (items, conditions, encounters) for a world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: {
        type: "string",
        description: "World pack ID",
      },
      types: {
        type: "array",
        items: {
          type: "string",
          enum: ["items", "conditions", "encounters"],
        },
        description: "Which appendices to generate (default: all)",
      },
    },
    required: ["packId"],
  },
  handler: async (args: unknown) => {
    const input = GenerateAppendicesInput.parse(args);

    const pack = await loadWorldPack(input.packId);
    if (!pack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    // Treat empty array as "generate all" (same as undefined)
    const types =
      Array.isArray(input.types) && input.types.length > 0
        ? input.types
        : ["items", "conditions", "encounters"];
    const prompts: Record<string, { system: string; user: string }> = {};
    const systemPrompt = getBookSystemPrompt();

    for (const type of types) {
      let userPrompt: string;

      switch (type) {
        case "items": {
          const items = Object.values(pack.items);
          const formatItemStats = (i: (typeof items)[0]) => {
            if (i.weapon) return `Damage: ${i.weapon.damage}, ${i.weapon.ability}`;
            if (i.armor) return `DR: ${i.armor.damageReduction}`;
            if (i.consumable) return `Uses: ${i.consumable.uses}, Effect: ${i.consumable.effect}`;
            return "";
          };
          userPrompt = `Create an Item Catalog for "${pack.meta.name}".

Format each item with:
- Name
- Type (weapon/armor/consumable/special/misc)
- Description
- Stats if applicable
- Cost/rarity

Items:
${items
  .map(
    (i) => `
${i.name} (${i.kind})
${i.description}
${formatItemStats(i)}
`
  )
  .join("\n")}

Organize by type with clear headers.`;
          break;
        }

        case "conditions": {
          const conditions = Object.values(pack.conditions);
          userPrompt = `Create a Conditions Reference for "${pack.meta.name}".

Format each condition with:
- Name
- Effect
- Duration
- How to remove

Conditions:
${conditions
  .map(
    (c) => `
${c.name}
Effect: ${c.description}
Duration: ${c.duration}
`
  )
  .join("\n")}

Include a quick-reference table at the end.`;
          break;
        }

        case "encounters": {
          const encounters = Object.values(pack.encounters);
          userPrompt = `Create Encounter Tables for "${pack.meta.name}".

Format encounters by type (combat/social/event):
- Name
- Description
- GM Guidance
- Scaling notes

Encounters:
${encounters
  .map(
    (e) => `
${e.name} (${e.type})
${e.description}
GM Guidance: ${e.gmGuidance || "standard"}
`
  )
  .join("\n")}

Include random encounter tables by location.`;
          break;
        }
      }

      prompts[type] = { system: systemPrompt, user: userPrompt! };
    }

    const directory = getWorldBooksDir(input.packId);

    return {
      packId: input.packId,
      worldName: pack.meta.name,
      directory: join(directory, "appendices"),
      prompts,
      message: `Appendix prompts ready. Execute each prompt and call save_book_result.`,
    };
  },
};

/**
 * Export world book tools
 */
export const worldbookTools = [generateWorldBooksTool, saveBookResultTool, generateAppendiciesTool];
