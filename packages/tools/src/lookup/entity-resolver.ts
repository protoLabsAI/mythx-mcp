/**
 * Entity Resolver
 *
 * Pure functions for looking up entities in a WorldContentPack.
 * Replaces LLM-based GM Researcher with deterministic lookups.
 */

import type { WorldContentPack } from "@mythxengine/worlds";

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Maximum length for fuzzy search strings to prevent regex stress
 * Strings longer than this will skip fuzzy matching
 */
const MAX_FUZZY_LENGTH = 100;

/**
 * Entity types that can be looked up
 */
export type LookupEntityType =
  | "monster"
  | "npc"
  | "location"
  | "situation"
  | "archetype"
  | "item"
  | "encounter"
  | "condition"
  | "faction"
  | "arc";

/**
 * Query for entity lookup
 */
export interface LookupQuery {
  /** Entity type to look up */
  type: LookupEntityType;
  /** Entity ID */
  id: string;
  /** Whether to include GM-only information (secrets, gmNotes) */
  includeSecrets?: boolean;
  /** Whether to resolve references to other entities */
  resolveReferences?: boolean;
  /** Max depth for reference resolution (default: 1) */
  maxReferenceDepth?: number;
}

/**
 * Result of an entity lookup
 */
export interface LookupResult<T = unknown> {
  /** Whether the entity was found */
  found: boolean;
  /** The entity type */
  type: LookupEntityType;
  /** The entity ID */
  id: string;
  /** The entity data (null if not found) */
  entity: T | null;
  /** Resolved references (keyed by reference type) */
  references?: Record<string, LookupResult[]>;
  /** Error message if lookup failed */
  error?: string;
}

/**
 * Keywords that map to entity types for query detection
 */
const ENTITY_TYPE_KEYWORDS: Record<string, LookupEntityType[]> = {
  // Monster keywords
  monster: ["monster"],
  creature: ["monster"],
  enemy: ["monster"],
  beast: ["monster"],
  minion: ["monster"],
  boss: ["monster"],

  // NPC keywords
  npc: ["npc"],
  character: ["npc"],
  person: ["npc"],
  merchant: ["npc"],
  villager: ["npc"],

  // Location keywords
  location: ["location"],
  place: ["location"],
  area: ["location"],
  town: ["location"],
  city: ["location"],
  dungeon: ["location"],
  building: ["location"],

  // Situation keywords
  situation: ["situation"],
  quest: ["situation"],
  plot: ["situation"],
  hook: ["situation"],
  adventure: ["situation"],

  // Archetype keywords
  archetype: ["archetype"],
  class: ["archetype"],
  profession: ["archetype"],
  playable: ["archetype"],

  // Item keywords
  item: ["item"],
  weapon: ["item"],
  armor: ["item"],
  gear: ["item"],
  equipment: ["item"],
  loot: ["item"],

  // Encounter keywords
  encounter: ["encounter"],
  fight: ["encounter"],
  event: ["encounter"],
  scene: ["encounter"],

  // Other
  condition: ["condition"],
  status: ["condition"],
  effect: ["condition"],
  faction: ["faction"],
  guild: ["faction"],
  organization: ["faction"],
  arc: ["arc"],
  story: ["arc"],
  campaign: ["arc"],
};

/**
 * Detect entity type from a natural language query
 *
 * @param query - Natural language query string
 * @returns Detected entity type or null if ambiguous
 */
export function detectEntityType(query: string): LookupEntityType | null {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);

  // Check each word against keywords
  for (const word of words) {
    const types = ENTITY_TYPE_KEYWORDS[word];
    if (types && types.length === 1) {
      return types[0];
    }
  }

  // Check for partial matches
  for (const [keyword, types] of Object.entries(ENTITY_TYPE_KEYWORDS)) {
    if (lower.includes(keyword) && types.length === 1) {
      return types[0];
    }
  }

  return null;
}

/**
 * Extract potential entity ID from a query string
 *
 * Supports formats:
 * - Direct ID: "goblin-warrior"
 * - Quoted name: "Goblin Warrior"
 * - Query with ID: "monster goblin-warrior"
 *
 * @param query - Query string
 * @returns Extracted ID or null
 */
export function extractEntityId(query: string): string | null {
  // Check for quoted string (exact match attempt)
  const quotedMatch = query.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    return quotedMatch[1].toLowerCase().replace(/\s+/g, "-");
  }

  // Check for ID-like patterns (lowercase with hyphens)
  const idMatch = query.match(/\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/);
  if (idMatch) {
    return idMatch[1];
  }

  // Extract last meaningful word after type keyword
  const words = query.split(/\s+/).filter((w) => w.length > 2);
  const typeKeywords = new Set(Object.keys(ENTITY_TYPE_KEYWORDS));

  // Skip type keywords and find the actual name
  const nameWords = words.filter((w) => !typeKeywords.has(w.toLowerCase()));
  if (nameWords.length > 0) {
    return nameWords.join("-").toLowerCase();
  }

  return null;
}

/**
 * Get the entity collection from a world pack by type
 */
function getCollection(
  pack: WorldContentPack,
  type: LookupEntityType
): Record<string, unknown> | undefined {
  switch (type) {
    case "monster":
      return pack.monsters;
    case "npc":
      return pack.npcs;
    case "location":
      return pack.locations;
    case "situation":
      return pack.situations;
    case "archetype":
      return pack.archetypes;
    case "item":
      return pack.items;
    case "encounter":
      return pack.encounters;
    case "condition":
      return pack.conditions;
    case "faction":
      return pack.factions;
    case "arc":
      return pack.arcs;
    default:
      return undefined;
  }
}

/**
 * Resolve a single entity lookup
 *
 * @param pack - World content pack
 * @param query - Lookup query
 * @returns Lookup result
 */
export function resolveEntityLookup<T = unknown>(
  pack: WorldContentPack,
  query: LookupQuery
): LookupResult<T> {
  const { type, id, includeSecrets = true, resolveReferences = false } = query;

  const collection = getCollection(pack, type);
  if (!collection) {
    return {
      found: false,
      type,
      id,
      entity: null,
      error: `Unknown entity type: ${type}`,
    };
  }

  // Try exact ID match first
  let entity = collection[id] as T | undefined;

  // Try case-insensitive match
  if (!entity) {
    const lowerId = id.toLowerCase();
    for (const [key, value] of Object.entries(collection)) {
      if (key.toLowerCase() === lowerId) {
        entity = value as T;
        break;
      }
    }
  }

  // Try fuzzy name match (with stricter criteria to avoid false positives)
  if (!entity) {
    const searchName = id.replace(/-/g, " ").toLowerCase();

    // Only use fuzzy matching for search terms of 3+ characters and within max length
    // Skip fuzzy matching for extremely long strings to prevent regex stress
    if (searchName.length >= 3 && searchName.length <= MAX_FUZZY_LENGTH) {
      for (const value of Object.values(collection)) {
        const record = value as Record<string, unknown>;
        const name = (record.name as string)?.toLowerCase();
        if (!name) continue;

        // Exact match
        if (name === searchName) {
          entity = value as T;
          break;
        }

        // Word-boundary match: searchName must be a complete word in name
        // This prevents "rat" from matching "pirate"
        const wordBoundaryRegex = new RegExp(`\\b${escapeRegExp(searchName)}\\b`);
        if (wordBoundaryRegex.test(name)) {
          entity = value as T;
          break;
        }
      }
    }
  }

  if (!entity) {
    return {
      found: false,
      type,
      id,
      entity: null,
      error: `Entity not found: ${type}/${id}`,
    };
  }

  // Remove secrets if not authorized
  let processedEntity = entity;
  if (!includeSecrets) {
    processedEntity = stripSecrets(entity);
  }

  const result: LookupResult<T> = {
    found: true,
    type,
    id,
    entity: processedEntity,
  };

  // Resolve references if requested
  if (resolveReferences) {
    result.references = resolveEntityReferences(
      pack,
      entity as Record<string, unknown>,
      type,
      includeSecrets,
      query.maxReferenceDepth ?? 1
    );
  }

  return result;
}

/**
 * Strip sensitive information from an entity
 */
function stripSecrets<T>(entity: T): T {
  const record = entity as Record<string, unknown>;
  const stripped: Record<string, unknown> = { ...record };

  // Common secret fields
  const secretFields = ["secrets", "gmNotes", "gmGuidance", "hiddenInfo"];
  for (const field of secretFields) {
    if (field in stripped) {
      delete stripped[field];
    }
  }

  return stripped as T;
}

/**
 * Resolve references within an entity
 */
function resolveEntityReferences(
  pack: WorldContentPack,
  entity: Record<string, unknown>,
  type: LookupEntityType,
  includeSecrets: boolean,
  depth: number
): Record<string, LookupResult[]> {
  if (depth <= 0) {
    return {};
  }

  const references: Record<string, LookupResult[]> = {};

  // Type-specific reference resolution
  // Calculate whether to continue resolving references at the next level
  const nextDepth = depth - 1;
  const shouldResolveNext = nextDepth > 0;

  switch (type) {
    case "location": {
      const loc = entity as {
        connections?: Array<
          string | { to: string; travel?: string; observation?: string; risk?: string }
        >;
        npcs?: string[];
        encounters?: string[];
      };
      if (loc.connections?.length) {
        // Connections may be flat IDs or structured { to, travel, ... }.
        // Extract the ID before recursing on the linked location.
        references.connections = loc.connections.map((conn) => {
          const targetId = typeof conn === "string" ? conn : conn.to;
          return resolveEntityLookup(pack, {
            type: "location",
            id: targetId,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          });
        });
      }
      if (loc.npcs?.length) {
        references.npcs = loc.npcs.map((id) =>
          resolveEntityLookup(pack, {
            type: "npc",
            id,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      if (loc.encounters?.length) {
        references.encounters = loc.encounters.map((id) =>
          resolveEntityLookup(pack, {
            type: "encounter",
            id,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      break;
    }

    case "npc": {
      const npc = entity as { locations?: string[] };
      if (npc.locations?.length) {
        references.locations = npc.locations.map((id) =>
          resolveEntityLookup(pack, {
            type: "location",
            id,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      break;
    }

    case "encounter": {
      const enc = entity as {
        combat?: { monsters?: Array<{ monsterId: string }> };
        social?: { npcIds?: string[] };
      };
      if (enc.combat?.monsters?.length) {
        references.monsters = enc.combat.monsters.map((m) =>
          resolveEntityLookup(pack, {
            type: "monster",
            id: m.monsterId,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      if (enc.social?.npcIds?.length) {
        references.npcs = enc.social.npcIds.map((id) =>
          resolveEntityLookup(pack, {
            type: "npc",
            id,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      break;
    }

    case "archetype": {
      const arch = entity as { startingItems?: string[] };
      if (arch.startingItems?.length) {
        references.startingItems = arch.startingItems.map((id) =>
          resolveEntityLookup(pack, {
            type: "item",
            id,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      break;
    }

    case "situation": {
      const sit = entity as {
        locations?: { primary?: string[]; related?: string[] };
        actors?: Array<{ entityId: string }>;
        arcId?: string;
      };
      const locationIds = [...(sit.locations?.primary ?? []), ...(sit.locations?.related ?? [])];
      if (locationIds.length) {
        references.locations = locationIds.map((id) =>
          resolveEntityLookup(pack, {
            type: "location",
            id,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      if (sit.actors?.length) {
        references.actors = sit.actors.map((a) =>
          resolveEntityLookup(pack, {
            type: "npc", // Try NPC first, could also be faction
            id: a.entityId,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      if (sit.arcId) {
        references.arc = [
          resolveEntityLookup(pack, {
            type: "arc",
            id: sit.arcId,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          }),
        ];
      }
      break;
    }

    case "arc": {
      const arc = entity as { situationIds?: string[] };
      if (arc.situationIds?.length) {
        references.situations = arc.situationIds.map((id) =>
          resolveEntityLookup(pack, {
            type: "situation",
            id,
            includeSecrets,
            resolveReferences: shouldResolveNext,
            maxReferenceDepth: nextDepth,
          })
        );
      }
      break;
    }
  }

  return references;
}

/**
 * Search for entities by name across all types
 *
 * @param pack - World content pack
 * @param searchTerm - Search term
 * @param types - Types to search (all if empty)
 * @param limit - Maximum results (default: 10)
 * @returns Matching entities
 */
export function searchEntities(
  pack: WorldContentPack,
  searchTerm: string,
  types?: LookupEntityType[],
  limit: number = 10
): Array<{ type: LookupEntityType; id: string; name: string; score: number }> {
  const results: Array<{
    type: LookupEntityType;
    id: string;
    name: string;
    score: number;
  }> = [];

  const searchLower = searchTerm.toLowerCase();
  const typesToSearch: LookupEntityType[] = types ?? [
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
  ];

  for (const type of typesToSearch) {
    const collection = getCollection(pack, type);
    if (!collection) continue;

    for (const [id, value] of Object.entries(collection)) {
      const record = value as Record<string, unknown>;
      const name = record.name as string;
      if (!name) continue;

      const nameLower = name.toLowerCase();
      let score = 0;

      // Exact match
      if (nameLower === searchLower) {
        score = 100;
      }
      // Starts with
      else if (nameLower.startsWith(searchLower)) {
        score = 80;
      }
      // Contains
      else if (nameLower.includes(searchLower)) {
        score = 60;
      }
      // ID match
      else if (id.toLowerCase().includes(searchLower)) {
        score = 40;
      }

      if (score > 0) {
        results.push({ type, id, name, score });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Get entity counts by type
 */
export function getEntityCounts(pack: WorldContentPack): Record<LookupEntityType, number> {
  return {
    monster: Object.keys(pack.monsters).length,
    npc: Object.keys(pack.npcs).length,
    location: Object.keys(pack.locations).length,
    situation: Object.keys(pack.situations ?? {}).length,
    archetype: Object.keys(pack.archetypes).length,
    item: Object.keys(pack.items).length,
    encounter: Object.keys(pack.encounters).length,
    condition: Object.keys(pack.conditions).length,
    faction: Object.keys(pack.factions ?? {}).length,
    arc: Object.keys(pack.arcs ?? {}).length,
  };
}

/**
 * List all entity IDs for a type
 */
export function listEntityIds(pack: WorldContentPack, type: LookupEntityType): string[] {
  const collection = getCollection(pack, type);
  return collection ? Object.keys(collection) : [];
}
