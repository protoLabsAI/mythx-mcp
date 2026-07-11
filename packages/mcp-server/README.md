# @mythxengine/mcp-server

A Model Context Protocol (MCP) server for tabletop RPG game mechanics:
dice rolling with five-tier outcomes and position/effect framing,
FitD-style stress (push / resist / flashback), combat tracking,
situation clocks, leads and investigations, NPC relationships, world
generation, and session persistence — 100+ tools, plus four complete
bundled starter worlds that import on first run.

## Requirements

- Node.js >= 22.13 (uses the builtin `node:sqlite`; Bun also works via `bun:sqlite`)

## Install

```bash
# Claude Code
claude mcp add rpg -- npx -y @mythxengine/mcp-server
```

Or configure any MCP client to run it over stdio:

```json
{
  "mcpServers": {
    "rpg": {
      "command": "npx",
      "args": ["-y", "@mythxengine/mcp-server"]
    }
  }
}
```

## Data directory

Session state and world packs live in a SQLite database. Resolution
order:

1. `RPG_MCP_DATA_DIR` env var (explicit override)
2. `<repo>/data` when running from a development checkout
3. `~/.mythxengine/data` (installed / `npx` runs)

## Bundled worlds

Four starter world packs (Port Miriam, Aethelgard, Threshold Deep,
Treehouse Anthology) ship in the package and are imported into your
database on first startup — existing packs are never overwritten.
Explore them with `list_world_packs` / `load_world_summary`.

## License

MIT
