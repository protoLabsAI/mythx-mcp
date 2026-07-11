/**
 * Deterministic Research Tool
 *
 * A shared tool that performs deterministic world pack lookups.
 * Provides fast (~5ms) entity lookups without LLM calls.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import type { WorldContentPack } from "@mythxengine/worlds";
import { resolveEntityLookup, searchEntities, type LookupEntityType } from "./entity-resolver.js";
import { formatEntityAsMarkdown } from "./formatter.js";

/**
 * Input schema for quick_research tool
 */
export const QuickResearchInputSchema = z.object({
  worldPackId: z.string().describe("World pack ID to search"),
  query: z.string().describe("Search query - can be entity name, ID, or natural language"),
  entityType: z
    .enum([
      "monster",
      "npc",
      "location",
      "situation",
      "archetype",
      "item",
      "encounter",
      "condition",
      "faction",
      "arc",
    ])
    .optional()
    .describe("Entity type hint (optional, will auto-detect if not provided)"),
  includeSecrets: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include GM-only information (default: true)"),
  resolveReferences: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to resolve cross-references (default: true)"),
});

export type QuickResearchInput = z.infer<typeof QuickResearchInputSchema>;

/**
 * Output type for quick_research tool
 */
export interface QuickResearchOutput {
  found: boolean;
  entityType?: LookupEntityType;
  entityId?: string;
  entityName?: string;
  markdown: string;
  alternativeMatches?: Array<{ type: LookupEntityType; id: string; name: string }>;
  error?: string;
}

/**
 * Quick Research Tool
 *
 * Performs deterministic world pack lookups without LLM calls.
 * Use this instead of delegating to GM Researcher for simple lookups.
 *
 * Features:
 * - Auto-detects entity type from query
 * - Fuzzy name matching
 * - Cross-reference resolution
 * - GM vs player access levels
 * - Formatted markdown output
 */
export const quickResearchTool = defineSharedTool({
  name: "quick_research",
  description:
    "Fast deterministic world pack lookup. Use for finding monsters, NPCs, locations, items, etc. " +
    "Automatically detects entity type and does fuzzy name matching. " +
    "Pure function lookup (~5ms) with no LLM overhead.",
  inputSchema: QuickResearchInputSchema,

  handler: async (input, ctx): Promise<QuickResearchOutput> => {
    const { worldPackId, query, entityType: typeHint, includeSecrets, resolveReferences } = input;

    // Load world pack
    const pack = (await ctx.worldPacks.get(worldPackId)) as WorldContentPack | null;
    if (!pack) {
      return {
        found: false,
        markdown: `World pack not found: ${worldPackId}`,
        error: `World pack not found: ${worldPackId}`,
      };
    }

    // Detect or use provided entity type
    const entityType: LookupEntityType | undefined = typeHint;

    // Search for matches
    const searchResults = searchEntities(pack, query, entityType ? [entityType] : undefined, 10);

    if (searchResults.length === 0) {
      return {
        found: false,
        markdown: entityType
          ? `No ${entityType} found matching "${query}"`
          : `No entities found matching "${query}"`,
        error: "No matches found",
      };
    }

    // Use the best match
    const best = searchResults[0];
    const lookupResult = resolveEntityLookup(pack, {
      type: best.type,
      id: best.id,
      includeSecrets: includeSecrets ?? true,
      resolveReferences: resolveReferences ?? true,
    });

    if (!lookupResult.found) {
      return {
        found: false,
        markdown: `Entity lookup failed for ${best.type}/${best.id}`,
        error: lookupResult.error,
      };
    }

    // Format output
    const markdown = formatEntityAsMarkdown(lookupResult, {
      template: "full",
      accessLevel: includeSecrets ? "gm" : "player",
      includeReferences: resolveReferences,
    });

    // Build alternative matches list (excluding the best match)
    const alternativeMatches =
      searchResults.length > 1
        ? searchResults.slice(1, 5).map((r) => ({
            type: r.type,
            id: r.id,
            name: r.name,
          }))
        : undefined;

    return {
      found: true,
      entityType: best.type,
      entityId: best.id,
      entityName: best.name,
      markdown,
      alternativeMatches,
    };
  },
});

/**
 * Multi-entity lookup tool for batch operations
 */
export const BatchLookupInputSchema = z.object({
  worldPackId: z.string().describe("World pack ID"),
  lookups: z
    .array(
      z.object({
        type: z.enum([
          "monster",
          "npc",
          "location",
          "situation",
          "archetype",
          "item",
          "encounter",
          "condition",
          "faction",
          "arc",
        ]),
        id: z.string(),
      })
    )
    .describe("List of entities to look up"),
  includeSecrets: z.boolean().optional().default(true),
});

export type BatchLookupInput = z.infer<typeof BatchLookupInputSchema>;

export interface BatchLookupOutput {
  results: Array<{
    type: LookupEntityType;
    id: string;
    found: boolean;
    name?: string;
    summary?: string;
  }>;
  totalFound: number;
  totalMissing: number;
}

export const batchLookupTool = defineSharedTool({
  name: "batch_lookup",
  description:
    "Look up multiple entities at once. More efficient than individual lookups. " +
    "Returns summaries for each entity.",
  inputSchema: BatchLookupInputSchema,

  handler: async (input, ctx): Promise<BatchLookupOutput> => {
    const { worldPackId, lookups, includeSecrets } = input;

    const pack = (await ctx.worldPacks.get(worldPackId)) as WorldContentPack | null;
    if (!pack) {
      return {
        results: lookups.map((l) => ({
          type: l.type,
          id: l.id,
          found: false,
        })),
        totalFound: 0,
        totalMissing: lookups.length,
      };
    }

    const results = lookups.map((lookup) => {
      const result = resolveEntityLookup(pack, {
        type: lookup.type,
        id: lookup.id,
        includeSecrets: includeSecrets ?? true,
        resolveReferences: false,
      });

      if (!result.found) {
        return {
          type: lookup.type,
          id: lookup.id,
          found: false,
        };
      }

      const entity = result.entity as Record<string, unknown>;
      return {
        type: lookup.type,
        id: lookup.id,
        found: true,
        name: entity.name as string,
        summary: formatEntityAsMarkdown(result, {
          template: "reference",
          accessLevel: includeSecrets ? "gm" : "player",
        }),
      };
    });

    const found = results.filter((r) => r.found).length;
    return {
      results,
      totalFound: found,
      totalMissing: results.length - found,
    };
  },
});

/**
 * Export research tools array
 */
import { lookupRuleTool } from "./rule-lookup.js";
export const researchTools = [quickResearchTool, batchLookupTool, lookupRuleTool];
