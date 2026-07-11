# Bundled World Packs

Four pre-generated world packs that ship with `@mythxengine/mcp-server` so first-time users can install the server and start playing immediately, with no API key and no world-gen wait.

## Layout

```text
bundled-packs/
├── manifest.json          # Declarative list of bundled packs (id, slug, tier, paths)
├── seeds/                 # Campaign seed prompts — the input to world-gen
│   ├── port-miriam.seed.md
│   ├── aethelgard.seed.md
│   ├── threshold-deep.seed.md
│   └── treehouse-anthology.seed.md
└── packs/                 # Compiled world packs — the output of world-gen
    ├── port-miriam.world.json
    ├── aethelgard.world.json
    ├── threshold-deep.world.json
    └── treehouse-anthology.world.json
```

Seeds are checked in. Packs are checked in (this is the value the bundle delivers — generated content). Both travel together in the repo — a seed without a pack means "needs regeneration"; a pack without a seed means "lost provenance." The npm tarball ships `manifest.json`, `packs/`, and this README; seeds stay repo-only.

Packs are regenerated from their seeds by the maintainers' world-generation pipeline upstream. That tooling is not part of this package — treat the packs here as read-only, versioned content.

## Bundling lifecycle

1. **First-run import** — when the MCP server boots, it checks the user's SQLite db for each bundled pack ID. Missing packs get imported from `packs/*.world.json`. The user's db is the source of truth for sessions and saves; bundled packs are read-only seed content.
2. **Pack updates** — _not implemented in v0._ The current importer skips any pack whose ID is already present in the user's db. Future bundle updates will require an explicit refresh signal (manifest version + tracked-import field, or a CLI command). For now: a user who wants the latest bundled version of a pack must delete the existing copy via MCP tools, then restart the server.
3. **Removing a pack** — deleting a bundled pack from the manifest does **not** delete it from existing user dbs. Bundled-pack removal is additive-only by default; users can delete packs themselves through MCP tools.

## Why the four

| Pack                | Tone                             | Hook                                         |
| ------------------- | -------------------------------- | -------------------------------------------- |
| Port Miriam         | Mystery / Noir                   | Urban detective in a corrupt 1947 city       |
| Aethelgard          | Dark Fantasy                     | Last High Elf vs. an eternally hungry dragon |
| Threshold Deep      | Sci-Fi Horror                    | Deep-space station, ancient signal           |
| Treehouse Anthology | Suburban Gothic / Comedic Horror | Family descent into a Halloween underworld   |

Picked for tonal diversity — each lands in a different corner of the genre space so a first-time user picking blind has a strong chance of finding something they want.
