/**
 * Add NPC Tool
 *
 * Registers a fabricated NPC on the session so the rest of the runtime
 * (portraits, dialogue lookups, relationship tracking) has a stable id
 * to bind to. Session-scoped only — does not mutate the world pack.
 *
 * The agent should call this BEFORE introducing any NPC that doesn't
 * already exist in the world pack, then reuse the returned `npcId` in
 * `generate_portrait` and `showDialogue`.
 */

import { z } from "zod";
import { defineSharedTool, type NPC, type NarrativeRole } from "@mythxengine/types";
import { slugify } from "../generation/manifest-helpers.js";

export const AddNpcInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  name: z.string().min(1).describe("NPC display name"),
  description: z.string().describe("Short physical + role description (1-2 sentences)"),
  attitude: z
    .enum(["friendly", "neutral", "hostile", "unknown"])
    .optional()
    .default("neutral")
    .describe("Initial disposition toward the player"),
  narrativeRole: z
    .enum([
      "quest_giver",
      "ally",
      "obstacle",
      "information",
      "antagonist",
      "merchant",
      "background",
    ])
    .optional()
    .default("background")
    .describe("Story role this NPC plays"),
  personality: z
    .string()
    .optional()
    .describe("One-line personality summary (e.g. 'gruff but fair')"),
  motivation: z.string().optional().describe("What this NPC wants or fears (free-form, optional)"),
});

export type AddNpcInput = z.infer<typeof AddNpcInputSchema>;

export interface AddNpcOutput {
  npcId: string;
  name: string;
  added: boolean;
  message: string;
}

export const addNpcTool = defineSharedTool({
  name: "add_npc",
  description:
    "Register a fabricated NPC on the session. Returns a stable `npcId` to use in `generate_portrait` and `showDialogue`. Use BEFORE introducing any NPC that isn't already in the world pack — without this the NPC has no identity and their portrait can't be tracked across turns.",
  inputSchema: AddNpcInputSchema,

  handler: async (input, ctx): Promise<AddNpcOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const npcs = (session.npcs ??= {});

    // Reuse existing entry if the agent re-registers the same name.
    // Match by exact name (case-insensitive) — slug collision is the
    // tiebreaker below, but matching by name first keeps the agent's
    // mental model simple ("call add_npc with the name and you'll
    // always get the same id back").
    const targetNameLower = input.name.trim().toLowerCase();
    const existing = Object.values(npcs).find(
      (npc) => npc.name.trim().toLowerCase() === targetNameLower
    );
    if (existing) {
      return {
        npcId: existing.id,
        name: existing.name,
        added: false,
        message: `NPC '${existing.name}' already exists in this session.`,
      };
    }

    // Resolve `baseSlug` BEFORE the collision loop so the suffix
    // branch (`baseSlug-2`, `-3`, ...) doesn't degrade to `-2` when
    // `slugify` returns an empty string (emoji-only names, etc.).
    const baseSlug = slugify(input.name) || `npc-${Object.keys(npcs).length + 1}`;
    let npcId = baseSlug;
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(npcs, npcId)) {
      npcId = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const npc: NPC = {
      id: npcId,
      name: input.name,
      description: input.description,
      personality: input.personality ?? "",
      motivation: input.motivation ?? "",
      attitude: input.attitude,
      dialogueHints: [],
      narrativeRole: input.narrativeRole as NarrativeRole,
      runtime: true,
    };

    npcs[npcId] = npc;
    await ctx.sessions.save(session);

    return {
      npcId,
      name: input.name,
      added: true,
      message: `Registered ${input.name} (${npcId}). Pass this npcId to generate_portrait and showDialogue.`,
    };
  },
});
