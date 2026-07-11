/**
 * Rulebook lookup, validation, and search helpers.
 *
 * The functions here build derived structures (id maps, search
 * indices) once from a `Rulebook` value, then expose cheap lookups.
 * Use `buildRulebookIndex(book)` to get a single object holding
 * everything; the standalone functions are for one-off needs.
 */

import type { Audience, Chapter, Entry, Rulebook, Section } from "./schema/index.js";

// ============================================================================
// Index construction
// ============================================================================

/**
 * Locator for an entry within the rulebook hierarchy. Returned by
 * lookups so callers don't have to hold their own back-pointers.
 */
export interface EntryLocation {
  chapter: Chapter;
  section: Section;
  entry: Entry;
}

/**
 * Pre-built index over a `Rulebook` for cheap lookups. Build once per
 * rulebook value; the index is cheap to hold and immutable from the
 * caller's perspective.
 */
export interface RulebookIndex {
  rulebook: Rulebook;
  /** Entry id → its location in the hierarchy. */
  entries: Map<string, EntryLocation>;
  /** Chapter id → chapter. */
  chapters: Map<string, Chapter>;
  /** Tag → entries that carry it. */
  tagsByEntry: Map<string, EntryLocation[]>;
  /** Reverse cross-references: target entry id → entries that link to it. */
  backlinks: Map<string, EntryLocation[]>;
}

export function buildRulebookIndex(rulebook: Rulebook): RulebookIndex {
  const entries = new Map<string, EntryLocation>();
  const chapters = new Map<string, Chapter>();
  const tagsByEntry = new Map<string, EntryLocation[]>();
  const backlinks = new Map<string, EntryLocation[]>();

  for (const chapter of rulebook.chapters) {
    chapters.set(chapter.id, chapter);
    for (const section of chapter.sections) {
      for (const entry of section.entries) {
        const loc: EntryLocation = { chapter, section, entry };
        entries.set(entry.id, loc);

        for (const tag of entry.tags ?? []) {
          const list = tagsByEntry.get(tag);
          if (list) list.push(loc);
          else tagsByEntry.set(tag, [loc]);
        }
      }
    }
  }

  // Second pass: build backlinks once every entry id is known. (Skipping
  // unresolved refs here; `validateRulebook` is the place to flag them.)
  for (const [, loc] of entries) {
    for (const targetId of loc.entry.xref ?? []) {
      const list = backlinks.get(targetId);
      if (list) list.push(loc);
      else backlinks.set(targetId, [loc]);
    }
  }

  return { rulebook, entries, chapters, tagsByEntry, backlinks };
}

// ============================================================================
// Lookups
// ============================================================================

export function getEntry(index: RulebookIndex, id: string): EntryLocation | undefined {
  return index.entries.get(id);
}

export function getChapter(index: RulebookIndex, id: string): Chapter | undefined {
  return index.chapters.get(id);
}

export function entriesByTag(index: RulebookIndex, tag: string): EntryLocation[] {
  return index.tagsByEntry.get(tag) ?? [];
}

export function backlinksTo(index: RulebookIndex, entryId: string): EntryLocation[] {
  return index.backlinks.get(entryId) ?? [];
}

export function entriesForAudience(index: RulebookIndex, audience: Audience): EntryLocation[] {
  // `both` matches everything; player/gm match own audience + `both`.
  const out: EntryLocation[] = [];
  for (const loc of index.entries.values()) {
    if (audience === "both" || loc.entry.audience === "both" || loc.entry.audience === audience) {
      out.push(loc);
    }
  }
  return out;
}

export function quickStartEntries(index: RulebookIndex): EntryLocation[] {
  const out: EntryLocation[] = [];
  for (const loc of index.entries.values()) {
    if (loc.entry.surfaceInQuickStart) out.push(loc);
  }
  return out;
}

// ============================================================================
// Search
// ============================================================================

/**
 * Lightweight full-text search. Tokenizes each entry's searchable
 * text once, then matches query terms by case-insensitive substring.
 * Good enough for a few hundred entries; if the rulebook grows past
 * that, swap in a real index (e.g. minisearch).
 */
export interface SearchResult {
  location: EntryLocation;
  /** 0..N — number of distinct query terms that matched. */
  score: number;
  /** Which fields contributed matches (for highlighting). */
  matchedIn: Array<"title" | "summary" | "body" | "tags">;
}

export function searchRulebook(
  index: RulebookIndex,
  query: string,
  opts: { audience?: Audience; limit?: number } = {}
): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  for (const loc of index.entries.values()) {
    if (
      opts.audience &&
      opts.audience !== "both" &&
      loc.entry.audience !== "both" &&
      loc.entry.audience !== opts.audience
    ) {
      continue;
    }

    const title = loc.entry.title.toLowerCase();
    const summary = loc.entry.summary.toLowerCase();
    const tags = (loc.entry.tags ?? []).join(" ").toLowerCase();
    const body = bodyToText(loc.entry).toLowerCase();

    const matchedIn = new Set<SearchResult["matchedIn"][number]>();
    let score = 0;
    for (const term of terms) {
      let hit = false;
      if (title.includes(term)) {
        matchedIn.add("title");
        hit = true;
      }
      if (summary.includes(term)) {
        matchedIn.add("summary");
        hit = true;
      }
      if (tags.includes(term)) {
        matchedIn.add("tags");
        hit = true;
      }
      if (body.includes(term)) {
        matchedIn.add("body");
        hit = true;
      }
      if (hit) score += 1;
    }

    if (score > 0) {
      results.push({ location: loc, score, matchedIn: [...matchedIn] });
    }
  }

  // Title hits beat body hits at equal term count; stable by id otherwise.
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTitle = a.matchedIn.includes("title") ? 1 : 0;
    const bTitle = b.matchedIn.includes("title") ? 1 : 0;
    if (bTitle !== aTitle) return bTitle - aTitle;
    return a.location.entry.id.localeCompare(b.location.entry.id);
  });

  if (opts.limit === undefined) return results;
  // Treat 0 as "no results" (caller asked for none) and clamp negatives;
  // a truthy check would have silently turned 0 into "no limit" and
  // sliced from the end on negatives.
  return results.slice(0, Math.max(0, opts.limit));
}

/**
 * Flatten an entry's body to plain text for search. Strips block kinds
 * the renderer would have visualized differently — for searching, all
 * we need is the textual content.
 */
function bodyToText(entry: Entry): string {
  const parts: string[] = [];
  for (const block of entry.body) {
    switch (block.kind) {
      case "prose":
        parts.push(block.text);
        break;
      case "table":
        if (block.caption) parts.push(block.caption);
        parts.push(block.headers.join(" "));
        for (const row of block.rows) parts.push(row.join(" "));
        break;
      case "formula":
        parts.push(block.name, block.expression);
        if (block.variables) {
          for (const [k, v] of Object.entries(block.variables)) {
            parts.push(k, v);
          }
        }
        break;
      case "flowchart":
        if (block.caption) parts.push(block.caption);
        for (const step of block.steps) parts.push(step.label);
        break;
      case "callout":
        if (block.title) parts.push(block.title);
        parts.push(block.text);
        break;
    }
  }
  for (const example of entry.examples ?? []) {
    parts.push(example.title, example.scenario);
    if (example.commentary) parts.push(example.commentary);
  }
  return parts.join(" ");
}

// ============================================================================
// Validation
// ============================================================================

/**
 * A single integrity issue found while validating a built rulebook.
 *
 * `severity: "error"` indicates a structural problem the renderer or
 * navigation will choke on; `"warning"` flags drift / soft-coupling
 * that's worth a maintainer's attention but won't break runtime.
 */
export interface RulebookIssue {
  severity: "error" | "warning";
  /** Stable code so callers can suppress / filter. */
  code:
    | "duplicate-entry-id"
    | "duplicate-chapter-id"
    | "broken-xref"
    | "extensibility-config-path-unknown"
    | "extensibility-partial-support"
    | "empty-entry-body"
    | "chapter-number-collision";
  message: string;
  /** Where in the rulebook the issue was found, when applicable. */
  entryId?: string;
  chapterId?: string;
}

export interface ValidateOptions {
  /**
   * If supplied, validates that every world-overridable entry's
   * `configPath` resolves to a real key inside this object. Pass
   * `BASE_RULES` from `@mythxengine/types` (the resolved defaults)
   * so dotted paths can be walked.
   */
  worldRulesShape?: Record<string, unknown>;
}

/**
 * Validate a built rulebook for structural integrity and semantic
 * consistency. Schema-level errors should already have been caught by
 * `RulebookSchema.parse(...)` — this adds the cross-cutting checks
 * Zod can't express on a single value (uniqueness, xref resolution,
 * extensibility-link liveness).
 */
export function validateRulebook(rulebook: Rulebook, opts: ValidateOptions = {}): RulebookIssue[] {
  const issues: RulebookIssue[] = [];

  const seenEntryIds = new Set<string>();
  const seenChapterIds = new Set<string>();
  const seenChapterNumbers = new Set<number>();

  for (const chapter of rulebook.chapters) {
    if (seenChapterIds.has(chapter.id)) {
      issues.push({
        severity: "error",
        code: "duplicate-chapter-id",
        message: `Chapter id "${chapter.id}" appears more than once`,
        chapterId: chapter.id,
      });
    } else {
      seenChapterIds.add(chapter.id);
    }

    if (seenChapterNumbers.has(chapter.number)) {
      issues.push({
        severity: "error",
        code: "chapter-number-collision",
        message: `Chapter number ${chapter.number} is used by more than one chapter`,
        chapterId: chapter.id,
      });
    } else {
      seenChapterNumbers.add(chapter.number);
    }

    for (const section of chapter.sections) {
      for (const entry of section.entries) {
        if (seenEntryIds.has(entry.id)) {
          issues.push({
            severity: "error",
            code: "duplicate-entry-id",
            message: `Entry id "${entry.id}" appears more than once`,
            entryId: entry.id,
          });
        } else {
          seenEntryIds.add(entry.id);
        }

        if (entry.body.length === 0) {
          issues.push({
            severity: "warning",
            code: "empty-entry-body",
            message: `Entry "${entry.id}" has an empty body — only summary will render`,
            entryId: entry.id,
          });
        }

        if (
          entry.extensibility.kind === "world-overridable" &&
          !entry.extensibility.fullySupported
        ) {
          issues.push({
            severity: "warning",
            code: "extensibility-partial-support",
            message: `Entry "${entry.id}" claims partial world-override support: ${
              entry.extensibility.notes ?? "(no notes)"
            }`,
            entryId: entry.id,
          });
        }

        if (entry.extensibility.kind === "world-overridable" && opts.worldRulesShape) {
          if (!resolveDottedPath(opts.worldRulesShape, entry.extensibility.configPath)) {
            issues.push({
              severity: "error",
              code: "extensibility-config-path-unknown",
              message: `Entry "${entry.id}" extensibility.configPath "${entry.extensibility.configPath}" does not resolve in the supplied world-rules shape`,
              entryId: entry.id,
            });
          }
        }
      }
    }
  }

  // Second pass: xref resolution after all entry ids are collected.
  for (const chapter of rulebook.chapters) {
    for (const section of chapter.sections) {
      for (const entry of section.entries) {
        for (const targetId of entry.xref ?? []) {
          if (!seenEntryIds.has(targetId)) {
            issues.push({
              severity: "error",
              code: "broken-xref",
              message: `Entry "${entry.id}" cross-references unknown entry id "${targetId}"`,
              entryId: entry.id,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Resolve a dotted path like `mechanics.criticals.damageMultiplier`
 * against an object. Returns `true` if every segment in the path
 * exists as a property on its parent — even if the leaf value is
 * `undefined`. Optional knobs (e.g. `mechanics.rollUnder`) are valid
 * configPaths whether or not the default rules populate them.
 */
function resolveDottedPath(root: Record<string, unknown>, path: string): boolean {
  const segments = path.split(".");
  let cursor: unknown = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (cursor === null || cursor === undefined) return false;
    if (typeof cursor !== "object") return false;
    if (!(seg in (cursor as Record<string, unknown>))) return false;
    cursor = (cursor as Record<string, unknown>)[seg];
    // Non-last segments must walk into a navigable container; the leaf
    // is allowed to be `undefined` so optional configs resolve.
    if (!isLast && (cursor === null || cursor === undefined)) return false;
  }
  return true;
}
