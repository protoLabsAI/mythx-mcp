/**
 * Generate Engagement Hooks Tool (Shared)
 *
 * Generate personalized engagement hooks for a situation, location, or theme.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { resolveRawSituations } from "../situations/index.js";

/**
 * Input schema for generate_engagement_hooks
 */
export const GenerateEngagementHooksInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  situationId: z.string().optional().describe("Situation to generate hooks for"),
  locationId: z.string().optional().describe("Location context"),
  theme: z.string().optional().describe("Thematic focus (optional)"),
});

export type GenerateEngagementHooksInput = z.infer<typeof GenerateEngagementHooksInputSchema>;

/**
 * Hook types
 */
const _HOOK_TYPES = ["personal", "treasure", "mystery", "threat"] as const;
type HookType = (typeof _HOOK_TYPES)[number];

/**
 * Output type for generate_engagement_hooks
 */
export interface GenerateEngagementHooksOutput {
  context: {
    situationId?: string;
    situationName?: string;
    locationId?: string;
    locationName?: string;
    theme?: string;
    partySize: number;
  };
  hooks: Array<{
    type: HookType;
    description: string;
    delivery: string;
    forCharacter?: string;
  }>;
  engagementPrinciples: string[];
  tip: string;
}

/**
 * Character analysis helper
 */
interface CharacterAnalysis {
  themes: string[];
}

/**
 * Analyze character for personalization hooks
 */
function analyzeCharacter(character: { name: string; background?: string }): CharacterAnalysis {
  const themes: string[] = [];

  // Parse background for themes
  const background = (character.background || "").toLowerCase();

  // Common RPG themes
  const themePatterns: [RegExp, string][] = [
    [/family|parent|child|sibling|orphan/, "family"],
    [/home|village|town|city|birthplace|homeland/, "homeland"],
    [/mentor|teacher|master|train/, "mentorship"],
    [/revenge|vendetta|hunt|enemy|betrayed/, "revenge"],
    [/lost|missing|search|find|seek/, "quest"],
    [/debt|owe|promise|oath|vow/, "obligation"],
    [/crime|guilt|sin|secret|hide/, "guilt"],
    [/faith|god|divine|sacred|temple/, "faith"],
    [/wealth|gold|treasure|rich|poor/, "wealth"],
    [/honor|duty|code|order|law/, "honor"],
    [/magic|arcane|power|gift|curse/, "magic"],
    [/war|battle|soldier|fought|veteran/, "warfare"],
    [/love|heart|beloved|marry|partner/, "love"],
    [/death|dead|grave|mourning|loss/, "death"],
    [/guild|organization|order|brotherhood/, "faction"],
  ];

  for (const [pattern, theme] of themePatterns) {
    if (pattern.test(background)) {
      themes.push(theme);
    }
  }

  return { themes };
}

/**
 * Generate engagement hooks tool definition
 */
export const generateEngagementHooksTool = defineSharedTool({
  name: "generate_engagement_hooks",
  description: "Generate personalized engagement hooks for a situation, location, or theme.",
  inputSchema: GenerateEngagementHooksInputSchema,

  handler: async (input, ctx): Promise<GenerateEngagementHooksOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Gather context
    const characters = Object.values(session.characters) as Array<{
      id: string;
      name: string;
      background?: string;
      personality?: string[];
    }>;

    const situations = (await resolveRawSituations(ctx, session)) as Array<{
      id: string;
      name: string;
      hook?: string;
      tension?: string;
    }>;

    const locations =
      (session.generation?.generatedContent?.locations as Array<{
        id: string;
        name: string;
        description?: string;
      }>) || [];

    const situation = input.situationId ? situations.find((s) => s.id === input.situationId) : null;
    const location = input.locationId ? locations.find((l) => l.id === input.locationId) : null;

    const hooks: Array<{
      type: HookType;
      description: string;
      delivery: string;
      forCharacter?: string;
    }> = [];

    // Generate PERSONAL hooks for each character
    for (const char of characters.slice(0, 3)) {
      const analysis = analyzeCharacter(char);

      if (analysis.themes.length > 0) {
        const theme = analysis.themes[0];
        hooks.push({
          type: "personal",
          description: `Connection to ${char.name}'s ${theme} theme`,
          delivery: `Reference their backstory when describing the situation`,
          forCharacter: char.name,
        });
      }
    }

    // Generate TREASURE hooks
    hooks.push({
      type: "treasure",
      description: "Valuable information packaged as physical item",
      delivery: "A letter, journal, or artifact contains crucial plot info",
    });

    hooks.push({
      type: "treasure",
      description: "Reward tied to investigation",
      delivery: "Solving this mystery leads to both answers and material reward",
    });

    // Generate MYSTERY hooks
    if (situation) {
      hooks.push({
        type: "mystery",
        description: `Fragmentary clues about ${situation.name}`,
        delivery: "Break the truth into pieces found in different locations",
      });
    }

    hooks.push({
      type: "mystery",
      description: "Contradictory information",
      delivery: "Two sources give conflicting accounts - which is true?",
    });

    hooks.push({
      type: "mystery",
      description: "Ominous warning without context",
      delivery: "Someone says 'Don't trust the...' before they're interrupted",
    });

    // Generate THREAT hooks
    hooks.push({
      type: "threat",
      description: "Immediate danger to someone they care about",
      delivery: "An NPC ally is threatened if they don't act",
    });

    hooks.push({
      type: "threat",
      description: "Ticking clock with consequences",
      delivery: "Something terrible happens if they don't resolve this in time",
    });

    // Add theme-specific hooks
    if (input.theme) {
      const themeLower = input.theme.toLowerCase();

      if (themeLower.includes("corruption")) {
        hooks.push({
          type: "mystery",
          description: "The corruption has a source that must be found",
          delivery: "Track the corruption to its origin through symptoms and witnesses",
        });
      }

      if (themeLower.includes("betrayal")) {
        hooks.push({
          type: "personal",
          description: "An ally may not be what they seem",
          delivery: "Small inconsistencies in behavior hint at hidden agenda",
        });
      }

      if (themeLower.includes("rescue")) {
        hooks.push({
          type: "threat",
          description: "The victim's condition worsens over time",
          delivery: "Each delay has visible consequences when they finally arrive",
        });
      }
    }

    // Add location-specific hooks
    if (location) {
      hooks.push({
        type: "treasure",
        description: `Secret of ${location.name}`,
        delivery: `Hidden cache or forgotten knowledge in this location`,
      });
    }

    return {
      context: {
        situationId: input.situationId,
        situationName: situation?.name,
        locationId: input.locationId,
        locationName: location?.name,
        theme: input.theme,
        partySize: characters.length,
      },
      hooks: hooks.slice(0, 10).map((h) => ({
        type: h.type,
        description: h.description,
        delivery: h.delivery,
        forCharacter: h.forCharacter,
      })),
      engagementPrinciples: [
        "PERSONAL: Connect to character backstories and goals",
        "TREASURE: Package information as physical discoveries",
        "MYSTERY: Break truth into fragments for piecing together",
        "THREAT: Create urgency through stakes and deadlines",
      ],
      tip: "Mix hook types to maintain varied engagement. Personal hooks create investment, treasure makes lore tangible, mystery drives investigation, threat creates urgency.",
    };
  },
});
