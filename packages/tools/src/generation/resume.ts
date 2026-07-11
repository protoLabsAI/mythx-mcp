/**
 * Resume Generation Tool (Shared)
 *
 * Resumes an interrupted world generation session by analyzing session state.
 */

import { z } from "zod";
import { defineSharedTool, createEmptyGenerationSession } from "@mythxengine/types";

export const ResumeGenerationInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  reconstruct: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, reset incomplete steps to allow retry"),
});

export type ResumeGenerationInput = z.infer<typeof ResumeGenerationInputSchema>;

interface StepStatus {
  type: string;
  status: "completed" | "in_progress" | "failed" | "pending";
  error?: string;
  generatedIds?: string[];
}

export interface ResumeGenerationOutput {
  sessionId: string;
  status: string;
  steps: StepStatus[];
  completedSteps: string[];
  incompleteSteps: string[];
  failedSteps: string[];
  reconstructed: boolean;
  message: string;
}

export const resumeGenerationTool = defineSharedTool({
  name: "resume_generation",
  description:
    "Resume an interrupted world generation session. Analyzes session state to report progress and optionally reset incomplete steps.",
  inputSchema: ResumeGenerationInputSchema,

  handler: async (input, ctx): Promise<ResumeGenerationOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Initialize generation if not present
    if (!session.generation) {
      session.generation = createEmptyGenerationSession();
      await ctx.sessions.save(session);

      return {
        sessionId: input.sessionId,
        status: "idle",
        steps: [],
        completedSteps: [],
        incompleteSteps: [],
        failedSteps: [],
        reconstructed: false,
        message:
          "No generation session found. Start a new world generation with generate_world_seed.",
      };
    }

    // Analyze current state
    const steps: StepStatus[] = [];
    const completedSteps: string[] = [];
    const incompleteSteps: string[] = [];
    const failedSteps: string[] = [];

    for (const historyStep of session.generation.history) {
      const stepStatus: StepStatus = {
        type: historyStep.type,
        status: historyStep.status,
        error: historyStep.error,
        generatedIds: historyStep.generatedIds,
      };

      steps.push(stepStatus);

      if (historyStep.status === "completed") {
        completedSteps.push(historyStep.type);
      } else if (historyStep.status === "in_progress") {
        incompleteSteps.push(historyStep.type);
      } else if (historyStep.status === "failed") {
        failedSteps.push(historyStep.type);
      }
    }

    // Optionally reset incomplete/failed steps for retry
    let reconstructed = false;
    if (input.reconstruct && (incompleteSteps.length > 0 || failedSteps.length > 0)) {
      // Remove incomplete/failed steps from history so they can be retried
      session.generation.history = session.generation.history.filter(
        (s) => s.status === "completed"
      );

      // Reset status if needed
      if (session.generation.history.length === 0) {
        session.generation.status = "idle";
      } else if (session.generation.worldSeed && session.generation.status === "seeding") {
        session.generation.status = "generating";
      }

      await ctx.sessions.save(session);
      reconstructed = true;
    }

    // Build result message
    let message = "";
    if (completedSteps.length === 0 && session.generation.status === "idle") {
      message = "Generation not started. Call generate_world_seed to begin.";
    } else if (incompleteSteps.length > 0) {
      message = `Generation interrupted. ${completedSteps.length} steps completed, ${incompleteSteps.length} in progress: ${incompleteSteps.join(", ")}. Re-run the interrupted generation tool.`;
    } else if (failedSteps.length > 0) {
      message = `Generation has ${failedSteps.length} failed steps: ${failedSteps.join(", ")}. Re-run the failed generation tool.`;
    } else if (completedSteps.length > 0) {
      message = `Generation complete with ${completedSteps.length} steps. Ready for assemble_world_pack.`;
    } else {
      message = "Generation session initialized but no steps recorded.";
    }

    if (reconstructed) {
      message += " Incomplete/failed steps have been reset for retry.";
    }

    return {
      sessionId: input.sessionId,
      status: session.generation.status,
      steps,
      completedSteps,
      incompleteSteps,
      failedSteps,
      reconstructed,
      message,
    };
  },
});
