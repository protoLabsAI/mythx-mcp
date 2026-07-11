/**
 * Set Play Mode Tool (Shared)
 *
 * Persists auto/interactive play mode to the session state.
 * This survives context compaction — the agent reads it back
 * from session state to know whether to prompt the player or
 * play autonomously.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

export const SetPlayModeInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  mode: z
    .enum(["interactive", "auto"])
    .describe(
      "Play mode: 'interactive' prompts the player for actions, 'auto' plays all characters autonomously"
    ),
});

export type SetPlayModeInput = z.infer<typeof SetPlayModeInputSchema>;

export interface SetPlayModeOutput {
  previousMode: string;
  currentMode: string;
  message: string;
}

export const setPlayModeTool = defineSharedTool({
  name: "set_play_mode",
  description:
    "Set the play mode for a session. 'interactive' prompts the player for decisions, 'auto' plays all characters autonomously. Persists across context compaction.",
  inputSchema: SetPlayModeInputSchema,

  handler: async (input, ctx): Promise<SetPlayModeOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const previousMode = session.playMode || "interactive";
    session.playMode = input.mode;
    await ctx.sessions.save(session);

    return {
      previousMode,
      currentMode: input.mode,
      message:
        input.mode === "auto"
          ? "Auto-mode enabled. All characters will be played autonomously. The user can interrupt at any time by typing an action."
          : "Interactive mode enabled. The player will be prompted for actions.",
    };
  },
});
