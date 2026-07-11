---
name: image-generation
description: Visual layer guidelines — when to call frame_scene / generate_portrait / generate_item_art, how to write portrait & item descriptions for SDXL, the add_npc → generate_portrait → showDialogue contract for NPCs invented mid-session, and the silent-on-failure rule. Load when about to generate images, introduce an NPC, or reveal a notable item.
when_to_load: about to call frame_scene, generate_portrait, or generate_item_art; introducing a named NPC; player examines / discovers a notable item
---

# Image Generation Guidelines

The game has a visual layer — pixel art images generated in ~0.5s.

## Scene Images — Automatic via frame_scene

`frame_scene` generates the scene image and the UI auto-renders a card showing the location name, time, atmosphere, opening line, and image — all from `frame_scene`'s tool output. The card is the complete scene-open; one call covers it.

**Your prose follows the card.** The card already shows location, time, atmosphere, and opening line. Use your prose for what's happening _in_ the scene — NPC actions, what the player notices, the next beat — building forward from the card rather than re-stating it.

## Portraits and Item Art — One Tool, Auto-Rendered

`generate_portrait` and `generate_item_art` auto-render their image as an inline card. One call ships the card; subsequent show tools would render a duplicate.

```text
generate_portrait({ sessionId, npcId: "npc-dalla" })   // card renders
generate_item_art({ sessionId, itemId: "corroded-blade" })   // card renders
```

**On NPC introduction:** call `generate_portrait` for each named NPC the FIRST time they appear, alongside or just before describing them in prose.

**If the tool fails** (no `imageUrl` in the result), no card renders. Continue narrating as if the visual layer were silent.

### Inventing NPCs not in the world pack

If you introduce a fabricated NPC (someone who isn't in the pack — a tavern barkeep, a road bandit, a mysterious stranger), follow this three-step contract so their portrait sticks across the session:

```text
1. add_npc({ sessionId, name, description, attitude?, narrativeRole? })
   → returns { npcId }                  // session-scoped, stable id
2. generate_portrait({ sessionId, npcId })
   → portrait renders + binds to npcId  // session media, persisted on the runtime NPC record
3. showDialogue({ npcId, npcName, ... }) or further references
   → dialogue card pulls the portrait by npcId automatically
```

**Step 1 must precede step 2** so the portrait binds to a stable npcId and subsequent dialogue cards keep the face. For NPCs that reappear later, reuse the same `npcId` from the original `add_npc` call — `add_npc` is idempotent on returns but you save a turn by going straight to `generate_portrait`. Pack NPCs (`quick_research` finds them) skip step 1 entirely; call `generate_portrait` directly with their pack id.

## When to Generate Additional Scene Images

Since `frame_scene` auto-generates, reach for `generate_scene_image` + `showSceneImage` when:

- A major environmental change happens mid-scene (storm arrives, building collapses)
- A boss encounter begins
- The mood shifts dramatically within an existing scene

If the same location image already rendered earlier in the same scene, reuse the existing card — narration alone keeps the beat moving.

## When to Generate Portraits

Generate when:

- An important NPC is introduced for the first time
- A villain or boss reveals themselves
- The player requests to see what a character looks like

Skip portraits for minor NPCs (shopkeepers, random guards) unless they become dramatically relevant, and during fast-paced beats where pausing breaks flow — keep those in prose.

## When to Generate Item Art

Generate when:

- Player discovers a rare+ item or quest item
- Player examines an item closely

Common items (rations, rope, torches) stay in prose — the visual cost outweighs the narrative payoff.

## Prompt Tips

- If providing a custom `prompt`, be descriptive but concise
- Include visual elements: lighting, color palette, mood
- The style auto-layers: base pixel art + world aesthetic + entity description

### Portrait Descriptions

When calling `generate_portrait`, describe the character's **upper body appearance** — what you'd see from the shoulders up. Focus on face, expression, clothing/armor at shoulder level, and distinguishing features (scars, hair, headgear, masks).

**Good:** "weathered face behind a cracked welding mask, heavy tarp-wrapped shoulders" — close-range visual details, what the camera sees from the shoulders up.

The template handles framing — provide visual details at close range and let the layered styling do the rest. Long-shot scene descriptions ("massive figure dragging a shopping cart") confuse SDXL into rendering a scene instead of a portrait.

### Item Descriptions

When calling `generate_item_art`, describe the **physical object itself** — shape, material, color, distinguishing features. Keep it short (under 10 words after the item name).

**Good:** "jagged short sword with a corroded edge" — concrete shape + material + distinguishing detail.

SDXL needs visual keywords, not narrative lore. Backstory ("forged in the depths of Mount Korroth") belongs in prose; the prompt should read like an art director's brief.

## Graceful Failure

If pixelgen is unavailable, generation silently fails. The visual layer goes quiet — continue narrating as if it weren't there. The player sees prose, not an apology.
