/**
 * Structural schemas — Section, Chapter, Rulebook.
 *
 * Hierarchy: Rulebook → Chapter → Section → Entry. Ordering is
 * explicit (arrays, not records) so the rendered table-of-contents
 * matches authoring order — `Object.entries` order is not a contract.
 */

import { z } from "zod";
import { EntrySchema } from "./entry.js";

/**
 * A section groups related entries within a chapter, e.g.
 * `5.1 Stress tracker`, `5.2 Push roll` etc. all live in
 * Chapter 5's `meta-currency-mechanics` section (or several sections).
 */
export const SectionSchema = z.object({
  /**
   * Stable slug, unique within its chapter, e.g. `meta-currency`.
   * The full canonical id of an entry is `{chapter.id}/{section.id}/{entry.id}`.
   */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Section id must be lowercase alphanumerics with `-` separators",
  }),
  title: z.string().min(1),
  /** Optional one-line blurb shown under the section heading. */
  summary: z.string().optional(),
  /** Ordered entries. */
  entries: z.array(EntrySchema),
});
export type Section = z.infer<typeof SectionSchema>;

/**
 * A chapter groups related sections, e.g. Chapter 5 = "Stress &
 * Meta-Currency". Top-level navigation in the in-app book.
 */
export const ChapterSchema = z.object({
  /**
   * Stable slug, e.g. `stress-meta-currency`. Used as a URL segment.
   */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Chapter id must be lowercase alphanumerics with `-` separators",
  }),
  /** 1-based ordinal (matches the audit's "Chapter 1", "Chapter 2", …). */
  number: z.number().int().positive(),
  title: z.string().min(1),
  /** Optional intro blurb shown at the top of the chapter view. */
  summary: z.string().optional(),
  /** Ordered sections. */
  sections: z.array(SectionSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;

/**
 * The full rulebook — top-level container.
 */
/**
 * Semantic-version pattern: `MAJOR.MINOR.PATCH` with optional
 * pre-release / build metadata suffixes (`1.0.0-beta.1`, `1.0.0+build.5`).
 * Trimmed from the canonical semver.org regex to what we actually use.
 */
const SEMVER_REGEX =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const RulebookSchema = z.object({
  /** Display title, e.g. "MythxEngine Rulebook". */
  title: z.string().min(1),
  /**
   * Semantic version of the rulebook content (independent of the
   * package's npm version). Bumped manually when authored content
   * changes meaningfully — readers see this in the UI footer, so a
   * malformed string would surface there.
   */
  version: z.string().regex(SEMVER_REGEX, {
    message: "Rulebook version must be a semver string (e.g. 1.0.0)",
  }),
  /** Ordered chapters. */
  chapters: z.array(ChapterSchema),
});
export type Rulebook = z.infer<typeof RulebookSchema>;
