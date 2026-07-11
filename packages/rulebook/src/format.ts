/**
 * Markdown renderer for rulebook entries.
 *
 * Materializes a subset of the rulebook into plain Markdown for
 * downstream LLM consumers (the harness-side player agent, future
 * prompt builders). The renderer walks the entry body's
 * discriminated-union blocks and emits Markdown — no theme tokens,
 * no widget rendering. Anything not expressible in Markdown (e.g.
 * flowchart branches) becomes a textual fallback.
 *
 * Designed for the player-agent use case: feed `renderForAudience(
 * rulebook, "player")` into a system prompt and the model gets a
 * concise rules brief covering exactly the player-facing entries.
 */

import type { Audience } from "./schema/entry.js";
import type { ContentBlock } from "./schema/content-blocks.js";
import type { Rulebook, Chapter } from "./schema/structure.js";
import {
  buildRulebookIndex,
  entriesForAudience,
  type EntryLocation,
  type RulebookIndex,
} from "./helpers.js";

function renderProse(text: string): string {
  return text.trim();
}

function renderTable(headers: string[], rows: string[][], caption?: string): string {
  const lines: string[] = [];
  if (caption) lines.push(`_${caption}_`);
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    lines.push(`| ${row.join(" | ")} |`);
  }
  return lines.join("\n");
}

function renderFormula(
  name: string,
  expression: string,
  variables?: Record<string, string>
): string {
  const parts: string[] = [`**${name}**`, `\`${expression}\``];
  if (variables && Object.keys(variables).length > 0) {
    parts.push(
      "Where: " +
        Object.entries(variables)
          .map(([k, v]) => `\`${k}\` = ${v}`)
          .join("; ")
    );
  }
  return parts.join("  \n");
}

function renderCallout(tone: string, text: string, title?: string): string {
  const prefix = title ? `**${title}**` : `**${tone.toUpperCase()}**`;
  // Markdown blockquote with a bold prefix — readable in any
  // markdown viewer and clear to an LLM consumer.
  const body = text.trim().replace(/\n/g, "\n> ");
  return `> ${prefix}\n> ${body}`;
}

function renderFlowchart(
  steps: Array<{
    id: string;
    label: string;
    next?: string[];
    branchLabels?: Record<string, string>;
  }>,
  caption?: string
): string {
  // Plain-text fallback — number the steps and annotate branches
  // with their labels. Sufficient for an LLM to follow the flow;
  // anything richer (Mermaid, etc.) belongs in the UI renderer.
  const lines: string[] = [];
  if (caption) lines.push(`_${caption}_`);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    lines.push(`${i + 1}. ${s.label}`);
    if (s.next && s.next.length > 0) {
      for (const nextId of s.next) {
        const target = steps.findIndex((x) => x.id === nextId);
        const label = s.branchLabels?.[nextId];
        const arrow = target >= 0 ? `→ step ${target + 1}` : `→ ${nextId}`;
        lines.push(`   ${label ? `(${label}) ` : ""}${arrow}`);
      }
    }
  }
  return lines.join("\n");
}

function renderBlock(block: ContentBlock): string {
  switch (block.kind) {
    case "prose":
      return renderProse(block.text);
    case "table":
      return renderTable(block.headers, block.rows, block.caption);
    case "formula":
      return renderFormula(block.name, block.expression, block.variables);
    case "callout":
      return renderCallout(block.tone, block.text, block.title);
    case "flowchart":
      return renderFlowchart(block.steps, block.caption);
    default: {
      // Exhaustiveness check — compile error if we add a new kind.
      const _exhaustive: never = block;
      return String(_exhaustive);
    }
  }
}

/**
 * Render a single entry as a Markdown subsection. The heading uses
 * the entry's title and number-style id so consumers can cite
 * specific rules if they need to.
 */
export function renderEntry(loc: EntryLocation): string {
  const e = loc.entry;
  const heading = `### ${e.title} (${e.id})`;
  const summary = e.summary ? `_${e.summary}_` : "";
  const body = e.body
    .map(renderBlock)
    .filter((b) => b.length > 0)
    .join("\n\n");
  return [heading, summary, body].filter((s) => s.length > 0).join("\n\n");
}

/**
 * Render every entry visible to the given audience, grouped by
 * chapter so the output reads as a coherent rules brief. Chapters
 * with no audience-visible entries are skipped.
 *
 * `both` audience returns every entry (player + gm + both). `player`
 * and `gm` return their own audience plus `both`.
 */
export function renderForAudience(rulebook: Rulebook, audience: Audience): string {
  const index = buildRulebookIndex(rulebook);
  const visible = entriesForAudience(index, audience);

  // Group by chapter id so chapter headings sit above their entries.
  const byChapter = new Map<string, EntryLocation[]>();
  for (const loc of visible) {
    const list = byChapter.get(loc.chapter.id) ?? [];
    list.push(loc);
    byChapter.set(loc.chapter.id, list);
  }

  const out: string[] = [];
  out.push(`# ${rulebook.title}`);

  for (const chapter of rulebook.chapters) {
    const entries = byChapter.get(chapter.id);
    if (!entries || entries.length === 0) continue;
    out.push(`## Chapter ${chapter.number}: ${chapter.title}`);
    if (chapter.summary) out.push(`_${chapter.summary}_`);
    for (const loc of entries) {
      out.push(renderEntry(loc));
    }
  }

  return out.join("\n\n");
}

/**
 * Quick-start-only render — only entries flagged `surfaceInQuickStart`.
 * Useful when the consumer (e.g. a new-player onboarding tooltip)
 * doesn't need the full rulebook.
 */
export function renderQuickStart(rulebook: Rulebook, audience: Audience): string {
  const index = buildRulebookIndex(rulebook);
  const visible = entriesForAudience(index, audience).filter(
    (loc) => loc.entry.surfaceInQuickStart === true
  );

  const out: string[] = [];
  out.push(`# ${rulebook.title} — Quick Start (${audience})`);
  for (const loc of visible) {
    out.push(renderEntry(loc));
  }
  return out.join("\n\n");
}

// Re-export so consumers can import the index types from one place.
export type { RulebookIndex, EntryLocation, Chapter };
