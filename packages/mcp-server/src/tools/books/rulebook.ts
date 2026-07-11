/**
 * Rulebook Generation Tools
 *
 * Generates the core rulebook (cached, shared across all worlds).
 * Produces:
 * - core-rules.txt - Complete rulebook
 * - quick-reference.txt - One-page reference card
 * - character-sheet.txt - Printable character sheet template
 */

import { z } from "zod";
import { writeFile, mkdir, access } from "fs/promises";
import { join } from "path";
import type { MCPToolEntry } from "@mythxengine/types";
import { getRulesDir } from "../../state/worldpacks.js";

// Rules directory (configurable via RPG_MCP_DATA_DIR env var)
const RULES_DIR = getRulesDir();

/**
 * Check if the rulebook already exists
 */
async function rulebookExists(): Promise<boolean> {
  try {
    await access(join(RULES_DIR, "core-rules.txt"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Input schema for generate_rulebook
 */
const GenerateRulebookInput = z.object({
  force: z.boolean().optional().describe("Force regeneration even if cached"),
});

/**
 * generate_rulebook tool
 *
 * Returns cached rulebook path if exists, or a prompt for LLM to generate it.
 */
export const generateRulebookTool: MCPToolEntry = {
  name: "generate_rulebook",
  description:
    "Generate the core rulebook. Returns cached path if exists, or a prompt for LLM execution if generation is needed.",
  inputSchema: {
    type: "object",
    properties: {
      force: {
        type: "boolean",
        description: "Force regeneration even if cached",
      },
    },
  },
  handler: async (args: unknown) => {
    const input = GenerateRulebookInput.parse(args);

    // Check cache
    if (!input.force && (await rulebookExists())) {
      return {
        cached: true,
        path: join(RULES_DIR, "core-rules.txt"),
        message: "Rulebook already exists. Use force: true to regenerate.",
      };
    }

    // Generate prompt for LLM
    const systemPrompt = `You are a technical writer creating a concise rulebook for a tabletop RPG system.

The output format is plain text optimized for zine printing:
- Use === lines for major section headers (centered title between === lines)
- Use --- lines for subsection headers
- Use *text* for emphasis
- Use fixed-width columns for tables (pad with spaces)
- Use <<<PAGE>>> for page breaks
- Maximum line width: 50 characters
- Keep language concise and action-oriented

Generate ONLY the formatted text content. No markdown. No code blocks.`;

    const userPrompt = `Create a complete core rulebook for the RPG MCP system. Include these sections:

==================================================
               CORE RULES
==================================================

1. THE BASICS
- d20 test system: Roll d20 + ability modifier + skill vs difficulty
- 4 abilities: STR (melee, breaking), AGI (ranged, stealth), WIT (knowledge, magic), CON (endurance, willpower)
- Ability modifiers range from -3 to +3
- Skills add +1 to +3 to relevant tests

2. DIFFICULTY LEVELS
--------------------------------------------------
Difficulty          DC    When to Use
--------------------------------------------------
EASY                8     Routine with pressure
STANDARD           12     Normal challenge
HARD               16     Expert-level
EXTREME            20     Near-impossible
--------------------------------------------------

3. TESTS
When outcome is uncertain and failure is interesting:
- GM sets difficulty and ability
- Player rolls d20 + ability + skill
- Meet or beat DC = success
- Natural 20 = critical success (extra effect)
- Natural 1 = critical failure (complication)

4. ADVANTAGE & DISADVANTAGE
- Advantage: Roll 2d20, take higher
- Disadvantage: Roll 2d20, take lower
- Sources cancel out (2 advantages + 1 disadvantage = 1 advantage)

5. COMBAT
Turn order:
1. Roll initiative (d20 + AGI)
2. On your turn: Move + Action
3. Attack: d20 + ability vs target's defense (10 + AGI + armor)
4. Damage: Roll weapon die, subtract armor

Combat conditions:
- Wounded: -2 to all tests
- Stunned: Lose next turn
- Prone: -2 defense, half movement to stand

6. DAMAGE & HEALING
- HP = 10 + CON for starting characters
- At 0 HP: Incapacitated, death save each turn
- Death save: CON test DC 12, 3 failures = death
- Short rest (1 hour): Recover 1d6 + CON HP
- Long rest (8 hours): Recover all HP

7. CHARACTER CREATION
1. Choose archetype (defines starting abilities, HP, features)
2. Note starting equipment
3. Choose name and background

<<<PAGE>>>

==================================================
            QUICK REFERENCE CARD
==================================================

DIFFICULTIES
Easy 8 | Standard 12 | Hard 16 | Extreme 20

ABILITIES
STR - Melee, break, lift
AGI - Ranged, dodge, stealth
WIT - Know, perceive, magic
CON - Endure, resist, focus

COMBAT TURN
1. Move (up to 30 ft)
2. Action (attack, cast, use item, etc.)

ATTACK ROLL
d20 + ability vs 10 + target AGI + armor

CONDITIONS
Wounded   -2 to all tests
Stunned   Lose next turn
Prone     -2 defense, half move to stand

DEATH & DYING
0 HP = Incapacitated
Each turn: CON test DC 12
3 failures = death
Stabilize at 1 HP on success

<<<PAGE>>>

==================================================
           CHARACTER SHEET
==================================================

NAME: ________________________________

ARCHETYPE: ___________________________

LEVEL: _______  HP: _____ / _____

--------------------------------------------------
              ABILITIES
--------------------------------------------------
STR [ ]  AGI [ ]  WIT [ ]  CON [ ]

--------------------------------------------------
              DEFENSE
--------------------------------------------------
Base: 10 + AGI [ ] + Armor [ ] = [ ]

--------------------------------------------------
               SKILLS
--------------------------------------------------
_______________ +___   _______________ +___
_______________ +___   _______________ +___
_______________ +___   _______________ +___

--------------------------------------------------
              FEATURES
--------------------------------------------------
____________________________
____________________________
____________________________

--------------------------------------------------
              EQUIPMENT
--------------------------------------------------
____________________________
____________________________
____________________________
____________________________
____________________________

--------------------------------------------------
               NOTES
--------------------------------------------------
____________________________
____________________________
____________________________
____________________________

<<<PAGE>>>

Output the complete rulebook in the format shown above.`;

    return {
      cached: false,
      prompt: {
        system: systemPrompt,
        user: userPrompt,
        outputFormat: "text",
      },
      stepId: "rulebook",
      rulesDir: RULES_DIR,
      message:
        "Execute the prompt to generate rulebook content, then call save_book_result with bookType: 'rulebook'.",
    };
  },
};

/**
 * Input schema for save_rulebook_result
 */
const SaveRulebookResultInput = z.object({
  content: z.string().describe("The generated rulebook content"),
});

/**
 * save_rulebook_result tool
 *
 * Saves the generated rulebook content to files.
 */
export const saveRulebookResultTool: MCPToolEntry = {
  name: "save_rulebook_result",
  description: "Save the generated rulebook content to files.",
  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The generated rulebook content",
      },
    },
    required: ["content"],
  },
  handler: async (args: unknown) => {
    const input = SaveRulebookResultInput.parse(args);

    // Ensure directory exists
    await mkdir(RULES_DIR, { recursive: true });

    // Split content by page breaks
    const pages = input.content.split("<<<PAGE>>>");

    // Warn if expected page structure is missing
    if (pages.length === 1) {
      console.warn(
        "[rulebook] Warning: No <<<PAGE>>> markers found in content. " +
          "Expected 3 pages (core rules, quick reference, character sheet). " +
          "Only core-rules.txt will be written."
      );
    }

    // Save core rules (full content)
    const coreRulesPath = join(RULES_DIR, "core-rules.txt");
    await writeFile(coreRulesPath, input.content, "utf-8");

    // Extract and save quick reference (second page if exists)
    const quickRefPath = join(RULES_DIR, "quick-reference.txt");
    if (pages.length >= 2) {
      await writeFile(quickRefPath, pages[1].trim(), "utf-8");
    }

    // Extract and save character sheet (third page if exists)
    const charSheetPath = join(RULES_DIR, "character-sheet.txt");
    if (pages.length >= 3) {
      await writeFile(charSheetPath, pages[2].trim(), "utf-8");
    }

    // Build files object conditionally based on what was actually written
    const files: Record<string, string> = {
      coreRules: coreRulesPath,
    };
    if (pages.length >= 2) {
      files.quickReference = quickRefPath;
    }
    if (pages.length >= 3) {
      files.characterSheet = charSheetPath;
    }

    return {
      message: "Rulebook saved successfully",
      files,
    };
  },
};

/**
 * Export rulebook tools
 */
export const rulebookTools = [generateRulebookTool, saveRulebookResultTool];
