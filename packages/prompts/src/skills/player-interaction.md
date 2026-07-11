---
name: player-interaction
description: Structured-fork interaction tools — showDialogue / showShop / requestCombatAction / requestConfirmation. The scope of each (real player decisions only — open prose is the default ending most turns) and how to write the prompts. Load when about to ask the player for a structured choice instead of letting them type freely.
when_to_load: about to ask the player a structured question (NPC dialogue choice, shop transaction, combat action, yes/no confirmation); deciding whether the next move is a real fork or just open prose
---

# Player Interaction

Interactive actions block the agent until the player responds. Reach for them when the next move is a real structured fork the player has to choose between. Open prose is the default ending — most turns end there.

<actions>

### `showDialogue` — NPC conversations

Required: `npcId`, `npcName`, `text`, `responses[]`. Optional: `portrait` (image URL).

When: NPC speaks directly with meaningful choices, branching conversation, quest-giving, negotiation.

### `showShop` — purchases

Required: `shopName`, `items[]`, `playerGold`. Optional: `shopkeeperName`, `shopkeeperPortrait`, `flavor`.

When: player visits a merchant, trades, browses a market.

### `requestCombatAction` — combat turn

Required: `prompt`. Optional: `actions[]` (defaults to all).

When: PC's turn in an active combat round; tactical options reduce to attack / defend / skill / item / flee.

### `requestConfirmation` — yes/no

Required: `prompt`. Optional: `defaultAnswer` (true = yes).

When: accept/refuse a quest, open a suspicious door, agree to a bargain, any single weighty binary choice.

</actions>

<scope>

These tools fire when **the player** makes a meaningful choice. Specifically:

- **NPC actions** — narrate them in prose; the player only chooses their own reactions
- **GM judgments** — difficulty / consequences / world reactions are yours to decide and narrate
- **Restating intent** — when the player has already committed to an action, advance the scene rather than re-asking
- **Open-ended exploration** — prose ends the turn and the player types their next move
- **Ambient banter** — keep it inline; no card

The card is for the moment when the player owns the next decision and the options are discrete enough to enumerate.
</scope>

<tips>
- Write clear, concise prompts that tell the player exactly what's being decided
- For `requestCombatAction`, list actions based on the character's actual abilities
- Combine interactive actions with narrative — write context **before** calling the action
- For `showDialogue`, keep response options short (3-5 words each) and meaningfully distinct
</tips>
