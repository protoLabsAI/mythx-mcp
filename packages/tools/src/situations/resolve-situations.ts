/**
 * Situation Resolution
 *
 * Single read path for "what situations does this session have?".
 *
 * Sessions built by the world-generation workflow carry situations in
 * `session.generation.generatedContent.situations`. Sessions created on a
 * compiled/bundled world pack never populate generated content — the pack
 * itself is the source of truth, storing situations as a Record keyed by
 * id. Every runtime tool that reads situations (leads, clocks, portable
 * clues, GM guidance, engagement) must resolve through here so bundled
 * packs are playable.
 */

import type { ToolContext } from "@mythxengine/types";

/** The slice of session state the resolver needs. */
export interface SituationSourceSession {
  worldPackId?: string | null;
  generation?: {
    generatedContent?: {
      situations?: unknown[];
    };
  } | null;
}

/**
 * Resolve the session's situations: generated content when present,
 * otherwise the session's world pack. Returns raw (unvalidated) values —
 * callers narrow to their domain shape.
 */
export async function resolveRawSituations(
  ctx: Pick<ToolContext, "worldPacks">,
  session: SituationSourceSession
): Promise<unknown[]> {
  const generated = session.generation?.generatedContent?.situations;
  if (Array.isArray(generated) && generated.length > 0) {
    return generated;
  }

  if (!session.worldPackId) {
    return [];
  }

  const pack = (await ctx.worldPacks.get(session.worldPackId)) as {
    situations?: Record<string, unknown>;
  } | null;

  return pack?.situations ? Object.values(pack.situations) : [];
}
