/**
 * Load Skill Tool (Shared)
 *
 * The agent calls this when it needs domain-specific guidance that
 * isn't pre-loaded in the system prompt. Skill bodies stay out of
 * the always-loaded pinned slab; the agent reads the skills index
 * (name + one-line description, advertised in the system prompt)
 * and pulls a skill body on demand.
 *
 * Returns the skill markdown verbatim so the model can read it as
 * additional instructions for the current turn.
 */

import { z } from "zod";
import { defineSharedTool, type GateResult, type ToolContext } from "@mythxengine/types";
// Import from the "./skills" subpath (not the package root) so the public
// mcp-server dependency tree never touches langfuse-executor / generated /
// raw — see docs/public-repo-extraction-plan.md §1.2.
import { getSkill, listSkills } from "@mythxengine/prompts/skills";

/**
 * Returns a gate that refuses unless `skillName` is in
 * `ctx.loadedSkills`. Apply this to any tool whose correct usage is
 * documented in a skill body — the gate makes the load_skill call
 * load-bearing instead of optional.
 *
 * Refusal reason includes the exact `load_skill({ name })` call the
 * agent needs to make, so the model can self-correct in the next
 * step of the same chat turn (load_skill's postTool hook updates
 * `ctx.loadedSkills` in place so the retry succeeds).
 *
 * In contexts without `ctx.loadedSkills` (MCP, scripts, tests) the
 * gate passes through — those callers don't have a session-scoped
 * skill-loading concept and would be blocked forever.
 */
export function requireSkill(skillName: string) {
  // Fail fast at gate creation if the skill name is misconfigured —
  // otherwise the agent enters an impossible denial loop (load_skill
  // would throw, the gate never satisfies, the turn dead-ends).
  // `getSkill` throws with a "Skill not found: ... Available: ..."
  // message that's actionable in dev. CodeRabbit on #531.
  getSkill(skillName);

  return (_input: unknown, ctx: ToolContext): GateResult => {
    if (!ctx.loadedSkills) return { allow: true };
    if (ctx.loadedSkills.has(skillName)) return { allow: true };
    return {
      allow: false,
      reason: `Load the \`${skillName}\` skill first. Call \`load_skill({ name: "${skillName}" })\` — it documents the exact tool sequence and rules for this flow, then retry this call.`,
    };
  };
}

// Pull the available-skill list at module load so the schema's
// description includes the canonical names. The list is stable
// per-process (skills are read off disk once and cached); if a new
// skill is added the server restart picks it up.
function describeAvailableSkills(): string {
  try {
    return listSkills()
      .map((s) => `- \`${s.name}\` — ${s.description}`)
      .join("\n");
  } catch {
    // Loader threw — fall back to a generic description so the tool
    // still registers. The handler will surface the real error.
    return "(skill list unavailable at registration time)";
  }
}

export const LoadSkillInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Skill name is required")
    // Skills live at packages/prompts/src/skills/<name>.md; the loader
    // enforces basename === frontmatter.name. Constraining the schema
    // to kebab-case rejects bad calls (whitespace, ../traversal,
    // mixed-case filenames) before the loader even runs.
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      "Skill name must be kebab-case (lowercase letters, digits, hyphens)"
    )
    .describe(
      "The skill name to load (the identifier from the skills index). Returns the full skill body as markdown for you to apply on this turn."
    ),
});

export type LoadSkillInput = z.infer<typeof LoadSkillInputSchema>;

export interface LoadSkillResult {
  status: "ok";
  name: string;
  body: string;
}

export const loadSkillTool = defineSharedTool({
  name: "load_skill",
  description: `Load on-demand skill guidance into your context. Use when the current situation matches a skill's purpose (e.g. about to generate images, entering combat). The skill body is markdown — read it and apply it on this turn. Skill names come from the "Available skills" section of your system prompt.\n\nAvailable skills:\n${describeAvailableSkills()}`,
  inputSchema: LoadSkillInputSchema,
  emits: [],
  handler: async (input): Promise<LoadSkillResult> => {
    const skill = getSkill(input.name);
    return {
      status: "ok",
      name: skill.name,
      body: skill.body,
    };
  },
  // Mark the skill loaded on the live context so gates checking
  // `ctx.loadedSkills.has(name)` succeed for the rest of this chat
  // turn — including the very next tool call. Without this, the
  // model would have to load the skill in turn N and only get past
  // the gate in turn N+1, which fights cc-2.18's same-turn
  // self-correction loop. Return the result unchanged — this hook
  // is side-effect-only.
  postTool: (input, result, ctx) => {
    if (ctx.loadedSkills) ctx.loadedSkills.add(input.name);
    return result;
  },
});
