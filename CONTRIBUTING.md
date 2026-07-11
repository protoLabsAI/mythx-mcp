# Contributing

Thanks for your interest in MythxEngine!

## This repo is a downstream mirror

`mythx-mcp` is exported from a private upstream monorepo by a one-way sync
script. The private repo is always the source of truth; every release here is
a fresh snapshot (`sync: export from private@<sha>` commits).

What that means for contributions:

- **Issues are the best way to help.** Bug reports, balance feedback, and
  world-content problems are all actionable — file them here.
- **PRs are welcome, but they are not merged directly.** A maintainer replays
  accepted changes into the private upstream, and your fix flows back out in
  the next export. You'll be credited in the sync commit / release notes.
  Expect your PR to be closed with a "replayed upstream" note rather than
  merged, and the diff to appear here one export later.
- **Don't send large refactors without an issue first.** The export layout
  (which files ship, which stay private) is fixed by the upstream sync script,
  so structural changes need coordination.

## Development

```bash
pnpm install
pnpm build       # turbo build across all packages
pnpm test        # vitest suites
pnpm lint        # eslint
pnpm typecheck   # per-package tsc --noEmit
```

Requires Node >= 22.13 (the storage layer uses `node:sqlite`) and pnpm 9.

### Layout

| Path                  | What it is                                             |
| --------------------- | ------------------------------------------------------ |
| `packages/mcp-server` | The published MCP server (`@mythxengine/mcp-server`)   |
| `packages/*`          | Engine, types, worlds, rulebook, storage, tools        |
| `world-builder/`      | The `rpg` Claude Code plugin                           |
| `.claude-plugin/`     | Marketplace manifest (`mythx-plugins`)                 |
| `scripts/`            | Release tooling (`build-mcpb.mjs`, tarball smoke test) |

### Smoke test the npm artifact

```bash
node scripts/smoke-npm-tarball.mjs
```

Packs the server, installs the tarball in a temp project under plain Node,
and drives a full MCP handshake against the installed bin.

## Releases

Maintainers cut releases by tagging `v<version>` (matching
`packages/mcp-server/package.json`). CI publishes to npm and attaches the
`.mcpb` bundle to the GitHub Release — see `.github/workflows/release.yml`.
