/**
 * Add Deadline Tool (Shared)
 *
 * Add a deadline/countdown to track.
 */

import { z } from "zod";
import {
  defineSharedTool,
  createInitialGameTime,
  advanceGameTime,
  type GameTime,
  type Deadline,
} from "@mythxengine/types";
import { minutesUntil, formatDuration } from "@mythxengine/engine";

/**
 * Input schema for add_deadline
 */
/**
 * Preprocess expiresAt: LLMs sometimes pass JSON strings instead of objects.
 */
const coerceGameTime = z.preprocess(
  (val) => (typeof val === "string" ? JSON.parse(val) : val),
  z.object({
    day: z.coerce.number().min(1),
    hour: z.coerce.number().min(0).max(23),
    minute: z.coerce.number().min(0).max(59),
  })
);

/**
 * Preprocess boolean: LLMs sometimes pass "true"/"false" strings.
 */
const coerceBoolean = z.preprocess(
  (val) => (val === "true" ? true : val === "false" ? false : val),
  z.boolean()
);

export const AddDeadlineInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  id: z.string().describe("Unique deadline ID"),
  name: z.string().describe("Deadline name (e.g., 'Midnight')"),
  description: z.string().describe("What happens when deadline expires"),
  expiresIn: z.coerce.number().min(1).optional().describe("Minutes from now until expiration"),
  expiresAt: coerceGameTime.optional().describe("Specific game time when deadline expires"),
  onExpireFlag: z.string().optional().describe("Flag to set when deadline expires"),
  warnOnApproach: coerceBoolean.default(true).describe("Warn when within 1 hour (default: true)"),
});

export type AddDeadlineInput = z.infer<typeof AddDeadlineInputSchema>;

/**
 * Output type for add_deadline
 */
export interface AddDeadlineOutput {
  message: string;
  deadline: {
    id: string;
    name: string;
    description: string;
    expiresAt: string;
    minutesRemaining: number;
    timeRemaining: string;
  };
}

/**
 * Format game time as human-readable string
 */
function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}

/**
 * Add deadline tool definition
 */
export const addDeadlineTool = defineSharedTool({
  name: "add_deadline",
  description:
    "Add a deadline/countdown to track. Specify either expiresIn (minutes from now) or expiresAt (specific time).",
  inputSchema: AddDeadlineInputSchema,

  handler: async (input, ctx): Promise<AddDeadlineOutput> => {
    if (!input.expiresIn && !input.expiresAt) {
      throw new Error("Must specify either expiresIn or expiresAt");
    }

    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Handle sessions created before gameTime/deadlines was added
    if (!session.gameTime) {
      session.gameTime = createInitialGameTime();
    }
    if (!session.deadlines) {
      session.deadlines = [];
    }

    // Check for duplicate ID
    if (session.deadlines.some((d) => d.id === input.id)) {
      throw new Error(`Deadline with ID '${input.id}' already exists`);
    }

    // Calculate expiration time
    let expiresAt: GameTime;
    if (input.expiresAt) {
      expiresAt = input.expiresAt;
    } else {
      expiresAt = advanceGameTime(session.gameTime, input.expiresIn!);
    }

    const deadline: Deadline = {
      id: input.id,
      name: input.name,
      description: input.description,
      expiresAt,
      onExpireFlag: input.onExpireFlag,
      warnOnApproach: input.warnOnApproach ?? true,
    };

    session.deadlines.push(deadline);
    await ctx.sessions.save(session);

    const remaining = minutesUntil(session.gameTime, expiresAt);

    return {
      message: `Deadline '${input.name}' added`,
      deadline: {
        id: deadline.id,
        name: deadline.name,
        description: deadline.description,
        expiresAt: formatGameTime(expiresAt),
        minutesRemaining: remaining,
        timeRemaining: formatDuration(remaining),
      },
    };
  },
});
