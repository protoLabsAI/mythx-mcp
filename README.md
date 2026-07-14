# MythxEngine — tabletop RPG engine over MCP

[![CI](https://github.com/protoLabsAI/mythx-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/protoLabsAI/mythx-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@mythxengine/mcp-server?label=npm)](https://www.npmjs.com/package/@mythxengine/mcp-server)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D22.13-brightgreen)](#install)

A complete tabletop RPG engine your AI can run: deterministic dice, five-tier
outcomes, FitD-style stress, combat tracking, situation clocks, investigations,
NPC relationships, world generation — 134 tools over the
[Model Context Protocol](https://modelcontextprotocol.io), with **four complete
starter worlds** bundled in.

Claude (or any MCP client) becomes your Game Master. The engine keeps the
rules honest: same seed + same actions = same outcome.

## Install

### Claude Code — plugin (skills + tools, recommended)

```
/plugin marketplace add protoLabsAI/mythx-mcp
/plugin install rpg@mythx-plugins
```

One install delivers the MCP server plus play skills (`/rpg:play`,
`/rpg:combat-mode`, `/rpg:world-building-mode`, …).

### Claude Code — tools only

```bash
claude mcp add rpg -- npx -y @mythxengine/mcp-server
```

Requires Node >= 22.13.

### Claude Desktop

Download `mythxengine-<version>.mcpb` from the
[latest release](https://github.com/protoLabsAI/mythx-mcp/releases/latest) and
drag it into **Settings → Extensions**. No other setup — Claude Desktop ships
its own Node runtime.

## Five-minute walkthrough

Everything below is one conversation with Claude after installing. Four worlds
are imported on first run — Port Miriam (harbor noir), Aethelgard (mythic
frontier), Threshold Deep (weird depths), and the Treehouse Anthology.

**1. Pick a world, make a character.**

> Start a session in Port Miriam. I want to play a dockside fixer who owes the
> wrong people money.

The GM calls `create_session`, `load_world_summary`, and `create_character` —
your fixer gets HP, stress, gear, and a spot in the world's faction web.

**2. Roll with real stakes.** Every test is framed with position (how bad is
failure?) and effect (how much does success buy?):

> I try to slip past the harbor patrol to reach the smuggler's skiff.

```
roll_test → risky position / standard effect → 11 vs 13: partial
"Yes, but..." — you reach the skiff, and a lantern swings your way.
GM move suggested: put_someone_in_spot
```

Five outcomes — critical success, success, partial, failure, critical
failure — and on a bad roll you can `push_roll` (spend 2 stress for +1d6) or
`resist_consequence` to buy the severity down. Stress is a real currency;
overflow means trauma.

**3. Fight a combat round.**

> Two dockhands block the gangway. I draw my hook-knife.

`start_combat` → `roll_initiative` → `attack` — initiative order, armor,
conditions, and damage all tracked; every attack returns the same five-tier
outcome with suggested GM moves on a miss.

**4. Watch a clock tick.** The patrol you dodged? The GM started a
`harbor-alert` clock. Fail forward enough times (`tick_clock` fires
automatically on partials/failures when wired) and the dock lights come on —
consequences arrive on schedule, not by fiat.

That's the loop: fiction in, mechanics out, consequences on clocks.

## What's in the box

| Piece                                    | What it gives you                                                  |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `packages/mcp-server`                    | The MCP server — 134 tools, published as `@mythxengine/mcp-server` |
| `packages/engine`                        | Pure, seeded game mechanics (dice, outcomes, combat)               |
| `packages/types` / `worlds` / `rulebook` | Zod-validated schemas for every entity, plus rules lookup          |
| `packages/storage`                       | SQLite persistence (`node:sqlite`, zero native deps)               |
| `packages/tools` / `prompts`             | Transport-agnostic tool implementations + runtime GM skills        |
| `world-builder/`                         | The `rpg` Claude Code plugin (skills, agents, hooks)               |
| `agent-kit/`                             | Portable GM system prompt + operating manual for **any** agent     |
| `docs/`                                  | The [rulebook](./docs/RULEBOOK.md) + [how the engine works](./docs/engine.md) |
| 4 bundled worlds                         | ~13 MB of NPCs, factions, locations, situations, arcs — the demo   |

## Rules & docs

- **[docs/RULEBOOK.md](./docs/RULEBOOK.md)** — the complete rules, all 12
  chapters (outcomes, position & effect, tests, stress, combat, conditions,
  gear, time & clocks, GM moves). Generated from `packages/rulebook`, the same
  source the `lookup_rule` and `generate_rulebook` tools serve — so it never
  drifts from the engine.
- **[docs/engine.md](./docs/engine.md)** — how the engine works: the five-tier
  outcome system, position & effect, stress, deterministic RNG, and how the
  packages fit together.
- **[agent-kit/](./agent-kit/)** — a portable GM system prompt and operating
  manual for running a game with any agent.

## Want the full experience?

This repo is the engine. **MythxEngine Desktop** is the game: a visual
frame-based play surface, scene imagery, generated world books, and
polish. Follow along and get notified when it ships at
[mythxengine.com](https://mythxengine.com).

## Development

```bash
pnpm install
pnpm build && pnpm test && pnpm lint && pnpm typecheck
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) — this repo is a downstream mirror of
a private monorepo; issues are the fastest way to get fixes in.

## License

[MIT](./LICENSE) © protoLabs Studio
