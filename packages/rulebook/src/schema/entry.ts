/**
 * Entry schema — the leaf node of the rulebook hierarchy.
 *
 * One entry == one navigable item in the in-app book (e.g. "5.2 Push
 * Roll"). Entries serve a dual purpose: they're the player/GM-facing
 * documentation **and** the canonical specification of what the engine
 * implements. The schema fields support both jobs:
 *
 *  - Audience (player/gm/both) for view filtering
 *  - Kind (mechanic/catalog/workflow/concept/example) for renderer cues
 *  - Summary + body for quick-reference vs full views
 *  - Numbers for the defaults sidebar
 *  - Examples that double as test fixtures
 *  - canonicalSource pointers back to the implementing code
 *  - Extensibility flags for world-overridable rules
 *  - Xrefs and tags for navigation and search
 */

import { z } from "zod";
import { ContentBlockSchema } from "./content-blocks.js";

/**
 * Audience tag. Renderers can dim or hide entries that don't match the
 * current viewer's audience filter.
 *
 *  - `player`: facts a player needs at the table to play
 *  - `gm`: GM-only adjudication, internal mechanics, design notes
 *  - `both`: applies to both audiences (e.g. dice notation)
 */
export const AudienceSchema = z.enum(["player", "gm", "both"]);
export type Audience = z.infer<typeof AudienceSchema>;

/**
 * Entry kind — discriminator for the renderer's layout choice.
 *
 *  - `mechanic`: a deterministic procedure (push roll, attack resolution)
 *  - `catalog`: a list of items (conditions, GM moves, traumas)
 *  - `workflow`: a GM-support tool (clocks, leads, scene framing)
 *  - `concept`: explanatory only (position, effect level)
 *  - `example`: a worked example, often referenced by other entries
 */
export const EntryKindSchema = z.enum(["mechanic", "catalog", "workflow", "concept", "example"]);
export type EntryKind = z.infer<typeof EntryKindSchema>;

/**
 * Pointer back to the implementing code. Keeps the rulebook honest:
 * every mechanic entry should cite where its behavior is defined, so a
 * future audit can spot drift between rulebook and engine.
 */
export const FileRefSchema = z.object({
  /** Path relative to repo root, e.g. `packages/engine/src/resolution/test.ts`. */
  file: z.string(),
  /** Optional 1-indexed line number. Drops naturally as code moves. */
  line: z.number().int().positive().optional(),
});
export type FileRef = z.infer<typeof FileRefSchema>;

/**
 * Extensibility flag — whether this rule is fixed in the engine or
 * world-overridable. The `configPath` is a dotted path into
 * `WorldRulesConfig` (e.g. `mechanics.criticals.damageMultiplier`)
 * which the validator can resolve to confirm the rule's claim that a
 * world can override it.
 */
export const ExtensibilitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fixed"),
    /** Optional rationale — why this isn't world-overridable. */
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("world-overridable"),
    /** Dotted path into `WorldRulesConfig`. */
    configPath: z.string().min(1),
    /**
     * Whether the engine fully honors the override today, or partial
     * support exists (e.g. only one of several declared sub-options).
     */
    fullySupported: z.boolean(),
    /** Optional note on partial-support edges. */
    notes: z.string().optional(),
  }),
]);
export type Extensibility = z.infer<typeof ExtensibilitySchema>;

/**
 * A magic-number / default value the entry depends on. The defaults
 * sidebar uses these to render a consistent "Defaults" block per entry,
 * with each value cited back to its origin.
 *
 *  - `name`: human label, e.g. "Max stress"
 *  - `value`: serialized JSON-compatible value
 *  - `source`: dotted path to the constant, e.g. `BASE_STRESS.maxStress`
 */
export const NumberCitationSchema = z.object({
  name: z.string(),
  /**
   * Primitive value of the cited default. The defaults sidebar renders
   * each citation on a single line; structured values (tables, arrays)
   * belong in a `TableBlock` in the entry body, not here.
   */
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  source: z.string(),
});
export type NumberCitation = z.infer<typeof NumberCitationSchema>;

/**
 * A worked example. The `inputs` and `expectedOutputs` records double
 * as fixtures for tests — a future test runner can confirm the engine
 * still produces the documented outcome, keeping example prose honest.
 */
export const ExampleSchema = z.object({
  /** One-line title shown above the example. */
  title: z.string(),
  /**
   * Narrative description of the situation — the prose that frames the
   * inputs and expected outputs. Markdown subset (same as ProseBlock).
   */
  scenario: z.string(),
  /** Free-form input record, JSON-serializable. */
  inputs: z.record(z.string(), z.unknown()).optional(),
  /** Free-form expected-output record, JSON-serializable. */
  expectedOutputs: z.record(z.string(), z.unknown()).optional(),
  /** Optional commentary after the result. */
  commentary: z.string().optional(),
});
export type Example = z.infer<typeof ExampleSchema>;

/**
 * A single rulebook entry.
 */
export const EntrySchema = z.object({
  /**
   * Stable slug, e.g. `5.2-push-roll`. Used for deep-link URLs and
   * cross-references. Must be globally unique across the rulebook.
   * Once published, never change — it's load-bearing for bookmarks.
   */
  id: z.string().regex(/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/, {
    message: "Entry id must be lowercase alphanumerics, with `-` or `.` separators",
  }),
  /** Display title. */
  title: z.string().min(1),
  /** Discriminator for renderer layout. */
  kind: EntryKindSchema,
  /** Audience filter. */
  audience: AudienceSchema,
  /**
   * One-paragraph quick-reference summary. Shown in the quick-reference
   * sheet view, in entry list previews, and as the hover tooltip on
   * cross-reference links.
   */
  summary: z.string().min(1),
  /** Full body — the long-form content. */
  body: z.array(ContentBlockSchema),
  /**
   * Worked examples. Optional but encouraged for `mechanic` entries.
   */
  examples: z.array(ExampleSchema).optional(),
  /**
   * Default values / magic numbers the entry depends on. Drives the
   * "Defaults" sidebar in the rendered view.
   */
  numbers: z.array(NumberCitationSchema).optional(),
  /** Pointers back to the engine code that implements this rule. */
  canonicalSource: z.array(FileRefSchema).optional(),
  /** World-overridable flag + linkage to WorldRulesConfig. */
  extensibility: ExtensibilitySchema,
  /** Other entry ids this one references (for backlink rendering). */
  xref: z.array(z.string()).optional(),
  /**
   * Tags for search and filtering, e.g. `["combat", "meta-currency"]`.
   * Tags are free-form; conventional values: `combat`, `dice`,
   * `meta-currency`, `time`, `gm-support`, `world-overrides`.
   */
  tags: z.array(z.string()).optional(),
  /**
   * Whether to feature this entry in the curated quick-start view (the
   * "essentials" filter). Pick the 5–10 entries new players need on
   * their first session.
   */
  surfaceInQuickStart: z.boolean().optional(),
});
export type Entry = z.infer<typeof EntrySchema>;
