/**
 * Content blocks — discriminated union for the body of a rulebook entry.
 *
 * The renderer dispatches on `kind`; each variant carries only the data
 * needed to render that block. Presentation (color, spacing, font) lives
 * in the renderer, not the data — schema stays semantic so the same
 * entry renders correctly under any theme and future re-skins.
 */

import { z } from "zod";

/**
 * A paragraph of prose. Inline-formatting tokens (bold, code, xref) are
 * expressed as Markdown so authoring stays terse; the renderer parses
 * a small Markdown subset (bold `**`, code `` ` ``, links `[text](id)`
 * where `id` matches an entry id).
 */
export const ProseBlockSchema = z.object({
  kind: z.literal("prose"),
  /** Markdown source — inline-only; no headings or block-level constructs. */
  text: z.string(),
});
export type ProseBlock = z.infer<typeof ProseBlockSchema>;

/**
 * A table. Header is a row of column labels; body is an array of rows.
 * Rendered as a semantic `<table>` with theme-driven styling.
 */
export const TableBlockSchema = z.object({
  kind: z.literal("table"),
  /** Optional caption rendered above the table. */
  caption: z.string().optional(),
  /** Column headers. */
  headers: z.array(z.string()).min(1),
  /** Rows — each row's length must equal `headers.length`. */
  rows: z.array(z.array(z.string())),
});
export type TableBlock = z.infer<typeof TableBlockSchema>;

/**
 * A formula. Rendered as a code-style monospace expression — semantic
 * markup so screen readers can read it back.
 *
 * Use `name` for the formula's role ("attack margin"), `expression`
 * for the formula text. Variables (`{name}` placeholders) can be
 * documented in the optional `variables` map.
 */
export const FormulaBlockSchema = z.object({
  kind: z.literal("formula"),
  /** Short name for the formula, e.g. "test margin". */
  name: z.string(),
  /** The formula expression itself. */
  expression: z.string(),
  /** Optional: variable name → human-readable description. */
  variables: z.record(z.string(), z.string()).optional(),
});
export type FormulaBlock = z.infer<typeof FormulaBlockSchema>;

/**
 * A flowchart. Encoded as a list of steps with optional branches. The
 * renderer turns it into a vertical step list (or a Mermaid diagram if
 * the host has a Mermaid renderer available — that's a renderer
 * decision, not a schema one).
 *
 * Keeping this as structured data (not raw Mermaid source) means the
 * same flowchart is searchable, accessible, and re-render-able under
 * any visual style.
 */
export const FlowchartStepSchema = z.object({
  /** Stable id for cross-referencing branches. */
  id: z.string(),
  /** Human-readable label for the step. */
  label: z.string(),
  /** Optional: ids of next steps (multiple = branching). */
  next: z.array(z.string()).optional(),
  /**
   * Branch condition labels keyed by next-step id, e.g.
   * `{ "step-3": "on partial", "step-4": "on failure" }`.
   */
  branchLabels: z.record(z.string(), z.string()).optional(),
});
export type FlowchartStep = z.infer<typeof FlowchartStepSchema>;

export const FlowchartBlockSchema = z.object({
  kind: z.literal("flowchart"),
  caption: z.string().optional(),
  steps: z.array(FlowchartStepSchema).min(1),
});
export type FlowchartBlock = z.infer<typeof FlowchartBlockSchema>;

/**
 * A callout — emphasized note. The renderer picks an appropriate visual
 * treatment (color, icon) based on `tone` from theme tokens; the schema
 * just declares semantic intent.
 */
export const CalloutBlockSchema = z.object({
  kind: z.literal("callout"),
  /** Semantic tone, mapped to theme tokens by the renderer. */
  tone: z.enum(["info", "tip", "warning", "danger", "example"]),
  /** Optional title above the body. */
  title: z.string().optional(),
  /** Markdown source — inline-only, same subset as prose. */
  text: z.string(),
});
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;

/**
 * Discriminated union of every content block type. Every renderer
 * needs a case for every variant — exhaustiveness is enforced by TS.
 */
export const ContentBlockSchema = z.discriminatedUnion("kind", [
  ProseBlockSchema,
  TableBlockSchema,
  FormulaBlockSchema,
  FlowchartBlockSchema,
  CalloutBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
