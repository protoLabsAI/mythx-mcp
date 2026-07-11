/**
 * GM Guidance Helper Functions
 *
 * Pure functions for generating contextual GM advice.
 * These are extracted from the legacy MCP tool for reusability.
 */

import type { GameTime, SessionState, ToolContext } from "@mythxengine/types";
import { resolveRawSituations } from "../situations/index.js";

/**
 * Interface for situation from generated content (for GM guidance)
 */
export interface GuidanceSituation {
  id: string;
  name: string;
  description: string;
  status: string;
  stakes: {
    risks: string[];
    opportunities: string[];
    ifIgnored: string;
  };
  gmGuidance: {
    themes: string[];
    toneNotes: string;
    anticipatedApproaches: Array<{ approach: string; response: string }>;
    foreshadowing?: string[];
  };
  outgoingLeads: Array<{
    id: string;
    information: string;
    targetSituationId: string;
    discovery: {
      method: string;
      description: string;
    };
    prominence: string;
  }>;
}

/**
 * Guidance result structure
 */
export interface GuidanceResult {
  guidance: string;
  principles: string[];
  suggestions: string[];
  tools: string[];
  worldContext?: string;
}

/**
 * Format game time as human-readable string
 */
export function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}

/**
 * Get situations for the session (generated content or world pack)
 */
export async function getSituations(
  ctx: Pick<ToolContext, "worldPacks">,
  session: SessionState
): Promise<GuidanceSituation[]> {
  return (await resolveRawSituations(ctx, session)) as GuidanceSituation[];
}

/**
 * Generate "stuck" guidance
 */
export async function generateStuckGuidance(
  ctx: Pick<ToolContext, "worldPacks">,
  session: SessionState,
  _context?: { locationId?: string; currentActivity?: string }
): Promise<GuidanceResult> {
  const situations = await getSituations(ctx, session);
  const discoveredIds = (session.discoveredLeads || []).map((d) => d.leadId);

  // Find undiscovered leads
  const undiscoveredLeads: Array<{
    situationName: string;
    leadInfo: string;
    method: string;
    description: string;
  }> = [];

  for (const situation of situations) {
    for (const lead of situation.outgoingLeads || []) {
      if (!discoveredIds.includes(lead.id) && lead.prominence !== "obscured") {
        undiscoveredLeads.push({
          situationName: situation.name,
          leadInfo: lead.information,
          method: lead.discovery.method,
          description: lead.discovery.description,
        });
      }
    }
  }

  // Find NPCs who owe favors
  const helpfulNpcs: string[] = [];
  if (session.relationships) {
    for (const rel of Object.values(session.relationships)) {
      if (rel.owes.length > 0 || rel.attitude === "friendly" || rel.attitude === "allied") {
        helpfulNpcs.push(rel.npcName);
      }
    }
  }

  // Check active clocks for urgency
  const urgentClocks = (session.activeClocks || [])
    .filter((c) => c.currentStage >= c.totalStages - 2)
    .map((c) => `${c.name} (${c.doom})`);

  const suggestions: string[] = [];

  // Three Clue Rule suggestions
  if (undiscoveredLeads.length > 0) {
    const lead = undiscoveredLeads[0];
    suggestions.push(`Reveal a lead via ${lead.method}: "${lead.leadInfo}"`);
  }

  // NPC intervention
  if (helpfulNpcs.length > 0) {
    suggestions.push(`Have ${helpfulNpcs[0]} offer assistance or information`);
  }

  // Environmental clue
  suggestions.push("Add an environmental detail that points toward the goal");

  // Cut the scene
  suggestions.push("If truly stuck, cut to a new scene with a clear hook");

  // Clock pressure
  if (urgentClocks.length > 0) {
    suggestions.push(`Remind players of time pressure: ${urgentClocks[0]}`);
  }

  return {
    guidance:
      "Players seem stuck. The Three Clue Rule suggests multiple paths should exist. Consider surfacing an undiscovered lead or having the world offer a new angle.",
    principles: [
      "Three Clue Rule: Ensure 3+ ways to reach important conclusions",
      "World offers angles: NPCs, environment, and events can provide hints",
      "Cut empty time: If stuck for too long, jump to the next interesting thing",
    ],
    suggestions,
    tools: ["get_available_leads", "suggest_lead_opportunity", "get_active_clocks"],
    worldContext:
      undiscoveredLeads.length > 0
        ? `${undiscoveredLeads.length} undiscovered leads available across situations`
        : "Consider adding new leads if none are available",
  };
}

/**
 * Generate "resolution" guidance
 */
export function generateResolutionGuidance(action?: string): GuidanceResult {
  const suggestions: string[] = [];

  // Determine resolution type hints
  if (action) {
    const actionLower = action.toLowerCase();

    if (
      actionLower.includes("search") ||
      actionLower.includes("look") ||
      actionLower.includes("find")
    ) {
      suggestions.push("If obvious, auto-succeed. If hidden, WIT test (STANDARD)");
      suggestions.push("Failure: Find partial info or notice something that complicates things");
    } else if (
      actionLower.includes("attack") ||
      actionLower.includes("hit") ||
      actionLower.includes("fight")
    ) {
      suggestions.push("Use attack tool for combat, describe impact cinematically");
      suggestions.push("Consider advantage/disadvantage from positioning");
    } else if (
      actionLower.includes("talk") ||
      actionLower.includes("convince") ||
      actionLower.includes("persuade")
    ) {
      suggestions.push("WIT test if outcome uncertain; difficulty based on NPC disposition");
      suggestions.push("Failure: NPC reveals their concern or makes a counter-demand");
    } else if (
      actionLower.includes("sneak") ||
      actionLower.includes("hide") ||
      actionLower.includes("stealth")
    ) {
      suggestions.push("AGI test against observer's passive perception");
      suggestions.push("Failure: Spotted but can still act, or makes noise that changes situation");
    } else {
      suggestions.push("Consider: Is outcome uncertain? Are stakes meaningful?");
      suggestions.push("Auto-succeed if trivial; auto-fail if impossible (but fail forward)");
    }
  } else {
    suggestions.push("Auto-succeed: Within capabilities, no opposition, trivially easy");
    suggestions.push("Roll required: Uncertain outcome, meaningful stakes, opposition exists");
    suggestions.push("Auto-fail: Impossible, but still provide useful information");
  }

  return {
    guidance:
      "Every action resolution should preserve player agency and move the story forward. Failure should never dead-end the narrative.",
    principles: [
      "Player Agency: Their choice should drive resolution",
      "Fail Forward: Failure opens new paths, not dead ends",
      "Multiple Paths: Accept creative solutions",
      "Method Matters: How they do it can bypass or modify checks",
    ],
    suggestions: [
      ...suggestions,
      "On failure: Something still happens, new info emerges, situation changes",
      "Partial success (close roll): Success with complication or partial information",
    ],
    tools: ["roll_test", "roll_dice"],
  };
}

/**
 * Generate "pacing" guidance
 */
export function generatePacingGuidance(
  session: SessionState,
  sceneDescription?: string
): GuidanceResult {
  const suggestions: string[] = [];

  // Scene-specific advice
  if (sceneDescription) {
    const sceneLower = sceneDescription.toLowerCase();

    if (sceneLower.includes("combat") || sceneLower.includes("fight")) {
      suggestions.push("Combat should feel dangerous. Describe wounds, not just HP loss");
      suggestions.push("Let players describe killing blows on significant enemies");
    } else if (sceneLower.includes("investigation") || sceneLower.includes("search")) {
      suggestions.push("Cycle clues: obvious -> available -> hidden progression");
      suggestions.push("Time pressure adds urgency; consider a deadline");
    } else if (sceneLower.includes("conversation") || sceneLower.includes("negotiation")) {
      suggestions.push("NPCs have agendas. Let them push back and make demands");
      suggestions.push("If conversation is circling, have NPC make a choice or leave");
    }
  }

  // Clock-based urgency
  if (session.activeClocks && session.activeClocks.length > 0) {
    suggestions.push(`Active clock: ${session.activeClocks[0].name} - use for tension`);
  }

  // General pacing advice
  suggestions.push("Cut to the next meaningful choice - skip travel/waiting if uneventful");
  suggestions.push("If scene drags: escalate, interrupt, or end it");

  return {
    guidance:
      "Pacing is controlled by how you frame the next meaningful decision point. Cut empty time; don't skip meaningful choices.",
    principles: [
      "Intention -> Obstacle -> Choice: The core scene frame",
      "Cut Empty Time: Skip over gaps with no decisions",
      "Protect Meaning: Don't skip over decisions that matter to players",
      "Vary Rhythm: Alternate tension/relief, action/reflection",
    ],
    suggestions,
    tools: ["advance_time", "get_active_clocks", "check_clock_triggers"],
  };
}

/**
 * Generate "tone" guidance
 */
export function generateToneGuidance(session: SessionState): GuidanceResult {
  const worldSeed = session.generation?.worldSeed as
    | {
        aesthetic?: { tone?: string; themes?: string[] };
      }
    | null
    | undefined;

  const tone = worldSeed?.aesthetic?.tone || "unknown";
  const themes = worldSeed?.aesthetic?.themes || [];

  const toneAdvice: Record<string, { description: string; dos: string[]; donts: string[] }> = {
    dark: {
      description: "Oppressive, morally gray, victories are costly",
      dos: [
        "Emphasize consequence and cost",
        "NPCs have complex motivations",
        "Hope is rare and precious",
      ],
      donts: ["Easy wins", "Clear good/evil", "Jokes that undercut drama"],
    },
    gritty: {
      description: "Realistic, dangerous, resources matter",
      dos: ["Track resources carefully", "Wounds have impact", "Show wear and exhaustion"],
      donts: ["Superhero moments", "Brushing off injuries", "Infinite stamina"],
    },
    heroic: {
      description: "Larger than life, triumph possible, epic stakes",
      dos: ["Celebrate successes", "Let heroes be competent", "Epic moments of bravery"],
      donts: ["Petty humiliations", "Constant failure", "Making heroes look foolish"],
    },
    comedic: {
      description: "Fun, absurd, playful stakes",
      dos: ["Play with timing", "Embrace absurdity", "Let failures be funny"],
      donts: ["Taking things too seriously", "Harsh consequences", "Mean-spirited humor"],
    },
    mystery: {
      description: "Shadowy, puzzles matter, revelations are earned",
      dos: ["Breadcrumb information", "Multiple suspects", "Reward investigation"],
      donts: ["Revealing too much", "Making clues too obscure", "Ignoring null results"],
    },
    horror: {
      description: "Creeping dread, wrongness, uncertainty",
      dos: ["Build slowly", "Describe what's wrong", "Let fear linger"],
      donts: ["Showing the monster too early", "Over-explaining", "Breaking tension with action"],
    },
  };

  const advice = toneAdvice[tone.toLowerCase()] || {
    description: `Tone: ${tone}`,
    dos: ["Maintain consistency", "Match player expectations"],
    donts: ["Jarring tonal shifts"],
  };

  return {
    guidance: `Current tone: ${tone}. ${advice.description}. Maintain this throughout scenes.`,
    principles: [
      `Tone consistency: Keep ${tone} feel across all scenes`,
      "Player comfort: Adjust if requested, smoothly and without judgment",
      "Themes reinforce tone: Weave themes into narration",
    ],
    suggestions: [...advice.dos.map((d) => `DO: ${d}`), ...advice.donts.map((d) => `DON'T: ${d}`)],
    tools: [],
    worldContext: themes.length > 0 ? `Active themes: ${themes.join(", ")}` : undefined,
  };
}

/**
 * Generate "npc" guidance
 */
export function generateNpcGuidance(session: SessionState, npcId?: string): GuidanceResult {
  if (!npcId) {
    return {
      guidance: "Provide an NPC ID to get specific portrayal guidance.",
      principles: [
        "Every NPC has ONE defining trait",
        "Every NPC has a WANT (even simple ones)",
        "NPCs have opinions and reactions - they're not quest dispensers",
      ],
      suggestions: [
        "Give them a distinct voice or mannerism",
        "Let them remember past encounters",
        "Let relationships evolve based on treatment",
      ],
      tools: ["get_relationship", "get_npc_disposition"],
    };
  }

  const npc = session.npcs[npcId];
  const relationship = session.relationships?.[npcId];

  if (!npc) {
    return {
      guidance: `NPC ${npcId} not found in session.`,
      principles: [],
      suggestions: ["Create the NPC first with create_character"],
      tools: ["create_character"],
    };
  }

  const suggestions: string[] = [];

  // Personality-based suggestions
  if (npc.personality) {
    suggestions.push(`Core trait: ${npc.personality}`);
  }

  if (npc.motivation) {
    suggestions.push(`Motivation: ${npc.motivation}`);
  }

  // Relationship-based suggestions
  if (relationship) {
    suggestions.push(`Current attitude: ${relationship.attitude}`);

    if (relationship.history.length > 0) {
      const lastInteraction = relationship.history[relationship.history.length - 1];
      suggestions.push(`Last interaction: ${lastInteraction.interaction}`);
    }

    // Attitude-specific behavior hints
    switch (relationship.attitude) {
      case "hostile":
        suggestions.push("Behavior: Confrontational, may refuse to help, could escalate");
        break;
      case "unfriendly":
        suggestions.push("Behavior: Suspicious, minimal help, may withhold info");
        break;
      case "neutral":
        suggestions.push("Behavior: Transactional, fair deals, no special treatment");
        break;
      case "friendly":
        suggestions.push("Behavior: Warm, offers help, shares relevant info freely");
        break;
      case "allied":
        suggestions.push("Behavior: Loyal, goes out of way to help, may take risks for party");
        break;
    }
  }

  return {
    guidance: `Portraying ${npc.name}: Stay consistent with established personality and relationship.`,
    principles: [
      "Remember past interactions - NPCs have memory",
      "Attitude affects helpfulness, not just dialogue tone",
      "NPCs can change their minds based on events",
    ],
    suggestions,
    tools: ["get_relationship", "update_relationship"],
    worldContext: relationship
      ? `${relationship.history.length} previous interactions recorded`
      : "No relationship tracked yet - consider initializing",
  };
}
