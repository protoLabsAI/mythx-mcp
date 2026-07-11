#!/bin/bash
# PreCompact hook: saves current RPG session state to checkpoint file.
#
# Reads the most recently modified session from data/*.session.json and
# extracts key fields: sessionId, name, characters (HP/conditions/stress),
# location (from worldState), game time, active clocks, and deadlines.
#
# Output is saved to .claude/data/session-state.json
# Completes in well under 500ms (file reads + node transform).

set -euo pipefail

# Plugin-aware paths: use CLAUDE_PLUGIN_DATA if available, fall back to .claude/data
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-${PLUGIN_ROOT}/data}"
CHECKPOINT="${DATA_DIR}/session-state.json"

# RPG data directory (RPG_MCP_DATA_DIR override, or the server's default)
RPG_DATA="${RPG_MCP_DATA_DIR:-${HOME}/.mythxengine/data}"

mkdir -p "${DATA_DIR}"

# Find node (required for JSON processing)
NODE_BIN="$(command -v node 2>/dev/null || true)"
if [ -z "${NODE_BIN}" ]; then
  # Fallback: write empty checkpoint and exit gracefully
  printf '{"savedAt":"%s","session":null,"error":"node_not_found"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${CHECKPOINT}"
  exit 0
fi

# Find the most recently modified session file
SESSION_FILE=""
if [ -d "${RPG_DATA}" ]; then
  SESSION_FILE=$(find "${RPG_DATA}" -maxdepth 1 -name "*.session.json" -type f 2>/dev/null \
    | xargs -r ls -t 2>/dev/null | head -1 || true)
fi

SAVED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ -z "${SESSION_FILE}" ]; then
  # No session file found — write empty checkpoint
  printf '{"savedAt":"%s","session":null}\n' "${SAVED_AT}" > "${CHECKPOINT}"
  exit 0
fi

# Extract key fields from the session file using the SessionState schema
"${NODE_BIN}" - "${SESSION_FILE}" "${SAVED_AT}" "${CHECKPOINT}" << 'NODE_EOF'
const fs = require('fs');
const [, , sessionFile, savedAt, checkpointPath] = process.argv;

let raw;
try {
  raw = fs.readFileSync(sessionFile, 'utf8');
} catch {
  fs.writeFileSync(checkpointPath, JSON.stringify({ savedAt, session: null, error: 'read_failed' }) + '\n');
  process.exit(0);
}

let s;
try {
  s = JSON.parse(raw);
} catch {
  fs.writeFileSync(checkpointPath, JSON.stringify({ savedAt, session: null, error: 'parse_failed' }) + '\n');
  process.exit(0);
}

const characters = Object.entries(s.characters || {}).map(([id, c]) => ({
  id,
  name: c.name,
  hp: c.hp ?? null,
  maxHp: c.maxHp ?? null,
  stress: c.stress ?? null,
  conditions: c.conditions || [],
}));

const gt = s.gameTime || {};
const gameTime = { day: gt.day, hour: gt.hour, minute: gt.minute, era: gt.era ?? null };

const activeClocks = (s.activeClocks || [])
  .filter(c => !c.paused)
  .map(c => ({ clockId: c.clockId, name: c.name, doom: c.doom, currentStage: c.currentStage, totalStages: c.totalStages }));

const deadlines = (s.deadlines || []).map(d => ({
  id: d.id,
  description: d.description,
  dueTime: d.dueTime ?? null,
}));

const notes = s.notes || [];
const recentNotes = notes.slice(-3).map(n => ({
  timestamp: n.timestamp,
  content: n.content,
  tags: n.tags,
}));

const checkpoint = {
  savedAt,
  session: {
    sessionId: s.metadata?.id ?? 'unknown',
    name: s.metadata?.name ?? 'Unknown Session',
    worldPackId: s.worldPackId ?? null,
    characters,
    location: s.worldState?.currentLocation ?? s.worldState?.location ?? null,
    gameTime,
    activeClocks,
    deadlines,
    recentNotes,
  },
};

fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2) + '\n');
NODE_EOF

exit 0
