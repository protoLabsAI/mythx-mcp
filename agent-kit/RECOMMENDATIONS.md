# Running MythxEngine well — an operating manual

The tools give your agent a deterministic tabletop engine. This is how to
*use* them to run a good game. Pair it with
[`SYSTEM-PROMPT.md`](./SYSTEM-PROMPT.md) (the persona + rules) — that sets who
the GM is; this sets what it does turn to turn.

Tool names are bare (`roll_test`, `load_session`, …); your host may prefix them.

## The core loop

Every turn of play is the same shape:

1. **Frame the scene.** Where they are, what they perceive, who is present.
   Land it in a paragraph, not a page — all five senses, one beat.
2. **Offer a decision.** End on what is at stake and 2–4 concrete options, with
   room for "something else." The player always chooses; you never choose for
   them.
3. **Resolve the action.**
   - No risk, within reach → narrate it, no roll.
   - Impossible / against the rules → narrate why, no roll.
   - Uncertain with real stakes → **set position and effect, say what failure
     costs, then `roll_test`.**
4. **Narrate the outcome by tier.** critical_success / success / partial /
   failure / critical_failure each read differently. On partial or failure,
   apply a GM move — fail forward, never dead-end.
5. **Write state back.** HP via `damage_character` / `heal_character`,
   conditions via `apply_condition` / `remove_condition`, stress via the stress
   tools, clocks via `tick_clock`, time via `advance_time`. The engine's numbers
   are the truth.
6. **Log what mattered** with `add_note`, and close the beat with a status line.

Then repeat. The player acts; the world answers; the engine remembers.

## Session start (cold resume)

Sessions persist. Assume you remember nothing and reload:

```
1. list_sessions / load_session   — pull the session state
2. get_time                       — current time + active deadlines
3. get_character                  — HP, conditions, stress, inventory
4. get_active_clocks              — what is ticking
5. search_notes "last session"    — what happened before
6. "When we last left off…"       — recap in-fiction, then describe the scene
7. "What do you do?"
```

If there is no session yet, create one (`create_session`), pick or generate a
world, and build the player character together at "session zero": a want, a
flaw, and a reason to be here.

## What to call, when

| The player… | Reach for |
| --- | --- |
| attempts something uncertain | `roll_test` (set position + effect first) |
| makes a plain die roll (damage, a table) | `roll_dice` |
| wants a bonus after a bad roll | `push_roll` (2 stress → +1d6) |
| wants to soften a consequence | `resist_consequence` (1–3 stress) |
| wants to have prepared for this | `flashback` (2 stress) |
| starts a fight | `start_combat` → `roll_initiative` → `attack` / `next_turn` |
| rests | `take_rest` (recovers HP/stress, advances time, can clear conditions) |
| investigates a mystery | `start_investigation`, then `add_evidence` per find |
| shops | `browse_shop` → `buy_item` / `sell_item` |
| talks to an NPC at length | `start_dialogue` / `advance_dialogue` |
| moves to a new place | `set_party_location` (must exist in the world pack) |
| references an established fact | `load_world_summary`, `get_location`, `get_npc`, … |

When you are unsure which rule applies, `lookup_rule` returns the printed text.
When pacing feels off or you are stuck, `get_gm_guidance` gives contextual
advice.

## Position, effect, and stakes

Setting stakes *before* the roll is the single highest-leverage habit.

- **Position** is how bad failure is: controlled (minor), risky (moderate,
  default), desperate (severe).
- **Effect** is how much success gets you: limited (partial), standard (full,
  default), great (bonus).
- Say the cost out loud in the fiction before the dice land: "if you slip, the
  guard hears you." Then the result — whatever the dice say — feels earned, not
  arbitrary.

A partial is the workhorse outcome: the player gets what they wanted *and* a
complication. Lean into it.

## Clocks make the world move

A situation clock is a countdown you can see coming. Use them for anything that
should progress whether or not the player engages it — an alarm being raised, a
ritual completing, reinforcements arriving.

- Start one with `start_situation_clock`.
- Advance on partials/failures: pass `autoTickClockIds` to `roll_test` /
  `attack`, or call `tick_clock`.
- Keep a threat clock **hidden** until the fiction exposes it, then
  `reveal_clock` so it shows on the player's HUD.
- `check_clock_triggers` tells you when a clock has filled and its effect fires.

Telegraph danger honestly: dread comes from watching the clock fill, not from a
gotcha.

## Companions (AI party members)

When the player wants company, add AI party members:

1. `create_player` with `controlType: "ai"` and a distinct persona.
2. `create_character` to match, then `assign_character`.
3. In structured scenes, run rounds with `start_turns` / `advance_turn`.

Load the `companion-intelligence` playbook once per session (`load_skill`)
before running them. A companion decides from **its own** context
(`get_ai_player_context`) and acts in its own voice — companions disagree,
banter, and make their own mistakes. They never solve the player's problem for
them, and they never act on the player's declared intent before the player does.
Weave the whole round into one narration beat, not one beat per companion.

## Building a world

If world-generation tools are available and the player wants a fresh setting,
work the pipeline and keep them in the loop with a one-paragraph pitch at each
stage — never a data dump:

```
seed → archetypes → factions → locations → NPCs → monsters
     → items → encounters → situations → arcs → assemble → validate
```

`validate_world_pack` before you play in it. For an existing pack, prefer the
compact `load_world_summary` (a GM reference) over the full pack, and pull
individual entities on demand (`get_location`, `get_npc`, `get_monster`, …).

## Going deeper

Load a focused runtime playbook with `load_skill` when a scene calls for it:

- **`combat-runner`** — tight combat pacing and enemy tactics.
- **`companion-intelligence`** — running AI party members well.
- **`engine-flows`** — the canonical tool sequences for each situation.
- **`image-generation`** — scene art, when your host supports it.
- **`player-interaction`** — eliciting and honoring player choice.

## Common pitfalls

- **Rolling for everything.** Most actions don't need a roll. Roll only when the
  outcome is uncertain *and* failure is interesting.
- **Narrating around the dice.** If the engine said `failure`, it failed. Make
  the failure a door, not a wall — but don't quietly upgrade it.
- **Forgetting to write state back.** An HP change you narrate but don't record
  desyncs the engine from the fiction. Every mechanical change goes through a
  tool.
- **Spotlight theft.** NPCs and companions support the story; they don't win it.
- **Trauma as a shrug.** Trauma is a headline moment. Give it weight, or don't
  trigger it.
- **Inventing established facts.** Check the world pack before you make something
  up about a place, person, or item that already exists.

## Where the rules actually live

This kit is judgment and process. The *rules* — exact DCs, outcome margins,
stress costs, condition effects — are machine-readable in the engine and
reachable at runtime through `lookup_rule` (by id or tag) and
`generate_rulebook`. When in doubt, ask the engine; it is the source of truth.
