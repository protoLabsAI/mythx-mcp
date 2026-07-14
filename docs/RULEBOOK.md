<!--
  GENERATED FILE — DO NOT EDIT BY HAND.
  Source of truth: packages/rulebook/src/content/*.ts
  Regenerate:      node scripts/gen-rulebook-md.mjs
  The private→public export regenerates this on every sync.
-->
# MythxEngine Rulebook

## Chapter 1: Foundations

_Dice notation, RNG determinism, and the roll-over vs roll-under convention. Read this once and the rest of the book is just consequences._

### Dice notation (1.1-dice-notation)

_Standard `NdS+M` notation with optional ability modifier (e.g. `d20+STR`). Up to 100 dice with 100 sides; modifier is a literal or a core ability id._

Every roll in MythxEngine is written in standard dice notation: a number of dice (`N`, optional and defaulting to 1), the letter `d`, the number of sides (`S`), and an optional modifier `+M` or `-M`. The modifier may be a literal integer or one of the four core ability ids (`STR`, `AGI`, `WIT`, `CON`), which is resolved against the rolling character at evaluation time.

_Examples_
| Expression | Reading | Possible total |
| --- | --- | --- |
| `d20` | one twenty-sided die | 1 to 20 |
| `2d6` | two six-sided dice, summed | 2 to 12 |
| `1d8+3` | one d8 plus a flat 3 | 4 to 11 |
| `d6-1` | one d6 minus 1 | 0 to 5 |
| `d20+STR` | one d20 plus the roller's STR ability | varies |

> **Limits**
> Both dice count and sides are clamped to the range **1..100**. Expressions outside that range are rejected at parse time — there's no `1d10000` escape hatch.

> **Custom ability ids**
> The dice parser only recognizes the four core ability ids inline. A world that adds `SPD` or `STRESS` via the rules system can reference those abilities as test inputs, but not inside a dice-expression modifier — use a flat numeric modifier or a custom test instead.

### RNG determinism (1.2-rng-determinism)

_The same seed plus the same sequence of actions always produces the same outcome. Sessions store the RNG state on disk, so a session can be replayed bit-for-bit._

MythxEngine uses a Mulberry32 32-bit pseudo-random number generator. The RNG state is `{ seed, cursor }`: the cursor advances by one for every die rolled, and the engine stores the latest state on the session. Replaying the same actions against the same starting state produces identical outcomes — this is the determinism contract.

> **Why determinism matters**
> Determinism is what lets the GM-assist agent reason about *what should have happened* without re-rolling. It's also what makes saved-game replays exact — bug reports can be reproduced from a session file alone.

Worlds **cannot** swap the RNG algorithm. That's intentional: changing the algorithm would silently invalidate every saved session.

### Roll-under vs roll-over (1.3-roll-under)

_Default is roll-over d20 (higher beats target). Worlds can opt into roll-under (lower beats target, typically d100) — both modes use the same five-tier outcome ladder._

Most worlds use the roll-over d20 default: roll, add modifiers, succeed if `total >= difficulty`. Some genres prefer roll-under d100 (e.g. classic Mothership-style horror): roll, succeed if `total <= ability target`, with lower being better.

Both conventions feed the same five-tier outcome ladder. When `rollUnder.enabled` is true, the resolver swaps the dice expression (default `d100`) and flips the margin computation to `difficulty - total` so a positive margin still means *succeeded by that much*. The same outcome thresholds (critical / success / partial / failure) apply unchanged.

**Roll-over margin**  
`margin = total - difficulty`

**Roll-under margin**  
`margin = difficulty - total`

> **Critical ranges**
> Critical-roll detection is uniform across modes — `criticals.successOn` and `failureOn` arrays apply to the natural die regardless of comparator direction. There is no separate `criticalSuccessRange` for roll-under; configure crits the same way you would for d20.

## Chapter 2: The Five-Tier Outcome System

_Every roll resolves to one of five tiers — critical success, success, partial, failure, critical failure — based on the margin and the natural die. Critical-roll detection and margin math are the two inputs that drive the ladder._

### Outcome tiers and thresholds (2.1-outcome-tiers)

_Five tiers — `critical_success`, `success`, `partial`, `failure`, `critical_failure` — selected from the roll's margin against three thresholds, with critical naturals overriding the margin._

Every test and attack lands on one of five outcomes. The resolver computes the **margin** (see [margin math](2.3-margin-math)), then walks the threshold ladder from highest to lowest. A natural die in the configured critical-roll range can override the margin in either direction (see [criticals](2.2-criticals)).

_The ladder (defaults shown)_
| Outcome | Margin | Meaning |
| --- | --- | --- |
| `critical_success` | ≥ 10 | Full success plus a bonus effect |
| `success` | 0 to 9 | Full intended effect |
| `partial` | −4 to −1 | Yes, but… — partial effect plus a complication |
| `failure` | −5 or worse | No success; GM makes a move |
| `critical_failure` | natural in `failureOn` | Disaster; severe consequences |

> **Critical overrides**
> A natural die in `criticals.successOn` (default `[20]`) sets the outcome to `critical_success` regardless of margin when `criticals.autoSuccess` is true. The mirror rule applies for `failureOn` / `autoFailure`. Set the auto flags to `false` if you want naturals to flavor the result without overriding the threshold ladder.

> **Helpers**
> The types package exposes `isSuccessful(outcome)`, `isPartialOrWorse(outcome)`, `outcomeAllowsEffect(outcome)`, `outcomeSeverity(outcome)`, and `outcomeShouldTickClock(outcome)` so callers don't have to memorize the tiers. `outcomeShouldTickClock` is the gate used by [auto-tick on partial/failure](9.3-situation-clocks).

Both `TestResult` and `AttackResult` carry a deprecated `success` / `hit` boolean derived from `isSuccessful(outcome)` for callers that haven't migrated; new code should branch on the outcome directly.

### Critical success and critical failure (2.2-criticals)

_Natural-die ranges that can override the margin, plus the critical-hit damage multiplier. Default: nat 20 = critical success, nat 1 = critical failure, crit damage = 2×._

Critical naturals are the engine's safety valve against pure linear margin. The configuration is per-world: `successOn` and `failureOn` are arrays of natural-die values (so a world can run crits on 19–20, or skip them entirely with `[]`). When `autoSuccess` is true, a critical-success natural sets the outcome to `critical_success` regardless of margin; same for `autoFailure`.

**Critical hit damage**  
`damage × criticals.damageMultiplier`  
Where: `damage` = the attack's normal damage roll (after ability + armor); `criticals.damageMultiplier` = default 2

> **Auto-flags vs. flavor crits**
> Setting `autoSuccess: false` is how you build a world where nat 20 is just *cool* — the margin still has to clear `criticalSuccess` for the outcome to be a critical. Most worlds want auto-flags true; that's the default.

Critical-hit damage applies **before** resistance and vulnerability multipliers, not after. A critical hit on a fire-resistant target still gets multiplied first, then halved.

### Margin math (2.3-margin-math)

_Margin is the signed distance between the modified total and the target. The outcome ladder reads off margin; conditions, advantage, and ability/skill bonuses all funnel through this single number._

Margin is always a single signed integer. The full input list is the same for tests and attacks — only the target differs.

**Test margin (roll-over)**  
`margin = (natural + abilityMod + skillBonus + conditionMods + otherMods) − difficulty`  
Where: `natural` = the raw die result (after advantage/disadvantage selection); `abilityMod` = the rolling character's ability score; `skillBonus` = the rolled skill's bonus, if any; `conditionMods` = sum of `MODIFY_ABILITY` and `MODIFY_SKILL` effects from active conditions; `otherMods` = user-supplied extra modifiers (situational, items, etc.); `difficulty` = the test's target number

**Attack margin**  
`margin = (natural + abilityMod + skillBonus + conditionMods + otherMods) − defenseTarget`  
Where: `defenseTarget` = `mechanics.defense.base + defender.abilities[defense.ability]`

**Roll-under margin**  
`margin = difficulty − total`  
Where: `difficulty` = the test's target; `total` = the same modified total above

> **`otherMods` field naming**
> `TestResult.otherMods` includes condition-derived modifiers as well as user-supplied ones — the engine bundles them under one field on the result for compactness. If you need the breakdown, read `conditionMods` separately in the input log.

## Chapter 3: Position & Effect

_Position calibrates risk before the roll; effect level frames how much progress a success buys. Set both per call to drive GM-move suggestions and narrative impact._

### Position (3.1-position)

_Tri-state risk level — `controlled`, `risky`, `desperate` — set per roll. Doesn't alter margin or damage; drives consequence severity and the [GM-move matrix](10.2-move-matrix)._

Position is the single most important framing question a GM can ask before a roll: **how bad is failure here?** Setting it explicitly turns vague threat into a calibrated commitment. The engine accepts position on every test and attack and attaches it to the result; it's the [tools layer](10.3-consequence-guidance) that reads position to pick GM moves.

_The three positions_
| Position | Risk | What failure looks like |
| --- | --- | --- |
| `controlled` | Low | A safe approach. Worst case you spend a resource or learn an unwelcome truth. |
| `risky` | Standard (default) | The default stakes. Failure inflicts harm, ticks a clock, or puts someone in a spot. |
| `desperate` | High | You're past the point of safe retreat. Failure is severe — fictional flaws come into play, allies get separated. |

> **Pick before you roll**
> Position is meant to be agreed *before* dice hit the table. Renegotiating it after a bad roll defeats the purpose — that's the partial outcome's job.

> **Engine vs. tools boundary**
> The engine accepts position only as input metadata — it does not alter margin, damage, or threshold math. Position only takes effect through the tools layer, which calls `getGMMoves(outcome, position)` to suggest consequences. See the engine-vs-tools boundary note in `CLAUDE.md`.

### Effect level (3.2-effect-level)

_Tri-state impact label — `limited`, `standard`, `great` — set per roll. Currently descriptive metadata only: surfaced to the GM/agent but does not alter damage, margin, or rewards._

Effect level frames the *amount* a success buys, separate from whether it succeeds. A great-effect partial still produces meaningful change; a limited-effect critical might still leave the situation half-resolved.

_The three effect levels_
| Effect | What success buys |
| --- | --- |
| `limited` | Partial progress even on a clean success — you nudge the situation |
| `standard` | The default. Full intended result on success |
| `great` | Bonus effect on success — extra reach, extra targets, extra ground |

> **Currently descriptive only**
> Effect level is metadata: no engine code branches on it today. The descriptions above are how the GM and the AI agent should *interpret* it narratively, not how the engine alters numbers. If a future version wires effect level into damage scaling, the rule will land here.

## Chapter 4: Tests & Custom Tests

_How rolls are framed, resolved, and modified. The standard test is the engine's workhorse; custom tests let world packs define genre-specific procedures (panic, sanity); advantage and disadvantage are the universal nudge._

### Standard skill / ability test (4.1-standard-test)

_Roll a die (default `d20`) plus ability and skill modifiers, compare to the named difficulty, and return a [five-tier outcome](2.1-outcome-tiers). Difficulty names resolve through the world's `difficultyMap` first, then a hard-coded fallback._

The standard test is the engine's most-called procedure. The caller supplies a character, an optional skill, an optional ability, a difficulty (named or numeric), optional modifiers, and the [position / effect framing](3.1-position). The resolver picks the test dice from the world's rules (default `d20`), rolls with the net advantage state, sums the modifiers, computes margin, and walks the [outcome ladder](2.1-outcome-tiers).

_Test resolution_
1. Inputs: character, skill?, ability?, difficulty, modifiers, advantage state, position, effectLevel
   → step 2
2. Pick test dice via `getTestDice(rules)` (default `d20`)
   → step 3
3. Roll with advantage / disadvantage selection
   → step 4
4. total = natural + abilityMod + skillBonus + conditionMods + otherMods
   → step 5
5. margin = total − difficulty (or `difficulty − total` for roll-under)
   → step 6
6. Determine outcome from margin + critical naturals

_Default difficulty levels_
| Name | Target |
| --- | --- |
| `easy` | 8 |
| `standard` | 12 |
| `hard` | 16 |
| `extreme` | 20 |

> **Default ability**
> If a skill is provided but no ability, the skill's declared ability is used. If no skill is given either, the default ability is `WIT`. Custom numeric DCs require the dedicated `roll_custom_test` tool.

> **World difficulty overrides**
> World packs can replace or extend the difficulty list via `WorldRulesConfig.difficulties`. The tool resolves the named level through the resolved `difficultyMap` first, falling back to the hard-coded enum only when the world hasn't defined that name.

### Custom tests (4.2-custom-tests)

_World-defined test types (panic checks, sanity rolls, fear saves) with their own dice, comparator, outcomes, and optional outcome tables. Manual invocation is fully supported; the `triggers[]` array is data for a future automation system._

A custom test is a named, world-defined resolution procedure. World packs declare custom tests under `rules.customTests.tests[]`; the engine resolves them through a dedicated path that supports both roll-over and roll-under comparators, dynamic difficulty formulas, and per-outcome tables.

_Custom test schema (highlights)_
| Field | Purpose |
| --- | --- |
| `id, name, description` | Identification + display |
| `triggers[]` | Declarative trigger ids (data only — no automation today) |
| `roll.dice` | Dice expression for the test (e.g. `d100`, `2d6`) |
| `roll.ability` / `roll.underAbility` | Roll-over ability mod, OR roll-under target (lower than ability = success) |
| `roll.difficulty` / `roll.difficultyFormula` | Target as literal or formula evaluated against the character's abilities |
| `outcomes` | Effects keyed by `criticalSuccess / success / failure / criticalFailure` |
| `outcomes.*.table` | Optional outcome table — rolled after success determination, effects concatenated |
| `retryable, cooldownMinutes` | Stored but **not enforced** at runtime today |

> **Triggers don't auto-fire yet**
> Triggers like `combat_start`, `take_damage`, `witness_horror` are declarative data only. No engine code reads them at runtime — the GM or agent must invoke the custom test manually. The data is there so a future trigger system can pick it up without a schema change.

> **Roll-under tests**
> When `roll.underAbility` is set, the comparator flips to `natural ≤ abilities[underAbility]`. Useful for classic Mothership-style Stress Saves where the target is the character's stat.

Effects from the matched outcome and any rolled table entry are concatenated and returned for the tool / agent to apply. The engine does not auto-apply effects — the tool layer is responsible for translating them into character / session mutations.

### Modifiers, advantage, and disadvantage (4.3-advantage)

_5e-style best-of-two on the configured advantage dice (default `d20`). Sources cancel — net advantage decides; conditions can grant ad/dis automatically through scope-matched effects._

Advantage and disadvantage are tallied as **sources** rather than stacked bonuses. Multiple sources of advantage do not stack; one source of disadvantage cancels one of advantage. Net positive = roll twice, take higher; net negative = roll twice, take lower; net zero = single die.

**Net advantage**  
`net = (advantage sources) − (disadvantage sources)`  
Where: `net > 0` = best of two; `net < 0` = worst of two; `net = 0` = single die

> **Single-die only**
> Best-of-two only applies to a single-die test (e.g. `d20`). Multi-die expressions (`2d6+3`) and non-d20 dice are rolled normally regardless of advantage state — the dice expression already absorbs the variance.

Advantage sources can come from explicit tool input or from active conditions whose effects are `GRANT_ADVANTAGE` / `GRANT_DISADVANTAGE` with a matching scope (`attacks`, `defense`, `skill_tests`, or `all`). The resolver collects scope-matched condition effects automatically — no separate plumbing needed at the call site.

_Scope filter_
| Scope | Applies to |
| --- | --- |
| `attacks` | Attack rolls only |
| `defense` | Defender's effective defense (currently unused — defense isn't rolled) |
| `skill_tests` | `roll_test` calls |
| `all` | Every roll |

## Chapter 5: Stress & Meta-Currency

_Stress is the player's ledger of how hard they're pushing fate. Spend it to push a roll, resist a consequence, or retroactively prepare via flashback; recover it on rest; overflow it and gain trauma._

### Stress tracker, max, and trauma threshold (5.1-stress-tracker)

_Each character has `{ current, max }` stress. Spends that would push current over max trigger trauma; the engine clamps to max and surfaces a `traumaTriggered` flag the tool layer translates into a [trauma entry](5.6-trauma)._

Stress is a per-character integer ledger. The default cap is 9 (Blades-in-the-Dark style). Spends are integer costs; the engine never allows current stress to exceed max — instead, an overflow sets `traumaTriggered: true` on the result, the value is clamped, and the tools layer is responsible for appending a `Trauma` entry to the character.

**Trauma trigger**  
`traumaTriggered = (current + cost) > max`  
Where: `current` = the character's current stress before the spend; `cost` = the stress cost of the action; `max` = `StressConfig.maxStress` (default 9)

> **Engine-vs-tool split**
> The engine produces the flag; the tool layer composes the consequence. `push_roll` auto-appends a generic `Pushed Too Far` trauma name when triggered — there's no curated trauma pool today, so worlds that want flavored trauma names need to handle it at the call site.

### Push roll (5.2-push-roll)

_Spend `pushCost` stress (default 2) after a partial / failure to add `pushBonus` (default `1d6`) to the original total, recomputing the margin and outcome._

Push is the player's primary means of fighting back against a soft outcome. After seeing a partial or failure, the character commits — they spend stress to roll the push bonus and add it to the original total. The new total flows back through the [outcome ladder](2.1-outcome-tiers); a partial can become a success, a failure can become a partial.

**New total after push**  
`newTotal = originalTotal + rollDice(pushBonus)`

**New margin**  
`newMargin = originalMargin + bonusRoll`

> **Push can trigger trauma**
> Pushing while at high stress is the classic way to trigger trauma — the spend itself is what overflows the tracker. The engine clamps stress to max and returns `traumaTriggered: true`; the tool appends a generic trauma entry.

> **When to push**
> Pushing a `failure` to a `partial` still leaves you with a complication — but the partial outcome means the *effect* lands. Pushing a `partial` to `success` is the strongest spend ratio in the system: 2 stress for a clean outcome.

### Resist a consequence (5.3-resist-consequence)

_Pay 1 / 2 / 3 stress (minor / moderate / severe) to reduce a consequence's severity. Roll a d6 + ability; if the total ≥ `resistThreshold` (default 5), the cost is reduced by 1 (floor 1)._

Resist is the defensive spend. Once a consequence has landed — harm, a tick, a separated party member — the character can spend stress to reduce or sometimes negate it. The base cost depends on the severity the GM declared; a successful resist roll buys back one stress point.

_Default severity costs_
| Severity | Base cost |
| --- | --- |
| `minor` | 1 stress |
| `moderate` | 2 stress |
| `severe` | 3 stress |

**Resist roll**  
`total = d6 + abilityMod`

**Final cost**  
`finalCost = max(1, baseCost − (total ≥ resistThreshold ? 1 : 0))`

> **What you reduce, narratively**
> Resisting a `moderate` to a `minor` means the GM should re-frame the consequence: the harm is shallower, the clock ticks fewer stages, the spotlight fades. The engine doesn't model this transformation — only the stress cost — so the GM owns the narrative downgrade.

### Flashback (5.4-flashback)

_Spend `flashbackCost` stress (default 2) to retroactively justify a prepared action. Mechanical effect is the stress spend only — the flashback is a narrative hook, not a roll modifier._

Flashback is the cheapest narrative spend in the game: 2 stress to declare that *of course* the character had paid the bartender for information last week, *of course* the rope was already tied to the gargoyle. The engine deducts the stress and returns a `traumaTriggered` flag if it overflows; everything else is fiction.

> **Use sparingly, not retroactively rewriting outcomes**
> Flashback shouldn't undo a roll that already resolved badly. Use it to set up a *new* situation with prep that wasn't called out in the moment — the stress cost is the price of bypassing setup.

### Stress recovery (rest) (5.5-rest)

_Short rest recovers `recoveryPerShortRest` stress (default 2); long rest recovers `recoveryPerLongRest` (default `"all"`, i.e. resets to 0). The `take_rest` tool also restores HP and clears `until_rest` conditions._

Rest is the only way stress comes back. The engine exposes two rest types — `short` and `long` — and the tool layer adds a `camp` variant that's a synonym for a long rest with full HP and 12 hours of game time.

_Default rest table_
| Rest type | Stress recovered | HP recovered | Time elapsed |
| --- | --- | --- | --- |
| `short` | 2 | 25% | 1 hour |
| `long` | all | 50% | 8 hours |
| `camp` | all | 100% | 12 hours |

> **Conditions**
> Long and camp rests clear all conditions whose duration is `until_rest` (see [stacking](7.3-stacking)). Permanent conditions and numeric-duration conditions persist.

### Trauma (5.6-trauma)

_When a stress spend would exceed max, the engine clamps to max and surfaces `traumaTriggered: true`. The tool layer appends a `Trauma` entry to the character — a permanent narrative consequence with no enforced mechanical effect._

Trauma is the system's hard ceiling on stress as a fungible resource. Once trauma fires, the character is changed — and the GM is expected to honor that change in fiction. The engine doesn't enforce mechanical penalties; trauma is a permanent narrative tag.

> **Auto-generated names**
> Tools that fire trauma (push, resist, flashback) currently append a generic name like `Pushed Too Far` to the character's `trauma[]` array. There's no curated list and no world-pack hook to seed trauma options — flavoring it is on the GM / agent.

Trauma entries are stable per character: `{ id, name, description, acquiredAt }`. They're displayed alongside the character sheet but never branched on by combat or test resolution.

## Chapter 6: Combat

_Initiative orders the round; attacks are tests against a defense target; damage applies after the outcome lands. Conditions feed into all three stages — the rest is the same five-tier outcome ladder._

### Initiative (6.1-initiative)

_Each combatant rolls `d20 + initiative ability`; sort descending, ties broken by raw ability score. The world's resolved abilities decide which one is the initiative ability via the `usage.initiative` flag (default `AGI`)._

Initiative is rolled once at the start of combat. The resolver walks the world's resolved abilities and picks the first one whose `usage.initiative` flag is `true`; if none is flagged, it falls back to `AGI`. Ties break on raw ability score — characters who tied on the roll resolve in the order their initiative ability ranks them.

**Initiative total**  
`total = d20 + abilities[initiativeAbility]`

> **World override**
> Worlds with custom ability sets can flag a different ability for initiative — e.g. a sci-fi world where `SPD` drives reaction time. The flag lives on the ability definition, not in `mechanics`, because it's an ability-set concern.

> **No surprise / ambush rules**
> There is no built-in surprise round or group-initiative model. Surprise narratively translates to a free action before initiative, or to a `desperate` position on the first round — the GM owns the framing.

### Attack resolution (6.2-attack-resolution)

_An attack is a test against a defense target. Roll `d20 + ability + skillBonus + mods`, compare to `defense.base + defender.abilities[defense.ability]`, then apply [damage](6.3-damage) keyed on the [outcome tier](2.1-outcome-tiers)._

Attack resolution mirrors the [standard test](4.1-standard-test) — same advantage handling, same modifier sum, same outcome ladder — but compares against a defense target instead of a difficulty.

**Defense target**  
`defenseTarget = mechanics.defense.base + defender.abilities[defense.ability]`  
Where: `mechanics.defense.base` = default 10; `defense.ability` = default AGI

**Attack margin**  
`margin = (natural + abilityMod + combatSkillBonus + conditionMods + otherMods) − defenseTarget`

_Outcome → damage mapping_
| Outcome | Hit? | Damage applied |
| --- | --- | --- |
| `critical_success` | yes | Full damage × `criticals.damageMultiplier` (default 2×) |
| `success` | yes | Full damage |
| `partial` | graze (`hit: false`, legacy) | `floor(baseDamage × grazeMultiplier)` (default 50%) |
| `failure` | no | 0 |
| `critical_failure` | no | 0 |

> **Resistance and vulnerability**
> Damage type (default `physical`) is matched against active conditions of type `RESISTANCE` and `VULNERABILITY`. Matching pairs cancel; one without the other applies the world's `resistanceMultiplier` (0.5) or `vulnerabilityMultiplier` (2.0) before reaching the defender.

> **`hit: false` on partial is legacy**
> `AttackResult.hit` reports `false` on a partial outcome even though graze damage applies. Branch on `outcome` instead — `partial` means the strike landed but cost something.

### Damage calculation (6.3-damage)

_`damage = max(minimumDamage, rollDice(weapon.damage) + ability − armor)`, with each addend toggleable via `mechanics.damage`. Armor is sourced from defender fields in a fixed precedence._

**Damage**  
`damage = max(minimumDamage, rollDice(weapon.damage) + (addAbility ? abilityMod : 0) − (subtractArmor ? armor : 0))`  
Where: `weapon.damage` = the weapon's damage expression (e.g. `1d8`); `abilityMod` = the attacker's relevant ability score; `armor` = the defender's armor value (see precedence below); `addAbility` = default true; `subtractArmor` = default true; `minimumDamage` = default 0

_Armor source precedence_
| Order | Source | Notes |
| --- | --- | --- |
| 1 | `defender.armor` | Numeric — used by Enemy and modern Character shape |
| 2 | `Character.equipment.armorValue` | Numeric on the legacy equipment object |
| 3 | Parse `+(\d+)` from `Character.equipment.armor` string | e.g. `"chain mail +3"` → 3 |
| 4 | 0 | Fall-through default |

> **Itemized armor is not piped through**
> Combat reads `Character.equipment.armor` (the legacy field), **not** `Character.inventory.equipped`. If a character has armor in their itemized inventory but nothing in legacy equipment, the combat resolver will see armor 0. See [equipment modes](8.1-inventory-modes).

> **Critical hit interaction**
> Critical-hit multiplication happens *before* resistance / vulnerability multiplication and *before* armor subtraction is reapplied — armor is subtracted once, on the raw damage roll, not after the crit multiplier.

### Conditions in combat (6.4-conditions-in-combat)

_Combat reads three families of [condition effects](7.1-condition-shape): `MODIFY_SKILL` with `skillId === "combat"` adjusts the attack roll; `GRANT_ADVANTAGE`/`GRANT_DISADVANTAGE` with matching scope adjusts the dice; `RESISTANCE`/`VULNERABILITY` adjusts damage by type._

The engine treats conditions as a side-channel input to combat — the call site doesn't enumerate effects, the resolver does. This keeps combat tools dumb (just attacker, target, weapon) while still honoring the fictional state.

_Combat-consumed condition effects_
| Effect type | Where it applies | Filter |
| --- | --- | --- |
| `MODIFY_SKILL` | Attack roll modifier | `skillId === "combat"` |
| `MODIFY_ABILITY` | Attack roll modifier | Matching ability id |
| `GRANT_ADVANTAGE` | Attack dice (best of two) | Scope `attacks` or `all` |
| `GRANT_DISADVANTAGE` | Attack dice (worst of two) | Scope `attacks` or `all` |
| `RESISTANCE` | Damage applied | Matching `damageType` |
| `VULNERABILITY` | Damage applied | Matching `damageType` |

> **Defense effects are dead**
> `MODIFY_DEFENSE` was pruned from the `Effect` union when the audit consolidated dead effect types. Defense math reads only the raw ability score plus base — there's no condition-driven defense modifier today.

### Combat lifecycle (tool layer) (6.5-combat-lifecycle)

_`start_combat` → `roll_initiative` → repeated `attack` / `apply_damage` / `next_turn` → `end_combat`. State lives on `SessionState.combat = { active, round, turnOrder, currentTurnId, turnIndex }`._

The tools layer wraps the engine with a state machine. `start_combat` accepts inline enemy definitions; weapons are parsed via [parseWeaponString](8.2-weapon-parsing). `roll_initiative` mutates `combat.turnOrder` to the sorted result and sets `round = 1, turnIndex = 0`. `next_turn` advances the turn index, looping to the next round when it overflows. `end_combat` clears the combat state and emits a final outcome event.

> **No round economy**
> There's no built-in concept of action / bonus action / reaction — a turn is whatever the GM lets a combatant do before calling `next_turn`. Movement and range are similarly narrative-only; there's no grid or zone model.

## Chapter 7: Conditions

_Conditions are tagged, durational state attached to a character or enemy. The engine reads them automatically during tests and combat; world packs supply additional conditions on top of the built-in catalog._

### Condition shape (7.1-condition-shape)

_A condition is `{ id, name, description, duration, effects[], stackable, expiresAtGameTime? }`. Six effect kinds are consumed by the engine; the rest are intent-carriers for the agent / tools._

Every condition carries a small set of typed effects. The engine reads them during test and combat resolution; the tools layer reads the rest as intent for narrative steps (e.g. `NARRATIVE` shows a flavor string).

_Duration model_
| Duration | Meaning |
| --- | --- |
| `number` | Round-based — decrements via `tickConditionDurations()` |
| `"permanent"` | Never expires unless explicitly removed |
| `"until_rest"` | Cleared on long / camp rest by `clearRestConditions()` |
| (plus `expiresAtGameTime`) | Optional `GameTime` deadline — checked by `advance_time` |

_Effect kinds (engine-consumed)_
| Effect | Where consumed | Filter |
| --- | --- | --- |
| `MODIFY_ABILITY` | Test / attack rolls | Matching ability id |
| `MODIFY_SKILL` | Test / attack rolls | Matching skill id |
| `GRANT_ADVANTAGE` | Test / attack rolls | Matching scope (`attacks`, `defense`, `skill_tests`, `all`) |
| `GRANT_DISADVANTAGE` | Test / attack rolls | Matching scope |
| `RESISTANCE` | Damage applied | Matching `damageType` |
| `VULNERABILITY` | Damage applied | Matching `damageType` |

> **Pruned effects**
> Earlier drafts of the schema declared `MODIFY_HP`, `MODIFY_DEFENSE`, `ADD_CONDITION`, `REMOVE_CONDITION`, `SET_FLAG`, `DEAL_DAMAGE`, `HEAL`, `NARRATIVE` as effect types. None had engine consumers; they were pruned during the rulebook-prep consolidation. If a future feature needs them, add the consumer first, the schema entry second.

### Common conditions (7.2-common-conditions)

_Ten built-in conditions baked into the types package: `WOUNDED`, `STUNNED`, `FRIGHTENED`, `INSPIRED`, `BLESSED`, `CURSED`, `HIDDEN`, `FIRE_RESISTANT`, `FIRE_VULNERABLE`, `PRONE`. Worlds supply additional conditions via `WorldContentPack.conditions`._

_Built-in catalog_
| Id | Effect summary |
| --- | --- |
| `WOUNDED` | Disadvantage on physical actions until rested |
| `STUNNED` | Disadvantage on all rolls; short numeric duration |
| `FRIGHTENED` | Disadvantage on rolls against the source of fear |
| `INSPIRED` | Advantage on the next skill test |
| `BLESSED` | Advantage on rolls; numeric duration |
| `CURSED` | Disadvantage on rolls; permanent until cleansed |
| `HIDDEN` | Advantage on attacks; lost on first attack made |
| `FIRE_RESISTANT` | Resistance to `fire` damage |
| `FIRE_VULNERABLE` | Vulnerability to `fire` damage |
| `PRONE` | Disadvantage on melee defense, advantage to melee attackers |

> **World additions**
> World packs add their own conditions through `WorldContentPack.conditions`. Worlds-schema conditions now use the same `EffectSchema[]` and runtime duration model as the built-in catalog, so a world condition can be applied to a character at runtime with no translation step.

### Stacking (7.3-stacking)

_Non-stackable conditions refuse re-add when an instance with the same id is active. Stackable conditions append unbounded. `removeCondition` drops the first matching instance; `removeAllConditionsById` clears every instance._

_Add / remove behavior_
| Operation | Stackable: false | Stackable: true |
| --- | --- | --- |
| `addCondition` (no existing) | Added | Added |
| `addCondition` (existing of same id) | Refused — `added: false` | Appended |
| `removeCondition` | First match removed | First match removed |
| `removeAllConditionsById` | All instances removed | All instances removed |

> **No bounded stacks**
> `stackable: true` means unbounded — there's no "stacks of N up to a cap" semantics. If a world needs capped stacking, the tool layer has to enforce it before calling `addCondition`.

### Time-based expiration (7.4-time-expiration)

_`condition.expiresAtGameTime` triggers expiration when `compareGameTime(currentTime, expiresAtGameTime) >= 0`. Round-based numeric durations require explicit `tickConditionDurations()` calls._

Conditions can expire on three different signals: round count (numeric duration, ticked manually), rest (cleared by `clearRestConditions()`), or wall-clock game time (checked by `advance_time`). The three are independent — a condition can declare any one or none.

> **`advance_time` integration**
> When `advance_time` rolls forward, it walks every character and enemy, drops conditions whose `expiresAtGameTime` has passed, and returns them in the result's `expiredConditions` array so the GM / agent can narrate the change.

## Chapter 8: Equipment & Gear

_Equipment can be held in narrative-string mode or in fully-itemized mode. The combat resolver currently reads the legacy narrative path; the itemized model is a display-layer model with weight, slots, and rarity._

### Narrative vs itemized inventory (8.1-inventory-modes)

_`CharacterInventory.mode = "narrative" | "itemized"`. Narrative mode is free-text strings (`weapons[]: string`, `armor: string`); itemized mode is `Item` objects with an 8-slot equipment loadout, gold, and weight._

_Narrative vs itemized at a glance_
| Aspect | Narrative | Itemized |
| --- | --- | --- |
| Weapon storage | `weapons[]: string` (e.g. `"longsword (1d8, STR)"`) | `Item` objects with full schema |
| Armor storage | `armor: string`, optional `armorValue` | Slotted `armor` items |
| Equipped slots | Implicit | 8 slots (see below) |
| Gold / weight | Optional | Always present |
| Combat reads from | Legacy `Character.equipment` | Same legacy field (drift) |

_Equipment slots (itemized)_
| Slot | Slot |
| --- | --- |
| `mainHand` | `offHand` |
| `head` | `body` |
| `hands` | `feet` |
| `accessory1` | `accessory2` |

> **Itemized inventory and combat are not connected**
> Combat reads `Character.equipment.armor` (the legacy narrative field), not `Character.inventory.equipped`. If you put a `+3 chain mail` item in the body slot but leave the legacy field empty, combat sees armor 0. The itemized model is a display-layer model today.

### Weapon parsing (8.2-weapon-parsing)

_`parseWeaponString("Name (props)")` extracts a damage expression and ability from the property list using world-overridable keyword tables (`mechanics.equipmentParsing`)._

Weapon strings are the bridge between narrative inventory and combat. The parser scans the parenthesized property list for: a dice expression (first token matching the dice regex), an ability keyword (against `abilityKeywords`), and a ranged keyword (against `rangedKeywords`). Anything not found falls back to the world's defaults.

_Default fantasy keyword tables_
| Setting | Default |
| --- | --- |
| `rangedKeywords` | `["ranged", "thrown", "bow", "crossbow", "sling"]` |
| `abilityKeywords` | `{ str: STR, agi: AGI, dex: AGI, wit: WIT, con: CON, strength: STR, agility: AGI, dexterity: AGI }` |
| `defaultMeleeAbility` | `STR` |
| `defaultRangedAbility` | `AGI` |
| `defaultDamage` | `d4` |

> **Sci-fi or non-English worlds**
> Worlds with a different lexicon — sci-fi (`pulse`, `plasma`, `laser`), non-English worlds, or different ability sets — should override `mechanics.equipmentParsing`. The parser threads through `getWeaponParseOptions(rules)` so the same string parses differently per world.

### Item rarity, types, and modifiers (8.3-items)

_Items carry `rarity, type, statModifiers[], damageType?`. The taxonomy enums are TypeScript literal unions; none of the itemized model's stat modifiers, damage types, or weapon categories are read by the combat engine today._

_Enums_
| Enum | Values |
| --- | --- |
| `ItemRarity` | `common, uncommon, rare, epic, legendary` |
| `ItemType` | `weapon, armor, consumable, key, quest, misc, material, accessory` |
| `ItemStatModifier.type` | `flat, percent` |
| Damage types | `physical, fire, ice, lightning, poison, holy, dark` |

> **The itemized model is display-only**
> Stat modifiers, item-level damage types, and weapon categories on `Item` are not consumed by the combat resolver — `Weapon` (the runtime type) carries no damage-type field and is parsed from the legacy narrative string. The itemized inventory exists for UI and shop / loot logic; it doesn't change combat math.

### Encumbrance (8.4-encumbrance)

_Optional `weight: { current, max }` with status thresholds: `light ≤ 0.33`, `normal ≤ 0.66`, `heavy ≤ 1.0`, else `overloaded`. Not enforced mechanically — no movement or check penalty._

_Encumbrance bands_
| Status | Ratio (current / max) |
| --- | --- |
| `light` | ≤ 0.33 |
| `normal` | ≤ 0.66 |
| `heavy` | ≤ 1.0 |
| `overloaded` | > 1.0 |

> **Display only**
> The status string is computed and surfaced for UI, but no engine code branches on it — there's no movement penalty, no check disadvantage hook. If a world wants encumbrance to bite, the tool layer has to enforce it.

## Chapter 9: Time, Clocks & Deadlines

_Game time is a `{ day, hour, minute }` integer triple advancing by minutes. Deadlines fire when game time passes them; situation clocks advance by named stages, manually or via auto-tick on bad outcomes._

### Game time model (9.1-game-time)

_`GameTime = { day, hour, minute }` advancing by minutes. Initial time is `{ day: 1, hour: 6, minute: 0 }` — day 1, dawn. All time helpers (`gameTimeToMinutes`, `compareGameTime`, `minutesUntil`, `formatDuration`, `advanceGameTime`) live in the engine._

Game time is integer-only — there are no fractional minutes. `advanceGameTime(time, minutes)` rolls minute → hour → day correctly; `gameTimeToMinutes` flattens to a single integer for comparisons (using the `(day - 1) × MINUTES_PER_DAY` convention so `{ day: 1, hour: 0, minute: 0 }` is the canonical epoch).

**Time as minutes**  
`minutes = (day − 1) × 1440 + hour × 60 + minute`

> **Initial time**
> `createInitialGameTime()` returns `{ day: 1, hour: 6, minute: 0 }` — sessions start at dawn on day 1. Worlds wanting a different start can override after creation; nothing in the engine forces dawn.

### Deadlines (9.2-deadlines)

_`Deadline = { id, name, description, expiresAt, onExpireFlag?, warnOnApproach }`. `advance_time` fires expired deadlines (sets the flag, removes from list) and warns on any deadline within 60 minutes if `warnOnApproach`._

Deadlines are wall-clock pressure: a flag is set when game time passes the configured `expiresAt` `GameTime`. The tool layer's `advance_time` is the single firing site — it walks the deadline list, removes anything that's expired, and sets the optional flag on the session.

> **Use `warnOnApproach` for heads-up beats**
> Setting `warnOnApproach: true` lets the GM / agent surface a soft warning when the deadline is within 60 minutes of game time. Useful for visible countdowns — the bell that rings before the hour, the ritual that completes at midnight.

### Situation clocks (9.3-situation-clocks)

_Named-stage countdowns. `start_situation_clock` instantiates an `ActiveClock`; `tick_clock` advances by one stage; `roll_test` and `attack` accept `autoTickClockIds[]` and auto-tick on partial-or-worse outcomes (via [outcomeShouldTickClock](2.1-outcome-tiers))._

Situation clocks are the engine's pressure-cooker mechanic. A clock is defined on a world-pack `situations[].clock` with named stages, each carrying consequences (`setFlags`, `removeFlags`, optional narrative). At runtime, `start_situation_clock` instantiates an `ActiveClock` on `SessionState.activeClocks` with `currentStage = 0` and `paused = false`.

_Tick sources_
| Source | When |
| --- | --- |
| `tick_clock` tool | Manual GM tick (e.g. a scene transition) |
| `roll_test` / `attack` `autoTickClockIds` | Auto-fires on `partial`, `failure`, `critical_failure` per [outcomeShouldTickClock](2.1-outcome-tiers) |
| `tick_clock` from a [GM move](10.1-gm-moves-catalog) | Move-driven tick (`tick_clock`) |

> **Final stage = doom**
> When a tick advances the clock past its final stage, the engine removes it from `activeClocks` and emits a `doom` event. The clock's terminal consequences (flags) apply on that final tick — there's no separate "after doom" phase.

> **Pause / resume**
> `pause_clock` and `resume_clock` toggle the `paused` flag without altering the stage. A paused clock is skipped by auto-tick — useful when the situation moves out of focus.

## Chapter 10: GM Moves & Consequences

_Ten named GM moves keyed against the position × outcome matrix. The tools layer composes consequence-guidance text from the matched moves; everything in this chapter is GM-facing tooling, not player-facing rules._

### GM move catalog (10.1-gm-moves-catalog)

_Ten fixed moves: `reveal_unwelcome_truth`, `show_signs_of_doom`, `offer_hard_bargain`, `tick_clock`, `separate_party`, `put_someone_in_spot`, `use_their_flaw`, `drain_resources`, `turn_move_against_them`, `inflict_harm`._

_The ten moves_
| Move | Use it to… |
| --- | --- |
| `reveal_unwelcome_truth` | Surface a fact the players didn't want — a betrayal, a hidden cost, a consequence already in motion |
| `show_signs_of_doom` | Make a coming threat visible — a darkening sky, a distant horn, a clock tick |
| `offer_hard_bargain` | Offer success at a price — a stress hit, a relationship cost, a moral compromise |
| `tick_clock` | Advance a [situation clock](9.3-situation-clocks) one stage |
| `separate_party` | Split allies — the bridge collapses, a wall falls between, the fog descends |
| `put_someone_in_spot` | Force a specific character into a hard choice — usually one they're worst-equipped for |
| `use_their_flaw` | Make the character's declared flaw matter right now |
| `drain_resources` | Spend a consumable, break a tool, deplete a stat that wasn't on the line |
| `turn_move_against_them` | Their action backfires — the spell hits the wrong target, the lie ensnares the speaker |
| `inflict_harm` | Deal damage / a condition; severity scales with [position](3.1-position) |

> **Why these ten**
> The list is small on purpose. Ten moves cover the space of "what the world does when the players fail" without forcing the GM to invent a new consequence each time. The names are mnemonic, not literal — `inflict_harm` covers stress as readily as HP.

### Position × outcome matrix (10.2-move-matrix)

_`getGMMoves(outcome, position)` returns the suggested move list, or `undefined` when the outcome doesn't warrant moves. Only `partial`, `failure`, and `critical_failure` have entries._

The matrix is the engine's stock answer to *what now?*. Each cell suggests a small set of moves the GM (or the AI agent) can pick from. Critical successes and clean successes never trigger moves — those outcomes resolve cleanly.

_Position × outcome → moves_
| Position | Partial | Failure | Critical failure |
| --- | --- | --- | --- |
| `controlled` | drain_resources, reveal_unwelcome_truth | show_signs_of_doom, offer_hard_bargain | tick_clock, separate_party |
| `risky` | inflict_harm, drain_resources, offer_hard_bargain | inflict_harm, put_someone_in_spot, tick_clock | inflict_harm, use_their_flaw, separate_party |
| `desperate` | inflict_harm, tick_clock | inflict_harm, use_their_flaw, show_signs_of_doom | inflict_harm, turn_move_against_them, tick_clock |

> **Read it as severity scaling**
> Across a row, severity rises as the outcome worsens; down a column, severity rises as position worsens. `inflict_harm` shows up everywhere risky-or-worse because risky-or-worse means *something visible should happen to a character.*

> **Helpers**
> `getGMMoves(outcome, position)` returns `undefined` for outcomes that don't warrant moves — the gate is inside the helper, not at each call site. `buildConsequenceGuidance(outcome, position, outcomeLabel)` and `getConsequenceSeverity(position)` compose the user-facing text.

### Consequence-guidance composition (10.3-consequence-guidance)

_On `partial`, `failure`, or `critical_failure`, the test and attack tools compose a one-line `consequenceGuidance` from the outcome description, the position-derived severity, and the first two suggested moves. Composition is centralized in `buildConsequenceGuidance()`._

Consequence guidance is the single sentence the GM / agent reads to know *what kind of consequence fits*. It's deliberately short — a hint, not a script — so the narrator can flavor it. Composition lives in `types/game/gm-moves.ts` so the test and attack tools both call the same helper.

**Severity**  
`getConsequenceSeverity(position) ∈ {minor, moderate, severe}`  
Where: `controlled` = minor; `risky` = moderate; `desperate` = severe

> **Two-move limit**
> Only the first two suggested moves are surfaced in the guidance line — more would be noisy. The full list is still on `TestResult.suggestedMoves` / `AttackResult.suggestedMoves` for callers that want it.

## Chapter 11: World-Specific Overrides

_What `WorldRulesConfig` lets a world tune — abilities, difficulties, mechanics, custom tests — and what's intentionally fixed (position labels, GM moves, time math). Every entry in earlier chapters with `extensibility: world-overridable` lands here._

### What a world can override (11.1-world-overrides)

_World packs tune the engine through `WorldRulesConfig`: abilities, difficulties, mechanics (defense / damage / criticals / roll-under / advantage / outcome thresholds / stress / equipment parsing), and custom tests. Position labels, GM moves, and time math are intentionally fixed._

Every entry in this rulebook tagged `extensibility: world-overridable` points to a path under `WorldRulesConfig`. The table below is the consolidated map — see the linked entry for what each knob controls.

_Tunable knobs_
| Knob (configPath) | What it controls | See |
| --- | --- | --- |
| `abilities` | Replace / add / override the ability set | [6.1 initiative](6.1-initiative) |
| `difficulties` | Replace / add named difficulty levels | [4.1 standard test](4.1-standard-test) |
| `mechanics.defense` | Defense base + ability | [6.2 attack resolution](6.2-attack-resolution) |
| `mechanics.damage` | Add ability / subtract armor / minimum / graze multiplier | [6.3 damage](6.3-damage) |
| `mechanics.criticals` | Crit ranges + multiplier + auto flags | [2.2 criticals](2.2-criticals) |
| `mechanics.rollUnder` | Roll-under enable + dice | [1.3 roll-under](1.3-roll-under) |
| `mechanics.advantage.dice` | Dice for best-of-two | [4.3 advantage](4.3-advantage) |
| `mechanics.outcomeThresholds` | Margin thresholds for the five-tier ladder | [2.1 outcome tiers](2.1-outcome-tiers) |
| `mechanics.resistanceMultiplier` / `vulnerabilityMultiplier` | Default damage multipliers | [6.2 attack resolution](6.2-attack-resolution) |
| `mechanics.stressConfig` | Max / push / resist / flashback / rest costs | [5.1 stress tracker](5.1-stress-tracker) |
| `mechanics.equipmentParsing` | Ranged / ability keyword tables and defaults | [8.2 weapon parsing](8.2-weapon-parsing) |
| `customTests.tests[]` | World-defined test types (panic, sanity) | [4.2 custom tests](4.2-custom-tests) |

> **Resolution model**
> World rules are merged into a `ResolvedRules` value at session start via `resolveRules()`. Defaults fill anything the world didn't set; the resolver is pure and deterministic. Entries in this rulebook quote `configPath` against the resolved shape so the rulebook test suite can verify the path resolves.

### What's intentionally fixed (11.2-fixed-surfaces)

_Position / effect labels, the GM move catalog and matrix, the common-condition catalog, trauma names, itemized inventory enums, encumbrance thresholds, and time math are all fixed. Each is a deliberate non-knob._

_Fixed surfaces and the reason_
| Surface | Why fixed |
| --- | --- |
| Position labels (`controlled` / `risky` / `desperate`) | Baked into the type system as a string-literal union — every consumer would have to change |
| Effect labels (`limited` / `standard` / `great`) | Same — and they're descriptive metadata anyway |
| GM move catalog and matrix | Small fixed vocabulary is the point — worlds re-flavor, they don't extend |
| Common conditions catalog | Type-system const map; worlds **add** conditions via content packs |
| Trauma name pool | No curated pool exists yet; tools auto-name |
| Itemized inventory enums (rarity, type, damage type) | TS literal unions; not in `WorldRulesConfig` |
| Encumbrance thresholds | TS constants; not enforced mechanically anyway |
| Game time math (minutes / hours / days) | Determinism-adjacent — changing it would invalidate saved sessions |
| RNG algorithm (Mulberry32) | [Determinism contract](1.2-rng-determinism) — never world-overridable |

> **Custom-test trigger automation**
> Custom-test `triggers[]` declares trigger ids (`combat_start`, `take_damage`, etc.) but no engine code reads them at runtime. The data is stored; the automation isn't built. Manual invocation is the only path that works today.

## Chapter 12: Runtime GM Support

_Tools that help the GM (or AI agent) run the game without inventing new mechanics: leads, clocks, scene framing, investigation, NPC relationships, GM guidance. They read session state and produce advice; they do not alter dice or outcomes._

### Runtime GM support — overview (12.1-runtime-gm-support)

_A workflow layer that operates on session state and produces narrative guidance. Includes leads/clues, portable clues, NPC relationships, GM guidance, scene framing, encounter generation, investigation tracking, and engagement hooks. Not modeled as overrideable rules._

The tools in this chapter don't introduce new mechanics — they read session state, the world pack, and the recent action log, and produce structured advice. They live outside `WorldRulesConfig` because they don't compute outcomes; they help frame the *next* outcome by surfacing pacing, NPC attitude, available leads, and so on.

_Runtime support domains_
| Domain | Tool dir | What it does |
| --- | --- | --- |
| Leads / clues | `tools/src/leads/` | Three Clue Rule support — query / reveal / search lead state |
| Portable clues | `tools/src/portable-clues/` | Flexible revelation packaging that isn't tied to a specific lead node |
| NPC relationships | `tools/src/relationships/` | Attitude + knowledge tracking for named NPCs |
| GM guidance | `tools/src/gm-guidance/` | Five context-aware modes: stuck, resolution, pacing, tone, npc |
| Scene framing | `tools/src/scene-framing/` | Pacing analysis, scene cuts, scene framing |
| Encounter generation | `tools/src/encounters/` | Pulls balanced encounters from the world pack on demand |
| Investigation board | `tools/src/investigation/` | Evidence / hypothesis / null-result tracking for mysteries |
| Engagement hooks | `tools/src/engagement/` | Personalize content, package as items, fragment into discoveries |

> **Why these aren't in the rules config**
> World packs already control the *content* these tools operate on (leads live in situations, NPCs in the NPC catalog, encounters in encounter sets). The behavior of each tool is fixed glue between session state and that content — there's no per-world knob to tune.

> **Read the tool surface, not this chapter, for details**
> Each tool's input / output is documented in `CLAUDE.md` and in the `tools/src/<domain>/` source. This chapter is the index — not a re-statement of every parameter.
---

_This rulebook is generated from `packages/rulebook` — the same structured
content the engine serves at runtime through the `lookup_rule` and
`generate_rulebook` tools. For how the engine fits together, see
[engine.md](./engine.md); for running a game, see the
[agent-kit](../agent-kit/)._
