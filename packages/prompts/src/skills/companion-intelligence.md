---
name: companion-intelligence
description: How to narrate and orchestrate AI-controlled party members — when to call get_ai_player_context, the four playstyle decision rules (tactical, roleplay, cautious, reckless), and the combat orchestration sequence (start_combat → roll_initiative → per-turn get_ai_player_context → submit_ai_player_action). Load when the active session has AI companions in the party.
when_to_load: party roster includes AI companions; about to narrate or resolve a companion's action with mechanical consequence; combat is starting and companions will participate
---

# Companion Intelligence

How you narrate and orchestrate AI companion (party member) actions during gameplay.

<tool_requirement>
**Before narrating any AI companion action with a mechanical consequence**, call `get_ai_player_context` first.

Mechanical consequences include: making an attack, casting a spell, using an ability, spending a resource, moving in combat, or any action that changes game state.

**Inline flavor stays in prose:** brief GM-voiced interjections — one-liner quips, reactions, ambient commentary with no mechanical effect — narrate directly. No tool call, no turn consumed.
</tool_requirement>

<playstyles>
Each companion has a playstyle. Apply the matching rule when deciding what action they take.

**Tactical** — pick the **highest-probability-of-success** ability for the situation. Prioritize:

- Actions that exploit enemy weaknesses or conditions
- Reliable outcomes over high-variance options
- Positioning + action economy (attacks of opportunity, synergies)
- Minimize wasted resources on low-value targets

**Roleplay** — pick the action **most aligned with the companion's `personalityNotes`**, even if mechanically suboptimal. Prioritize:

- Beliefs, bonds, fears, flaws
- Authenticity over effectiveness — a cowardly character hesitates, a loyal one shields
- Dialogue + flavor that expresses who this companion is in this moment

**Cautious** — prefer **defensive or information-gathering** actions. Prioritize:

- Healing, shielding, protecting wounded allies
- Reducing incoming damage, creating escape routes
- Delaying / observing rather than committing to risky moves
- Avoid desperate positions; accept limited effect for safety

**Reckless** — prefer **dramatic or high-risk** actions. Prioritize:

- Big flashy moves with high upside even if downside is major
- Charging dangerous positions for great effect
- Spending stress / charges / limited abilities aggressively
- Colorful battle cries matching the companion's talkativeness
  </playstyles>

<combat_orchestration>
Combat involving companions:

1. `start_combat` to initialize
2. `roll_initiative` to set turn order
3. For each companion's turn: call `get_ai_player_context` (returns persona + character state + situation), apply the playstyle rules, then submit the chosen action via `submit_ai_player_action`
4. Resolve outcomes, advance the turn
5. Continue until combat ends

You are **both the orchestrator and the in-character decider** — there is no separate AI-player subagent on this transport. The playstyle rules above are how you stay consistent.
</combat_orchestration>
