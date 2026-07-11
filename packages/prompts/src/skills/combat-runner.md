---
name: combat-runner
description: Tool-flow playbook for running combat encounters — when combat triggers, the start_combat → roll_initiative → attack → next_turn → end_combat sequence, position/effect calibration, autoTickClockIds, and the diegetic-narration rules for outcomes. Load when the player engages hostile contact, names tactical parameters (position/effect/target), or any combatant rolls into a multi-round encounter.
when_to_load: hostile contact established (enemies ready weapons, charge, attack, or the player closes with them); player names mechanical parameters (position, effect, attack target, weapon); a single-round skirmish escalates into multi-round combat
---

# Combat Runner

The tool flow for running a combat encounter from first hostile contact through resolution. Always route mechanical resolution through these tools — narrating attacks without rolling lets fights drift into shadow-puppet theater where the dice never speak.

<routing>
**First decision — pick the right entry point.** Read the situation, then route:

| Situation                                                                       | Tool                                          |
| ------------------------------------------------------------------------------- | --------------------------------------------- |
| Hostile contact, multi-round encounter likely (enemies present, player engages) | **`start_combat`** → roll_initiative → attack |
| Mid-encounter swing (combat.active is true)                                     | **`attack`**                                  |
| Mid-encounter direct damage (post-attack splash, area effect)                   | **`apply_damage`**                            |
| Environmental, trap, fall, poison, GM fiat — no enemy attacking                 | **`damage_character`**                        |
| Single-roll non-combat check (lockpick, persuade, sneak past)                   | **`roll_test`**                               |

**Hostile contact ≠ environmental damage.** If a creature is dealing the damage and there's any chance of a back-and-forth, the path is `start_combat` first — even on the very first swing. `damage_character` is for damage that has no attacker (a trap fires, the floor gives way, the poison ticks). The moment an enemy is the source, the encounter is open.
</routing>

<combat_flow>
**Trigger:** the player engages hostile contact OR names a tactical parameter that only makes sense as combat. Examples that fire the flow:

- "I draw my sword and charge the scout."
- "Three goblins ready their weapons." (then any forward action)
- "I attack with effect=great." / "Roll my attack, risky position."
- "I cast firebolt at the warrior."

Single-roll skirmishes (one swing to break a door open, one shot to scare a deer) stay in `roll_test`. The moment two or more rounds of back-and-forth are likely, run the full flow below.

**Flow:**

1. **`start_combat`** — open the encounter. Use `enemies: [{ id, name, hp, attacks }]` to create inline enemies on the fly; world-pack enemies can be passed via `enemyIds`. Always include every PC in `characterIds`.
2. **`roll_initiative`** — sets turn order and round=1. Required before the first `attack`.
3. **`attack`** — resolves a single swing/shot. Returns a five-tier outcome with mechanical detail in `result` and follow-up moves in `suggested_next`.
4. **`next_turn`** — advances the round when the current combatant's beat is done.
5. **`end_combat`** — closes the encounter with `outcome: "victory" | "defeat" | "fled"`.

</combat_flow>

<inline_enemies>
For ad-hoc encounters (ambushes, random patrols, scripted NPCs that suddenly turn hostile), create enemies inline at `start_combat` time rather than pre-creating them. Inline shape:

```ts
start_combat({
  sessionId,
  characterIds: ["pc-hero"],
  enemies: [
    { id: "goblin-scout-1", name: "Goblin Scout", hp: 8, attacks: ["Shortbow (1d6)"] },
    { id: "goblin-warrior-1", name: "Goblin Warrior", hp: 14, attacks: ["Scimitar (1d8)"] },
    { id: "goblin-brute-1", name: "Goblin Brute", hp: 22, attacks: ["Greatclub (2d6)"] },
  ],
});
```

Attack strings parse `Name (damage)` automatically. Inline enemies are written to session state; subsequent `attack` calls reference them by ID.
</inline_enemies>

<position_and_effect>
Both `attack` and `roll_test` take `position` (risk level) and `effectLevel` (impact). Match them to the moment:

| Position          | When                                            |
| ----------------- | ----------------------------------------------- |
| `controlled`      | Safe approach, prepared, defender unaware       |
| `risky` (default) | Standard stakes — most attacks                  |
| `desperate`       | Heavy danger — outnumbered, wounded, no retreat |

| Effect               | When                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `limited`            | Partial leverage — weapon mismatch, awkward angle, half-cover          |
| `standard` (default) | Standard impact                                                        |
| `great`              | Strong leverage — flanking, surprise, ideal weapon, exploited weakness |

When the player names a parameter explicitly ("desperate position", "great effect", "I caught them by surprise"), honor it. When the player describes the situation diegetically ("I've got the high ground"), translate to the closest fit.
</position_and_effect>

<auto_tick_clocks>
Pass `autoTickClockIds: [clockId, ...]` on `attack` or `roll_test` to advance situation clocks on `partial` / `failure` outcomes. The result's `state_delta.clocks_ticked` reports what advanced; narrate the consequence inline.

Use auto-tick for:

- A pursuit clock during a running fight ("the patrol's closing")
- A reinforcements clock when the noise of combat draws more enemies
- An NPC-death clock when a captive is bleeding out during the fight

</auto_tick_clocks>

<outcome_narration>
`attack` and `roll_test` return a five-tier outcome. The summary is diegetic by design — never recite raw dice, damage numbers, or HP totals in chat. Translate to fiction.

| Outcome            | Headline                       | Narrate                                                          |
| ------------------ | ------------------------------ | ---------------------------------------------------------------- |
| `critical_success` | Clean overwhelming hit + bonus | Decisive blow, opening for next move                             |
| `success`          | Clean hit                      | Solid landing, defender feels it                                 |
| `partial`          | Grazing / mixed                | Hit but cost: position lost, weapon caught, an opening given     |
| `failure`          | Miss, situation shifts         | Pick a GM move from `suggested_next.gm_moves`                    |
| `critical_failure` | Disaster                       | Severe consequence: weapon damaged, prone, second enemy steps in |

On `partial` / `failure`, `suggested_next.gm_moves` lists position-appropriate moves. Pick one and weave it into the narration so the failure moves the fiction forward.
</outcome_narration>

<non_combat_damage>
`damage_character({ characterId, amount, reason })` is for damage with no enemy attacker — traps, falls, poison ticks, environmental hazards (fire/cold/lava), GM fiat. Pass `reason` so the narration reads true. Any damage from an enemy goes through the combat flow above (start_combat → attack), not here.
</non_combat_damage>

<rules>
- **Route every combat swing through `attack`** — even when the player describes the outcome they want, the dice decide impact. Narrating an attack without rolling collapses the mechanical layer.
- **Open the encounter with `start_combat`** — any time two or more rounds of back-and-forth are likely, open the encounter formally so HP, turn order, conditions, and clocks all advance in sync.
- **Route narrative damage through `damage_character`** — traps, falls, poison, environmental hazards. `attack` is for combat swings, `apply_damage` is for combat-target effects.
- **Round through `next_turn`** — the round counter, turn order, and condition durations all key off it. The active combatant is `session.combat.currentTurnId`.
- **Close with `end_combat`** — passing `outcome` records the result and clears `session.combat` so the party can rest / loot / continue.
- **One scene-frame at combat boundaries** — `frame_scene` once at combat start (or load `image-generation` if the encounter deserves a fresh scene image), once at end. Mid-fight scene images interrupt action.
- **Stress mechanics live alongside** — `push_roll`, `resist_consequence`, `flashback` all apply during combat. Document the spend in narration.
</rules>
