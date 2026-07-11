/**
 * Rule Lookup Tool
 *
 * Gives the GM agent on-demand access to the full mechanical depth
 * of `@mythxengine/rulebook`. Cheap (~1ms, no LLM call, no DB hit) —
 * just an in-memory lookup against the bundled rulebook value.
 *
 * The system prompt carries the player-facing layer (5-tier outcomes,
 * GM moves, position/effect, basic stress mechanics). For everything
 * else — roll-under math, conditions catalog, trauma details, combat
 * damage formula, situation-clock structure, world-overrides, etc. —
 * the agent calls this tool with an entry id or a tag to pull the
 * exact spec on demand instead of guessing.
 *
 * Two modes:
 *   - `entryId`: returns the full entry rendered as compact markdown
 *   - `tag`: returns a list of matching entry ids + summaries; the
 *            agent then re-calls with a specific entryId to drill in
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";
import { rulebook, buildRulebookIndex } from "@mythxengine/rulebook";
import type { ContentBlock, Entry } from "@mythxengine/rulebook";

export const LookupRuleInputSchema = z
  .object({
    entryId: z
      .string()
      .optional()
      .describe(
        "Specific entry id, e.g. '5.6-trauma' or '4.1-standard-test'. Returns the full entry."
      ),
    tag: z
      .string()
      .optional()
      .describe(
        "Tag to list matching entries, e.g. 'stress', 'combat', 'world-overrides'. Returns id+summary list to drill into."
      ),
  })
  .refine((v) => Boolean(v.entryId || v.tag), {
    message: "Provide either entryId or tag",
  });

export type LookupRuleInput = z.infer<typeof LookupRuleInputSchema>;

/**
 * Output type. Either an entry hit (markdown body) or a tag listing
 * (array of {id, title, summary}). The agent reads `kind` to decide.
 */
export type LookupRuleOutput =
  | {
      kind: "entry";
      entryId: string;
      title: string;
      markdown: string;
    }
  | {
      kind: "tag-listing";
      tag: string;
      matches: Array<{
        entryId: string;
        chapter: string;
        title: string;
        summary?: string;
      }>;
    }
  | {
      kind: "not-found";
      query: string;
      hint: string;
    };

// Build index once at module load — rulebook is immutable per build.
const _index = buildRulebookIndex(rulebook);

function renderBlock(block: ContentBlock): string {
  switch (block.kind) {
    case "prose":
      return block.text;

    case "table": {
      const lines: string[] = [];
      if (block.caption) lines.push(`*${block.caption}*`);
      lines.push(`| ${block.headers.join(" | ")} |`);
      lines.push(`| ${block.headers.map(() => "---").join(" | ")} |`);
      for (const row of block.rows) {
        lines.push(`| ${row.join(" | ")} |`);
      }
      return lines.join("\n");
    }

    case "formula": {
      const expr = `\`${block.expression}\``;
      const head = `**${block.name}** — ${expr}`;
      if (!block.variables) return head;
      const varLines = Object.entries(block.variables).map(([k, v]) => `  - \`${k}\`: ${v}`);
      return [head, ...varLines].join("\n");
    }

    case "callout": {
      const tone = block.tone.toUpperCase();
      const title = block.title ? ` ${block.title}:` : "";
      return `> **[${tone}]${title}** ${block.text}`;
    }

    case "flowchart": {
      // Compact textual representation — the rich UI renderer turns this
      // into a Mermaid-style diagram; for the agent's prompt we just
      // list the steps in order with any branch labels inline.
      const lines = block.steps.map((s, i) => {
        const branches = s.branchLabels
          ? Object.entries(s.branchLabels)
              .map(([id, label]) => `${label} → ${id}`)
              .join("; ")
          : "";
        return `  ${i + 1}. ${s.label}${branches ? ` (${branches})` : ""}`;
      });
      return `*Flow:*\n${lines.join("\n")}`;
    }
  }
}

function renderEntry(entry: Entry): string {
  const sections: string[] = [];

  sections.push(`# ${entry.title}`);
  if (entry.summary) sections.push(`*${entry.summary}*`);

  for (const block of entry.body) {
    sections.push(renderBlock(block));
  }

  if (entry.numbers && entry.numbers.length > 0) {
    sections.push("**Numbers (engine defaults):**");
    sections.push(
      entry.numbers.map((n) => `- ${n.name} = \`${JSON.stringify(n.value)}\``).join("\n")
    );
  }

  if (entry.examples && entry.examples.length > 0) {
    sections.push("**Examples:**");
    for (const ex of entry.examples) {
      sections.push(`- *${ex.title}* — ${ex.scenario}`);
    }
  }

  if (entry.extensibility.kind === "world-overridable") {
    sections.push(
      `**World-overridable** — \`${entry.extensibility.configPath}\`${entry.extensibility.fullySupported ? "" : " (partial support)"}`
    );
  }

  if (entry.xref && entry.xref.length > 0) {
    sections.push(`**Cross-refs:** ${entry.xref.map((id) => `\`${id}\``).join(", ")}`);
  }

  return sections.join("\n\n");
}

export const lookupRuleTool = defineSharedTool({
  name: "lookup_rule",
  description:
    "Look up a rulebook entry by id (e.g. '5.6-trauma') for full mechanical detail, or list entries by tag (e.g. 'stress', 'combat') to find a specific entry. Use when you need engine math the system prompt doesn't cover (roll-under, custom tests, conditions catalog, trauma details, damage formula, world-overrides, etc.) — cheap (~1ms, no LLM call).",
  inputSchema: LookupRuleInputSchema,
  emits: [],

  handler: async (input): Promise<LookupRuleOutput> => {
    if (input.entryId) {
      const loc = _index.entries.get(input.entryId);
      if (!loc) {
        return {
          kind: "not-found",
          query: input.entryId,
          hint: "Try `lookup_rule({ tag })` with a topic word ('stress', 'combat', 'world-overrides') to find the right entry id.",
        };
      }
      return {
        kind: "entry",
        entryId: input.entryId,
        title: loc.entry.title,
        markdown: renderEntry(loc.entry),
      };
    }

    if (input.tag) {
      const matches = _index.tagsByEntry.get(input.tag) ?? [];
      if (matches.length === 0) {
        // Try case-insensitive match against any tag in the rulebook
        const lower = input.tag.toLowerCase();
        for (const [t, locs] of _index.tagsByEntry) {
          if (t.toLowerCase() === lower) {
            return {
              kind: "tag-listing",
              tag: t,
              matches: locs.map((loc) => ({
                entryId: loc.entry.id,
                chapter: `${loc.chapter.number}. ${loc.chapter.title}`,
                title: loc.entry.title,
                summary: loc.entry.summary,
              })),
            };
          }
        }
        return {
          kind: "not-found",
          query: input.tag,
          hint: `No entries tagged '${input.tag}'. Available tags: ${[..._index.tagsByEntry.keys()].sort().join(", ")}.`,
        };
      }
      return {
        kind: "tag-listing",
        tag: input.tag,
        matches: matches.map((loc) => ({
          entryId: loc.entry.id,
          chapter: `${loc.chapter.number}. ${loc.chapter.title}`,
          title: loc.entry.title,
          summary: loc.entry.summary,
        })),
      };
    }

    // Schema's refine guarantees at least one is present; this is unreachable.
    return {
      kind: "not-found",
      query: "(empty)",
      hint: "Provide entryId or tag.",
    };
  },
});
