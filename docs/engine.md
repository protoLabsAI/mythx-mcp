# How the engine works

MythxEngine is a deterministic tabletop RPG engine exposed over the
[Model Context Protocol](https://modelcontextprotocol.io). An AI agent calls
the tools; the engine keeps the rules honest. This page explains the moving
parts. For the full rules text see [RULEBOOK.md](./RULEBOOK.md); for running a
game see the [agent-kit](../agent-kit/).

## Design principles

- **Deterministic core.** All randomness flows through a seeded RNG
  (Mulberry32). The same seed plus the same actions always produces the same
  outcome — rolls are reproducible, and a session can be replayed exactly.
- **Pure game logic.** The `engine` package has no I/O: state in, state out. It
  computes mechanics (hit/miss, damage, outcome tier) and nothing else, which
  makes it fully unit-testable and reusable across transports.
- **Types at the boundary.** Every entity is a Zod schema. Input is validated
  where it enters; invalid data is rejected, not tolerated.
- **The engine owns the numbers.** HP, stress, conditions, clocks, and time are
  the engine's state. The agent narrates; the engine decides. A mechanical
  outcome the agent didn't roll doesn't exist.

## The five-tier outcome system

Every test and attack resolves to one of five tiers, based on how the roll's
total compares to the difficulty (the *margin*), plus natural 1s and 20s:

| Outcome              | When                    | Result                                |
| -------------------- | ----------------------- | ------------------------------------- |
| **critical_success** | margin ≥ 10, or natural 20 | Full success + a bonus effect       |
| **success**          | margin ≥ 0              | The intended effect                   |
| **partial**          | margin −4 to −1         | "Yes, but…" — the effect and a complication |
| **failure**          | margin < −4             | No success; the GM makes a move       |
| **critical_failure** | natural 1               | Disaster; severe consequences         |

The partial is the workhorse: success *and* a cost. This is what keeps failure
from dead-ending the story — something always happens.

## Position & effect

Stakes are set **before** the roll, not discovered after it:

- **Position** — how bad failure is: `controlled` (minor), `risky` (moderate,
  the default), `desperate` (severe).
- **Effect** — how much success buys: `limited` (partial progress), `standard`
  (full, the default), `great` (bonus effects).

On a partial or failure the engine suggests **GM moves** scaled to the
position (inflict harm, tick a clock, offer a hard bargain, and so on), so the
consequence fits the stakes that were declared.

## Stress

Characters carry **stress** (default max 9) as a meta-currency:

- **Push** — after a failure or partial, spend 2 stress for a +1d6 bonus.
- **Resist** — spend 1–3 stress (by severity) to reduce or avoid a consequence.
- **Flashback** — spend 2 stress to establish retroactive preparation.

When stress exceeds the max, the character takes **trauma** — a narrative
consequence, meant to be a real story beat rather than a number.

## Clocks

Situation clocks are visible countdowns for anything that should advance
whether or not the player engages it — an alarm being raised, a ritual
completing, reinforcements arriving. They tick on partials and failures (a roll
can auto-tick a named clock), stay hidden until the fiction exposes them, and
fire an effect when full.

## How the pieces fit

The engine is a small, layered monorepo. Each layer depends only on the ones
above it:

```
types      Zod schemas for every entity (dice, characters, outcomes, worlds)
  ↑
engine     pure, seeded mechanics — no I/O
  ↑
tools      transport-agnostic tool implementations (business logic + GM support)
  ↑
mcp-server the MCP surface — adapts the shared tools to the protocol
```

Alongside those:

- **rulebook** — the structured, machine-readable rules (12 chapters). It is
  the canonical rules specification, served at runtime through the
  `lookup_rule` and `generate_rulebook` tools and rendered to
  [RULEBOOK.md](./RULEBOOK.md).
- **worlds** — world-pack schemas and the bundled starter settings.
- **storage** — file/SQLite persistence for sessions and world packs.
- **prompts** — the runtime GM skill playbooks served by `load_skill`.

The strict layering is deliberate: mechanics stay pure in `engine`, while GM
judgment (deriving moves, framing consequences) lives in `tools`. That keeps
the core reusable and the rules in one place.

## Tiered world access

World packs can be large. Rather than force the whole pack into context, the
engine exposes it in tiers: a compact **summary** (a GM quick-reference), the
**full pack**, and **on-demand lookups** for individual entities
(`get_location`, `get_npc`, `get_monster`, …). An agent pulls only what the
current scene needs.

## Where to go next

- **[RULEBOOK.md](./RULEBOOK.md)** — the complete rules, generated from the
  rulebook package.
- **[agent-kit/](../agent-kit/)** — a portable GM system prompt and operating
  manual for running a game with any agent.
- **[README](../README.md)** — install paths and a five-minute walkthrough.
