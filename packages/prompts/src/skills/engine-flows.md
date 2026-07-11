---
name: engine-flows
description: Tool-flow playbooks for shop, rest, dialogue, and image generation — when each flow triggers, the exact tool sequence, the response-handling table, and the in-chat narration rules. Load when the player initiates buying/selling, requests a rest, an NPC enters a structured conversation, or you're about to render visuals.
when_to_load: player approaches a merchant or says "buy/sell"; player says "rest" / party HP critical; named NPC starts a structured conversation; about to call generate_scene_image / generate_portrait / generate_item_art
---

# Engine Flows

Dedicated tool flows for shopping, resting, dialogue, and image generation. Always use these tools instead of narrating the mechanics in plain chat.

<shop_flow>
**Trigger:** player says "I want to buy", "let's check the shop", approaches a merchant NPC, or an NPC with `narrativeRole: "merchant"` is in the scene. Wait for explicit purchase intent — casual item mentions stay in prose.

**Flow:**

1. `browse_shop` — fetches inventory; pass `npcId` (merchant) or `locationId`
2. `showShop` — opens UI with buy/sell tabs; pass shop items + player inventory
3. `buy_item` — when player response has `action: "buy"`
4. `sell_item` — when player response has `action: "sell"`

`InventoryChangeCard` auto-renders from `buy_item` / `sell_item` outputs.

**Pass player inventory for selling:**

```
showShop({
  shopName, shopkeeperName, items,
  playerGold: character.inventory.gold,
  playerInventory: character.inventory.items.map(item => ({
    inventoryItemId: item.id,
    name: item.name,
    description: item.description,
    sellPrice: Math.max(1, Math.floor(item.value / 2)),
    quantity: item.quantity,
    category: item.type,
    rarity: item.rarity,
    equipped: isEquipped(item.id, character.inventory.equipped)
  }))
})
```

**Player response handling:**

| Action  | Do                               |
| ------- | -------------------------------- |
| `buy`   | `buy_item({ itemId })`           |
| `sell`  | `sell_item({ inventoryItemId })` |
| `leave` | Return to dialogue or open prose |

</shop_flow>

<rest_flow>
**Trigger:** player says "let's rest" / "make camp" / "take a break", party HP critically low after combat ends, end of a major story beat, requested time skip. In unsafe locations, narrate the risk first and confirm before calling the tool.

**Tool:** `take_rest({ restType })`. Auto-advances time, recovers HP/stress, clears conditions per the table:

| Rest type | Duration | HP recovered | Stress recovered | Conditions cleared |
| --------- | -------- | ------------ | ---------------- | ------------------ |
| Short     | 1 hour   | 25% max HP   | 1                | None               |
| Long      | 8 hours  | 50% max HP   | 2                | Minor              |
| Camp      | 12 hours | 100% max HP  | All              | All                |

`RestResultCard` auto-renders from the `take_rest` output. Continue narrative after the call.
</rest_flow>

<dialogue_flow>
For NPC conversations expecting a structured reply, use `showDialogue`:

```
showDialogue({
  npcId: "npc-dalla",
  npcName: "Dalla",
  portrait: "...",  // image URL from generate_portrait, optional
  text: "You don't get to walk in here and tell me what's safe.",
  responses: [
    "We're not here to argue. Let us through.",
    "You've been right before. What do you see?",
    "Who put you in charge of this gate?"
  ]
})
```

**Scope of `showDialogue`:** structured NPC turns with 2-4 distinct response options. Open-ended scenes end in prose (the player types); combat decisions go through `requestCombatAction`; a single weighted yes/no goes through `requestConfirmation`; ambient banter stays in inline prose.

**Multi-turn conversations:** call `showDialogue` again with new text + responses for each NPC turn. Each call pauses the agent until the player picks.

**Connecting to shop:** when a merchant's dialogue leads to shopping, call `showShop` with the merchant's inventory directly.
</dialogue_flow>

<image_flow>
Image generation is fast (~0.5s). Generate, then immediately display.

**Pattern — generate → show (two calls, same turn):**

```
// Scene image
const result = generate_scene_image({ sessionId, locationId })
if (result.imageUrl) showSceneImage({ imageUrl: result.imageUrl, caption: "...", entityName: "..." })

// Portrait
const result = generate_portrait({ sessionId, npcId })
if (result.imageUrl) showPortrait({ imageUrl: result.imageUrl, caption: "...", entityName: "..." })

// Item
const result = generate_item_art({ sessionId, itemId })
if (result.imageUrl) showItemArt({ imageUrl: result.imageUrl, caption: "...", entityName: "..." })
```

**Important:** only call the show tool when `result.imageUrl` exists. If image gen fails (timeout, service down), the tool returns without `imageUrl` — skip the show call silently and continue narrating.

**Generate for:**

- First visit to a significant location
- First meeting with a named NPC
- Discovery of rare+ / quest items
- Dramatic scene transitions (between encounters, not during them)
- Opening scene of a new session

Skip image generation for repeat locations, minor / background NPCs, common items (rations, rope, torches), and active combat — keep that beat in prose so the action flows.

</image_flow>

<rules>
- **Route purchases through `buy_item` / `sell_item`** — they post the inventory delta and render the card
- **Route HP/stress recovery through `take_rest`** — it advances time, applies recovery, renders the card
- **Write narrative prose to transition** back to the story after a flow completes
- **Open prose still ends turns** — flows resolve a structured moment, the next move can still end open
- **Keep transitions smooth** — narrate before triggering the flow tool
</rules>
