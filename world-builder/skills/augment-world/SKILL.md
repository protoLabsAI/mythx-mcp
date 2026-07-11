---
name: augment-world
description: Add new content to an existing world pack. Batch add monsters, NPCs, items, locations, and encounters.
argument-hint: <world-pack-id> (optional)
allowed-tools:
  - Task
  - AskUserQuestion
  - Glob
  - Read
  - Write
  - mcp__rpg__list_world_packs
  - mcp__rpg__load_world_summary
  - mcp__rpg__start_augmentation
  - mcp__rpg__merge_augmentation
  - mcp__rpg__get_archetype
  - mcp__rpg__get_location
  - mcp__rpg__get_npc
  - mcp__rpg__get_monster
  - mcp__rpg__get_item
  - mcp__rpg__get_encounter
---

# World Augmentation Flow

Guide users through adding new content to existing world packs.

---

## Phase 1: Select World Pack

If no pack ID provided as argument:

1. Call `mcp__rpg__list_world_packs()` to get available packs
2. Use `AskUserQuestion` to let user pick:

```
header: "World Pack"
question: "Which world do you want to add content to?"
options:
  - label: "<pack.name>"
    description: "<pack.tagline> - <counts summary>"
  ... for each pack
```

If pack ID provided, load it directly.

---

## Phase 2: Load World Context

1. Call `mcp__rpg__load_world_summary({ packId })` to get current state
2. Display current content counts:

```
Current Content in <world name>:
- Archetypes: X
- Monsters: X
- Items: X
- NPCs: X
- Locations: X
- Encounters: X
```

---

## Phase 3: Gather Requirements

Use `AskUserQuestion` to understand what user wants:

### Step 1: Content Types
```
header: "Content Types"
question: "What do you want to add? (select all that apply)"
multiSelect: true
options:
  - label: "Monsters"
    description: "Enemies, creatures, threats"
  - label: "Items"
    description: "Weapons, armor, consumables, special items"
  - label: "NPCs"
    description: "Named characters, merchants, allies, villains"
  - label: "Locations"
    description: "New places to explore"
  - label: "Encounters"
    description: "Combat, social, or event encounters"
  - label: "Archetypes"
    description: "New playable character classes"
```

### Step 2: Quantities
For each selected type, ask:
```
header: "Monsters"
question: "How many monsters do you want to add?"
options:
  - label: "1-2"
    description: "A specific threat or pair"
  - label: "3-5"
    description: "A small faction or group"
  - label: "6-10"
    description: "A full bestiary expansion"
```

### Step 3: Theme (Optional)
```
header: "Theme"
question: "Is there a theme or focus for this content?"
options:
  - label: "No specific theme"
    description: "General content fitting the world"
  - label: "Location-based"
    description: "Content for a specific area"
  - label: "Faction-based"
    description: "Content tied to a group or organization"
  - label: "Custom theme"
    description: "Describe your own focus"
```

If location-based, show existing locations to choose from.
If custom, prompt for description.

---

## Phase 4: Generate Content

1. Call `mcp__rpg__start_augmentation` with the gathered request:

```
mcp__rpg__start_augmentation({
  packId: "<id>",
  request: {
    monsters: 3,
    items: 5,
    npcs: 2,
    encounters: 2
  },
  theme: "ice-themed dungeon",
  locationContext: "location:frozen-caverns"
})
```

2. The tool returns prompts for each content type.

3. For each prompt, launch a content-generator agent in PARALLEL:

```
Task(subagent_type: "rpg:content-generator",
     prompt: "Generate augmentation content. Pack: <packId>. Type: monsters.

              SYSTEM:
              <prompt.system>

              USER:
              <prompt.user>

              Output the JSON directly. Do not wrap in markdown.",
     run_in_background: false)
```

**IMPORTANT:** Launch ALL generators in a SINGLE message to run in parallel.

4. Collect results from all generators.

---

## Phase 5: Review Content

Present generated content for review:

```
Generated Content:

MONSTERS (3):
- Frost Wraith (elite) - Spectral ice elemental
- Ice Spider (standard) - Giant crystalline arachnid
- Snow Stalker (minion) - Pack hunting predator

ITEMS (5):
- Frostbite Blade (weapon) - Deals cold damage
- Glacier Shield (armor) - +2 armor, cold resistance
- ...

NPCs (2):
- Eira the Ice Witch - Exiled mage seeking redemption
- Jorik Coldblood - Barbarian guide who knows the caves

ENCOUNTERS (2):
- Ambush at the Ice Bridge - Combat with Snow Stalkers
- The Frozen Bargain - Social with Eira
```

Ask for confirmation:
```
header: "Confirm"
question: "Add this content to the world pack?"
options:
  - label: "Yes, add all"
    description: "Merge everything into the world"
  - label: "Regenerate"
    description: "Try again with different results"
  - label: "Cancel"
    description: "Don't add anything"
```

---

## Phase 6: Merge Content

1. Call `mcp__rpg__merge_augmentation` with all generated content:

```
mcp__rpg__merge_augmentation({
  packId: "<id>",
  content: {
    monsters: [...],
    items: [...],
    npcs: [...],
    encounters: [...]
  },
  autoLink: true
})
```

2. Report results:

```
Added to <world name>:
- 3 monsters
- 5 items
- 2 NPCs
- 2 encounters

New totals:
- Monsters: 12 → 15
- Items: 20 → 25
- NPCs: 8 → 10
- Encounters: 10 → 12

NPCs auto-linked to locations.
Encounters auto-linked to locations.
```

---

## Phase 7: Continue or Done

```
header: "Continue"
question: "What would you like to do next?"
options:
  - label: "Add more content"
    description: "Continue augmenting this world"
  - label: "View content"
    description: "Look at what was added"
  - label: "Done"
    description: "Finish augmentation"
```

If "Add more content", return to Phase 3.
If "View content", use get_* tools to show details.

---

## Content Integration

When `autoLink: true`:
- NPCs with `locations` array → added to those locations' NPC lists
- Encounters with `locationId` → added to that location's encounter list
- New monsters referenced in encounters → validated against existing + new monsters

This creates a cohesive expansion where content is properly connected.

---

## Error Handling

- If pack not found: "World pack '<id>' not found. Use /augment-world to see available packs."
- If generation fails: Offer to retry that specific content type
- If merge fails due to ID collision: Report which IDs conflict, offer to regenerate

---

## Tips for Good Augmentation

1. **Themed batches work best** - "Ice dungeon content" produces more coherent results than random additions
2. **Include encounters with monsters** - Monsters without encounters are less useful
3. **NPCs need locations** - Always specify where NPCs can be found
4. **Build on existing content** - Reference existing factions, locations, NPCs in themes
