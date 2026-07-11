# RPG World Builder Plugin

A Claude Code plugin for interactive RPG gameplay with parallel world building, GM-driven combat, exploration, and world expansion tools.

## Installation

### Option 1: Marketplace Install (Recommended)

```
# In Claude Code — add the marketplace, then install the plugin:
/plugin marketplace add protoLabsAI/mythx-mcp
/plugin install rpg@mythx-plugins
```

Or add it manually to your Claude Code settings (`~/.claude/settings.json`) — `path` is the directory containing `.claude-plugin/marketplace.json` (the repo root in a `mythx-mcp` clone):

```json
{
  "enabledPlugins": {
    "rpg@mythx-plugins": true
  },
  "extraKnownMarketplaces": {
    "mythx-plugins": {
      "source": {
        "source": "directory",
        "path": "/path/to/marketplace-root"
      }
    }
  }
}
```

### Option 2: Direct Plugin Dir

```bash
claude --plugin-dir /path/to/world-builder
```

### First Run

```
/rpg:play
```

The plugin launches the RPG MCP server automatically via `npx -y @mythxengine/mcp-server@^0.2.0` (requires Node >= 22.13 — no build step, no checkout). The version is pinned in `plugin.json` so npx can never resolve the retired pre-SQLite `0.1.x` snapshots that exist on npm; bump the pin alongside server releases. Game data lives in `~/.mythxengine/data`. Play from any directory on your system.

## What's Included

### Skills (8 user commands)

| Skill                   | Command                    | Description                                                          |
| ----------------------- | -------------------------- | -------------------------------------------------------------------- |
| **play**                | `/rpg:play`                | Full RPG session — world gen, character creation, GM-driven gameplay |
| **world-building-mode** | `/rpg:world-building-mode` | Focused world creation and expansion                                 |
| **generate-books**      | `/rpg:generate-books`      | Print-ready zine books from world packs                              |
| **combat-mode**         | `/rpg:combat-mode`         | Structured combat with initiative and turns                          |
| **exploration-mode**    | `/rpg:exploration-mode`    | Scene-by-scene travel, discovery, investigation                      |
| **augment-world**       | `/rpg:augment-world`       | Add content to existing worlds                                       |
| **session-management**  | `/rpg:session-management`  | Manage sessions, players, and turns                                  |
| **roleplay-npc**        | `/rpg:roleplay-npc`        | Deep NPC embodiment with full personality                            |

### Agents (5 subagent workers)

| Agent                 | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| **content-generator** | Parallel world content worker (archetypes, monsters, etc.) |
| **book-generator**    | Generates formatted book content                           |
| **ai-player**         | Autonomous AI party member — decides actions in-character  |
| **player-researcher** | Player-safe world lookups (no GM spoilers)                 |
| **deep-roleplay**     | Extended NPC embodiment for dramatic scenes                |

### Hooks (bundled)

| Hook                   | Event        | Purpose                                          |
| ---------------------- | ------------ | ------------------------------------------------ |
| session-context        | SessionStart | Restores game state after compaction             |
| pre-compact-save-state | PreCompact   | Saves checkpoint before compaction               |
| handle-mcp-failure     | PostToolUse  | Auto-recovery from MCP errors                    |
| validate-world-save    | PostToolUse  | Schema validation on save_generation_result      |
| evaluate-session       | SessionEnd   | Pattern detection (bugs, retries, schema errors) |

## Features

- **Auto-mode**: Say "auto" during gameplay and the GM plays all characters autonomously
- **Parallel world gen**: 7 content generators run simultaneously
- **AI companions**: Full party support with playstyle-driven AI decisions
- **Persistent state**: Games save to SQLite — resume any time
- **Input coercion**: Resilient to LLM type serialization errors

## Game Flow

```
/rpg:play
   ↓
Session Selection (resume or new)
   ↓ (if new)
World Concept + Tone → Parallel Generation (7 agents)
   ↓
Character Creation (1-2 user interactions)
   ↓
Gameplay Loop (GM narrates, you decide, dice resolve)
```

## Data Storage

All game data lives in `~/.mythxengine/data/` (override with the `RPG_MCP_DATA_DIR` environment variable):

- Sessions, characters, and world packs in `mythx.db` (SQLite)
- Generated books in `books/<pack-id>/`
- Rules in `rules/`
