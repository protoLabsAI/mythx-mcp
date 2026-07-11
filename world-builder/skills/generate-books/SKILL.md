---
name: generate-books
description: Generate print-ready books from an existing world pack. Creates GM book, player book, bestiary, and campaign setting.
argument-hint: <world-pack-id>
allowed-tools:
  - Task
  - AskUserQuestion
  - mcp__rpg__list_world_packs
  - mcp__rpg__load_world_pack
  - mcp__rpg__generate_rulebook
  - mcp__rpg__save_rulebook_result
  - mcp__rpg__generate_world_books
  - mcp__rpg__generate_appendices
  - mcp__rpg__save_book_result
---

# Generate Books Command

Generate print-ready books from an existing world pack.

## Usage

```
/generate-books <world-pack-id>
```

If no world pack ID is provided, lists available packs.

## Output

Creates files in the data directory (configurable via `RPG_MCP_DATA_DIR` environment variable, defaults to `~/.mythxengine/data/`):

```
data/
├── rules/                    # Shared across all worlds
│   ├── core-rules.txt        # Complete rulebook
│   ├── quick-reference.txt   # One-page reference
│   └── character-sheet.txt   # Printable character sheet
│
└── books/<pack-id>/          # World-specific books (uses pack ID)
    ├── gm-book.txt           # GM-only content (full spoilers)
    ├── player-book.txt       # Player-facing content
    ├── bestiary.txt          # All monsters
    ├── campaign-setting.txt  # World overview
    └── appendices/
        ├── items.txt         # Complete item catalog
        ├── conditions.txt    # Conditions reference
        └── encounters.txt    # Encounter tables
```

## Workflow

### Phase 1: World Pack Selection

If no pack ID provided:

1. Call `mcp__rpg__list_world_packs()` to get available packs
2. Use `AskUserQuestion` to let user select:
   ```
   header: "World Pack"
   question: "Which world do you want to generate books for?"
   options:
     - label: "<pack-name>"
       description: "<pack-tagline>"
     ...
   ```

### Phase 2: Validate Pack

1. Call `mcp__rpg__load_world_pack({ packId })` to verify it exists
2. Display world summary:
   - Name and tagline
   - Content counts (archetypes, monsters, locations, etc.)
3. Confirm generation with user

### Phase 3: Generate Rulebook (if needed)

1. Call `mcp__rpg__generate_rulebook({ force: false })`
2. If `cached: false`:
   - Launch `rpg:book-generator` subagent for rulebook
   - Wait for completion

### Phase 4: Generate World Books (Parallel)

Launch 4 book-generator subagents in a SINGLE message:

```
Task(subagent_type: "rpg:book-generator",
     prompt: "Generate GM book for pack <id>. Type: gm")
Task(subagent_type: "rpg:book-generator",
     prompt: "Generate player book for pack <id>. Type: player")
Task(subagent_type: "rpg:book-generator",
     prompt: "Generate bestiary for pack <id>. Type: bestiary")
Task(subagent_type: "rpg:book-generator",
     prompt: "Generate campaign setting for pack <id>. Type: setting")
```

### Phase 5: Generate Appendices (Parallel)

Launch 3 book-generator subagents:

```
Task(subagent_type: "rpg:book-generator",
     prompt: "Generate items appendix for pack <id>. Type: items")
Task(subagent_type: "rpg:book-generator",
     prompt: "Generate conditions appendix for pack <id>. Type: conditions")
Task(subagent_type: "rpg:book-generator",
     prompt: "Generate encounters appendix for pack <id>. Type: encounters")
```

### Phase 6: Report

Display completion summary:

- List of generated files with paths
- Total page/word counts if available
- Instructions for printing

## Book Descriptions

### Rulebook (Cached)

The core rules, shared across all worlds:

- d20 test system
- 4 abilities (STR/AGI/WIT/CON)
- Difficulty levels (8/12/16/20)
- Combat rules
- Character creation basics

### GM Book

Everything the GM needs to run the world:

- Opening scenes and session zero guidance
- Situations with clocks and leads
- Full NPC profiles with secrets
- Location secrets and GM notes
- Encounter tables

### Player Book

Safe for players to read:

- World overview
- Full archetype details
- Known locations (no secrets)
- Public NPC information
- Equipment catalog
- Quick reference

### Bestiary

All creatures by threat tier:

- Minions (HP 4-6)
- Standard (HP 10-14)
- Elite (HP 18-24)
- Boss (HP 30-40)

Each with full stats, tactics, lore, and descriptions.

### Campaign Setting

Deep world-building reference:

- History and lore
- Geography
- Factions and politics
- Cultures
- Magic/technology systems

### Appendices

Reference tables:

- Complete item catalog
- All conditions
- Encounter tables by location

## Text Format

All books use plain text optimized for zine printing:

- `===` for major sections
- `---` for subsections
- `*text*` for emphasis
- 50-character max line width
- `<<<PAGE>>>` for page breaks
