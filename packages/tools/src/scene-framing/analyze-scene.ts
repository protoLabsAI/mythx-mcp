/**
 * Analyze Scene Tool (Shared)
 *
 * Evaluate current scene for pacing issues. Helps identify when to cut or change direction.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

/**
 * Input schema for analyze_scene
 */
export const AnalyzeSceneInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  currentActivity: z.string().describe("What's happening now"),
  playerEnergy: z.enum(["high", "medium", "low"]).describe("GM's read on player engagement"),
  minutesInScene: z.number().min(0).describe("Real-time minutes in scene"),
});

export type AnalyzeSceneInput = z.infer<typeof AnalyzeSceneInputSchema>;

/**
 * Output type for analyze_scene
 */
export interface AnalyzeSceneOutput {
  sceneType: string;
  pacing: "good" | "dragging" | "rushed";
  analysis: {
    minutesInScene: number;
    playerEnergy: string;
    thresholdNormal: number;
    thresholdLong: number;
  };
  suggestions: string[];
  recommendation: string;
}

/**
 * Analyze scene tool definition
 */
export const analyzeSceneTool = defineSharedTool({
  name: "analyze_scene",
  description:
    "Evaluate current scene for pacing issues. Helps identify when to cut or change direction. Based on the Alexandrian principle: 'Cut to the next meaningful choice.'",
  inputSchema: AnalyzeSceneInputSchema,

  handler: async (input, ctx): Promise<AnalyzeSceneOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const activityLower = input.currentActivity.toLowerCase();

    // Detect scene type
    const isCombat =
      activityLower.includes("combat") ||
      activityLower.includes("fight") ||
      session.combat !== null;
    const isInvestigation =
      activityLower.includes("search") ||
      activityLower.includes("investigate") ||
      activityLower.includes("look");
    const isConversation =
      activityLower.includes("talk") ||
      activityLower.includes("conversation") ||
      activityLower.includes("negotiate");
    const isTravel =
      activityLower.includes("travel") ||
      activityLower.includes("journey") ||
      activityLower.includes("walk");

    // Pacing thresholds (in real-time minutes)
    const thresholds = {
      combat: { normal: 20, long: 35 },
      investigation: { normal: 15, long: 25 },
      conversation: { normal: 10, long: 20 },
      travel: { normal: 5, long: 10 },
      default: { normal: 15, long: 25 },
    };

    let sceneType = "default";
    if (isCombat) sceneType = "combat";
    else if (isInvestigation) sceneType = "investigation";
    else if (isConversation) sceneType = "conversation";
    else if (isTravel) sceneType = "travel";

    const threshold = thresholds[sceneType as keyof typeof thresholds];

    // Calculate pacing status
    let pacing: "good" | "dragging" | "rushed";
    if (input.minutesInScene < 3) {
      pacing = "rushed";
    } else if (
      input.minutesInScene > threshold.long ||
      (input.minutesInScene > threshold.normal && input.playerEnergy === "low")
    ) {
      pacing = "dragging";
    } else {
      pacing = "good";
    }

    // Generate suggestions based on analysis
    const suggestions: string[] = [];

    if (pacing === "dragging") {
      if (isConversation) {
        suggestions.push("Have the NPC make a decision, reveal something, or end the conversation");
        suggestions.push("Interrupt with an external event (noise, arrival, urgent message)");
      } else if (isInvestigation) {
        suggestions.push("Provide a definitive clue or confirm there's nothing more here");
        suggestions.push("Introduce a complication (someone notices them, time pressure)");
      } else if (isTravel) {
        suggestions.push("Skip ahead: 'After an uneventful journey, you arrive...'");
        suggestions.push("Interrupt with an encounter only if it advances the story");
      } else if (isCombat) {
        suggestions.push("Have enemies retreat, surrender, or the environment change");
        suggestions.push("Describe a decisive moment that could end things");
      } else {
        suggestions.push("Identify the next meaningful choice and cut to it");
        suggestions.push("Ask 'What are you trying to accomplish?' to refocus");
      }
    } else if (pacing === "rushed") {
      suggestions.push("Let the moment breathe - not everything needs immediate resolution");
      suggestions.push("Add sensory details to ground the scene");
    }

    // Check for clock pressure
    const clockPressure = (session.activeClocks || []).length > 0;
    if (clockPressure && pacing !== "rushed") {
      suggestions.push("Reminder: Active clocks running - consider time pressure");
    }

    // Low energy specific suggestions
    if (input.playerEnergy === "low" && pacing !== "rushed") {
      suggestions.push("Players seem disengaged - consider a dramatic reveal or action beat");
      suggestions.push("Ask players what they want to focus on next");
    }

    return {
      sceneType,
      pacing,
      analysis: {
        minutesInScene: input.minutesInScene,
        playerEnergy: input.playerEnergy,
        thresholdNormal: threshold.normal,
        thresholdLong: threshold.long,
      },
      suggestions,
      recommendation:
        pacing === "dragging"
          ? "Consider cutting to the next meaningful choice"
          : pacing === "rushed"
            ? "Let the scene develop before moving on"
            : "Pacing is good - continue as needed",
    };
  },
});
