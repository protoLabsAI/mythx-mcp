/**
 * Personalize Content Tool (Shared)
 *
 * Connect abstract information to a PC's backstory, making it personally relevant.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for personalize_content
 */
export const PersonalizeContentInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  content: z.string().describe("The information or event to personalize"),
  characterId: z.string().describe("PC to connect it to"),
});

export type PersonalizeContentInput = z.infer<typeof PersonalizeContentInputSchema>;

/**
 * Output type for personalize_content
 */
export interface PersonalizeContentOutput {
  character: {
    name: string;
    themes: string[];
    connections: string[];
  };
  content: string;
  suggestions: Array<{
    connection: string;
    delivery: string;
    impact: string;
  }>;
  tip: string;
}

/**
 * Character analysis helper
 */
interface CharacterAnalysis {
  themes: string[];
  keywords: string[];
  connections: string[];
}

/**
 * Analyze character for personalization hooks
 */
function analyzeCharacter(character: {
  name: string;
  background?: string;
  personality?: string[];
  flags?: string[];
}): CharacterAnalysis {
  const themes: string[] = [];
  const keywords: string[] = [];
  const connections: string[] = [];

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

  // Extract proper nouns (capitalized words) as potential connections
  const propernounPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
  const matches = character.background?.match(propernounPattern) || [];
  connections.push(...matches.filter((m) => m !== character.name));

  // Personality traits as keywords
  if (character.personality) {
    keywords.push(...character.personality);
  }

  // Flags as keywords
  if (character.flags) {
    keywords.push(...character.flags);
  }

  return { themes, keywords, connections };
}

/**
 * Personalize content tool definition
 */
export const personalizeContentTool = defineSharedTool({
  name: "personalize_content",
  description: "Connect abstract information to a PC's backstory, making it personally relevant.",
  inputSchema: PersonalizeContentInputSchema,

  handler: async (input, ctx): Promise<PersonalizeContentOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const character = session.characters[input.characterId];
    if (!character) {
      throw new Error(`Character not found: ${input.characterId}`);
    }

    const analysis = analyzeCharacter(
      character as {
        name: string;
        background?: string;
        personality?: string[];
        flags?: string[];
      }
    );

    const suggestions: Array<{
      connection: string;
      delivery: string;
      impact: string;
    }> = [];

    // Generate connections based on themes
    if (analysis.themes.includes("family")) {
      suggestions.push({
        connection: "Reminds them of family or home",
        delivery: `"Something about this reminds ${character.name} of home..."`,
        impact: "Emotional investment, protective instinct",
      });
    }

    if (analysis.themes.includes("revenge")) {
      suggestions.push({
        connection: "Connected to their vendetta",
        delivery: `${character.name} recognizes a symbol or name connected to their past`,
        impact: "Personal stakes, urgency to investigate",
      });
    }

    if (analysis.themes.includes("guilt")) {
      suggestions.push({
        connection: "Echoes their past mistakes",
        delivery: `This situation mirrors something ${character.name} wishes they'd done differently`,
        impact: "Redemption opportunity, moral weight",
      });
    }

    if (analysis.themes.includes("faith")) {
      suggestions.push({
        connection: "Religious/philosophical resonance",
        delivery: `${character.name}'s beliefs give them unique insight into this matter`,
        impact: "Expertise moment, faith tested or affirmed",
      });
    }

    if (analysis.themes.includes("mentorship")) {
      suggestions.push({
        connection: "Recalls their mentor's teachings",
        delivery: `${character.name} remembers their mentor speaking of something like this`,
        impact: "Guidance from the past, legacy connection",
      });
    }

    // Add generic suggestions if no strong matches
    if (suggestions.length === 0) {
      suggestions.push({
        connection: "Expertise or past experience",
        delivery: `${character.name} has seen something like this before in their travels`,
        impact: "Character gets to show competence",
      });

      suggestions.push({
        connection: "Personal curiosity",
        delivery: `Something about this catches ${character.name}'s attention specifically`,
        impact: "Player agency, character-driven investigation",
      });
    }

    // Add connections to named entities if found
    for (const namedEntity of analysis.connections.slice(0, 3)) {
      suggestions.push({
        connection: `Connection to ${namedEntity}`,
        delivery: `${character.name} recognizes this is connected to ${namedEntity}`,
        impact: "Backstory integration, world feels personal",
      });
    }

    return {
      character: {
        name: character.name,
        themes: analysis.themes,
        connections: analysis.connections,
      },
      content: input.content,
      suggestions: suggestions.slice(0, 5),
      tip: "Choose the connection that resonates most with current events. Let the player discover the connection rather than telling them outright.",
    };
  },
});
