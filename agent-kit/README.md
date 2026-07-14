# MythxEngine Agent Kit

The MythxEngine MCP server gives an agent the *tools* to run a tabletop RPG —
deterministic dice, five-tier outcomes, stress, combat, clocks, persisted
sessions. This kit gives it the *judgment* to use them well.

It is three plain Markdown files, portable to **any** agent that can hold a
system prompt and call MCP tools — not just Claude Code:

| File | What it is | How to use it |
| --- | --- | --- |
| [`SYSTEM-PROMPT.md`](./SYSTEM-PROMPT.md) | The Game Master persona + the full rules framework (position/effect, five-tier outcomes, GM moves, stress, combat, status line, boundaries). | Paste it into your agent's system prompt. |
| [`RECOMMENDATIONS.md`](./RECOMMENDATIONS.md) | The operating manual: the turn-to-turn play loop, which tool to call when, worldbuilding flow, companions, common pitfalls. | Keep it alongside as the runbook; hand it to a planning step, or fold the highlights into your prompt. |
| this `README.md` | Orientation. | You're reading it. |

## Quick start

1. Connect the MythxEngine MCP server to your agent — see the
   [repository README](../README.md) for install paths (Claude Code plugin,
   `npx @mythxengine/mcp-server`, or the Claude Desktop `.mcpb` bundle).
2. Put the contents of [`SYSTEM-PROMPT.md`](./SYSTEM-PROMPT.md) into your agent's
   system prompt.
3. Start playing. Tell the GM to create a world and a character, or to resume an
   existing session.

## A note on tool names

Every tool is named bare here — `roll_test`, `load_session`, `start_combat`.
Your host may surface them under a prefix (`mcp__rpg__roll_test`,
`mythx__roll_test`) or as plain function names. The names in these files
identify *which* tool; use whatever call form your runtime provides.

## If you're on Claude Code or Cowork

You don't need to assemble this by hand. The [`world-builder/`](../world-builder)
plugin at the repo root wires the same playbook as native Claude Code
**skills** (slash commands like `/play`, `/combat-mode`, `/world-building-mode`)
and **subagents** (an AI party member, content and book generators, a
method-acting roleplay specialist, a spoiler-safe player researcher), plus
session hooks. Install it via the marketplace — see the repository README's
"Claude Code — plugin" section. This kit is the transport-neutral distillation
of that plugin for everyone else.

## Where the rules live

These files are process and judgment. The canonical *rules* — exact difficulty
numbers, outcome margins, stress costs, condition effects — are machine-readable
in [`packages/rulebook`](../packages/rulebook) and reachable at runtime through
the `lookup_rule` and `generate_rulebook` tools. When a ruling matters, ask the
engine; it is the source of truth.
