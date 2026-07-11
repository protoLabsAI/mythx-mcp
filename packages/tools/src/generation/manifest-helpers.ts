/**
 * ID Manifest Helpers
 *
 * Shared utilities for formatting entity ID manifests in generation prompts.
 * Ensures consistent ID injection across all generators to prevent
 * "undefined: EntityName" bugs when seed entities lack pre-allocated IDs.
 */

/**
 * Slugify a name for use as an entity ID.
 * Converts to lowercase, replaces spaces with hyphens, removes non-alphanumeric chars.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Ensure a cross-reference value carries the expected domain prefix.
 *
 * Some models emit bare slugs (e.g. `"pulse-rifle"`) inside cross-reference
 * fields where the manifest contract is to use canonical IDs (`"item:pulse-rifle"`).
 * If the captured value doesn't contain `:`, prepend the expected prefix so
 * the reference resolves against the manifest.
 *
 * Trims leading/trailing whitespace before checking and prefixing — XML
 * whitespace can leak in from the LLM output and pollute every later
 * comparison if not normalized here.
 *
 * Pass-through for empty (or whitespace-only) strings.
 */
export function normalizeRef(ref: string, prefix: string): string {
  if (!ref) return ref;
  const trimmed = ref.trim();
  if (!trimmed) return trimmed;
  return trimmed.includes(":") ? trimmed : `${prefix}:${trimmed}`;
}

/**
 * Apply normalizeRef to every entry in an array. Drops entries that
 * trim to empty (so callers don't see phantom `"prefix:"` refs).
 */
export function normalizeRefs(refs: string[], prefix: string): string[] {
  const result: string[] = [];
  for (const r of refs) {
    const normalized = normalizeRef(r, prefix);
    if (normalized) result.push(normalized);
  }
  return result;
}

/**
 * Compute Levenshtein distance between two strings using the standard
 * O(m*n) dynamic programming approach.
 *
 * Used by `resolveRef` for fuzzy-matching slightly-misspelled entity
 * IDs back to the canonical manifest (e.g. "item:nanoite-repair-paste"
 * → "item:nanite-repair-paste"). Distance 1–2 catches typical typos
 * (single-char insertion/deletion/substitution) without matching
 * legitimately different IDs.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Two-row optimization
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Result of attempting to resolve a reference against a manifest.
 *
 * - `exact`: ref already matches a manifest entry; no change made
 * - `fuzzy`: ref didn't match exactly but a single nearby manifest
 *   entry (distance ≤ FUZZY_THRESHOLD) was substituted in
 * - `missing`: no exact or fuzzy match — caller should drop the ref
 *
 * `original` and `resolved` are populated for `exact` and `fuzzy`
 * outcomes; `resolved` is null for `missing`.
 */
export interface ResolveResult {
  outcome: "exact" | "fuzzy" | "missing";
  original: string;
  resolved: string | null;
}

const FUZZY_THRESHOLD = 2;

/**
 * Resolve a reference against a manifest of valid IDs.
 *
 * 1. Exact match → return the original.
 * 2. Levenshtein distance ≤ 2 to exactly one manifest entry → return
 *    that entry as a substitution. Multiple equally-close matches
 *    count as ambiguous and are treated as a miss to avoid silently
 *    picking wrong.
 * 3. Otherwise → miss.
 *
 * The caller decides what to do with each outcome. Typical use:
 * keep `exact` and `fuzzy` (logging the latter), drop `missing`.
 */
export function resolveRef(ref: string, manifest: ReadonlySet<string>): ResolveResult {
  if (manifest.has(ref)) {
    return { outcome: "exact", original: ref, resolved: ref };
  }

  let bestDistance = FUZZY_THRESHOLD + 1;
  let bestMatch: string | null = null;
  let tied = false;

  for (const candidate of manifest) {
    const d = levenshtein(ref, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      bestMatch = candidate;
      tied = false;
    } else if (d === bestDistance) {
      tied = true;
    }
  }

  if (bestMatch && !tied && bestDistance <= FUZZY_THRESHOLD) {
    return { outcome: "fuzzy", original: ref, resolved: bestMatch };
  }
  return { outcome: "missing", original: ref, resolved: null };
}

/**
 * Resolve every reference in an array against a manifest, returning
 * only the resolved IDs (exact + fuzzy). Missing refs are dropped.
 *
 * Logs a warning summary when fuzzy substitutions or drops occurred.
 */
export function resolveRefs(
  refs: readonly string[],
  manifest: ReadonlySet<string>,
  context: string
): string[] {
  if (refs.length === 0) return [];
  const out: string[] = [];
  const fuzzy: Array<[string, string]> = [];
  const missing: string[] = [];

  for (const r of refs) {
    const result = resolveRef(r, manifest);
    if (result.outcome === "exact") {
      out.push(result.resolved!);
    } else if (result.outcome === "fuzzy") {
      out.push(result.resolved!);
      fuzzy.push([result.original, result.resolved!]);
    } else {
      missing.push(result.original);
    }
  }

  if (fuzzy.length > 0) {
    console.warn(
      `[${context}] Fuzzy-resolved ${fuzzy.length} ref(s): ${fuzzy
        .map(([from, to]) => `${from}→${to}`)
        .join(", ")}`
    );
  }
  if (missing.length > 0) {
    console.warn(
      `[${context}] Dropped ${missing.length} unresolvable ref(s): ${missing.join(", ")}`
    );
  }

  return out;
}

/**
 * Get the entity ID, falling back to generating one from the name with the given prefix.
 */
export function entityId(seed: { id?: string; name: string }, prefix: string): string {
  return seed.id || `${prefix}:${slugify(seed.name)}`;
}

/**
 * Format a single entity for manifest display: "type:slug-name: Display Name"
 */
export function formatManifestEntry(seed: { id?: string; name: string }, prefix: string): string {
  return `${entityId(seed, prefix)}: ${seed.name}`;
}

/**
 * Format a list of entities for manifest display with one entry per line.
 */
export function formatManifestList(
  seeds: Array<{ id?: string; name: string }>,
  prefix: string
): string {
  if (!seeds || seeds.length === 0) return `(none pre-allocated)`;
  return seeds.map((s) => formatManifestEntry(s, prefix)).join("\n");
}

/**
 * Format a list of entities as comma-separated manifest entries.
 */
export function formatManifestInline(
  seeds: Array<{ id?: string; name: string }>,
  prefix: string
): string {
  if (!seeds || seeds.length === 0) return `(none pre-allocated)`;
  return seeds.map((s) => formatManifestEntry(s, prefix)).join(", ");
}

/**
 * Format monster seeds with threat tier info.
 */
export function formatMonsterManifest(
  seeds: Array<{ id?: string; name: string; threat: string }>,
  inline = false
): string {
  if (!seeds || seeds.length === 0) return "No monster seeds available";
  const entries = seeds.map((s) => `${entityId(s, "monster")}: ${s.name} (${s.threat})`);
  return inline ? entries.join(", ") : entries.join("\n");
}

/**
 * Format item seeds with kind info.
 */
export function formatItemManifest(
  seeds: Array<{ id?: string; name: string; kind?: string }>,
  inline = false
): string {
  if (!seeds || seeds.length === 0) return "Generate item:slug-name IDs";
  const entries = seeds.map((s) => `${entityId(s, "item")}: ${s.name} (${s.kind || "misc"})`);
  return inline ? entries.join(", ") : entries.join("\n");
}

/**
 * Tier-based recommended content counts.
 * Used by generators to auto-calculate counts when not explicitly provided.
 */
export const tierContentCounts = {
  small: {
    archetypes: 6,
    locations: 4,
    npcs: 3,
    monsters: 6,
    items: 10,
    encounters: 6,
    situations: 3,
    arcs: 1,
    conditions: 4,
    factions: 2,
  },
  medium: {
    archetypes: 6,
    locations: 6,
    npcs: 5,
    monsters: 10,
    items: 18,
    encounters: 10,
    situations: 4,
    arcs: 2,
    conditions: 6,
    factions: 3,
  },
  large: {
    archetypes: 6,
    locations: 10,
    npcs: 8,
    monsters: 15,
    items: 25,
    encounters: 15,
    situations: 6,
    arcs: 3,
    conditions: 8,
    factions: 5,
  },
} as const;

export type WorldTier = keyof typeof tierContentCounts;

/**
 * Infer the world tier from the seed based on archetype count.
 */
export function inferTier(archetypeCount: number): WorldTier {
  if (archetypeCount <= 3) return "small";
  if (archetypeCount <= 5) return "medium";
  return "large";
}

/**
 * Get recommended content count for a content type based on world tier.
 * Returns the recommended count, or the explicit count if provided.
 */
export function getRecommendedCount(
  contentType: keyof (typeof tierContentCounts)["medium"],
  tier: WorldTier,
  explicitCount?: number
): number {
  if (explicitCount !== undefined) return explicitCount;
  return tierContentCounts[tier][contentType];
}
