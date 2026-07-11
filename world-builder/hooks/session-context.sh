#!/bin/bash
# session-context.sh — SessionStart and SessionEnd lifecycle hook.
#
# SessionStart: reads the saved checkpoint and outputs a game state restoration
# prompt so Claude can resume the RPG session with full context after compaction
# or a fresh session start.
#
# SessionEnd: reads the most recent session file and appends a summary line to
# .claude/data/session-history.jsonl for long-term session tracking.
#
# Completes in well under 500ms (file reads + node transform).

set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-${PLUGIN_ROOT}/data}"
CHECKPOINT="${DATA_DIR}/session-state.json"
HISTORY="${DATA_DIR}/session-history.jsonl"

# RPG data directory (RPG_MCP_DATA_DIR override, or the server's default)
RPG_DATA="${RPG_MCP_DATA_DIR:-${HOME}/.mythxengine/data}"

mkdir -p "${DATA_DIR}"

# Find node (required for JSON processing)
NODE_BIN="$(command -v node 2>/dev/null || true)"

# Determine which event triggered this hook
INPUT=$(cat)
EVENT=$(printf '%s' "$INPUT" | "${NODE_BIN}" -e \
  'let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{ try { console.log(JSON.parse(d).hook_event_name||""); } catch { console.log(""); } })' \
  2>/dev/null || true)

# Fallback: parse event from the already-captured INPUT
if [ -z "$EVENT" ] && [ -n "${NODE_BIN}" ]; then
  EVENT=$(printf '%s' "$INPUT" | "${NODE_BIN}" -e \
    'const d=require("fs").readFileSync("/dev/stdin","utf8"); try{process.stdout.write(JSON.parse(d).hook_event_name||"")}catch{}' \
    2>/dev/null || true)
fi

# ──────────────────────────────────────────────────────────────────────────────
# SessionStart: inject game state restoration prompt
# ──────────────────────────────────────────────────────────────────────────────
if [ "$EVENT" = "SessionStart" ]; then
  if [ ! -f "$CHECKPOINT" ] || [ -z "${NODE_BIN}" ]; then
    exit 0
  fi

  "${NODE_BIN}" - "${CHECKPOINT}" << 'NODE_EOF'
const fs = require('fs');
const [, , checkpointPath] = process.argv;

let cp;
try {
  cp = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
} catch {
  process.exit(0);
}

const s = cp.session;
if (!s || s === null) process.exit(0);

const lines = [];
lines.push('## RPG Session Context Restored');
lines.push('');
lines.push(`The conversation was compacted. Here is the saved game state from **${s.name}** (ID: \`${s.sessionId}\`), captured at ${cp.savedAt}.`);
lines.push('');

// Characters
lines.push('### Characters');
if (s.characters && s.characters.length > 0) {
  for (const c of s.characters) {
    let line = `  - ${c.name}: HP ${c.hp ?? '?'}/${c.maxHp ?? '?'}`;
    if (c.stress != null) line += ` | Stress ${c.stress}`;
    if (c.conditions && c.conditions.length > 0) line += ` | Conditions: ${c.conditions.join(', ')}`;
    lines.push(line);
  }
} else {
  lines.push('  (none)');
}
lines.push('');

// Location
lines.push('### Location');
lines.push(s.location || 'unknown');
lines.push('');

// Game time
const gt = s.gameTime || {};
const min = String(gt.minute ?? 0).padStart(2, '0');
lines.push('### Game Time');
lines.push(`Day ${gt.day ?? '?'}, ${gt.hour ?? '?'}:${min}`);

// Active clocks
if (s.activeClocks && s.activeClocks.length > 0) {
  lines.push('');
  lines.push('### Active Clocks');
  for (const c of s.activeClocks) {
    lines.push(`  - ${c.name}: stage ${c.currentStage}/${c.totalStages} → ${c.doom}`);
  }
}

// Deadlines
if (s.deadlines && s.deadlines.length > 0) {
  lines.push('');
  lines.push('### Active Deadlines');
  for (const d of s.deadlines) {
    lines.push(`  - ${d.description}`);
  }
}

// Recent notes
if (s.recentNotes && s.recentNotes.length > 0) {
  lines.push('');
  lines.push('### Recent Notes');
  for (const n of s.recentNotes) {
    lines.push(`  - [${n.timestamp}] ${n.content}`);
  }
}

lines.push('');
lines.push('---');
lines.push('*Continue the session normally. Use `get_session` or `list_characters` if you need more detail.*');
lines.push('');

process.stdout.write(lines.join('\n'));
NODE_EOF

  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
# SessionEnd: persist session summary to session-history.jsonl
# ──────────────────────────────────────────────────────────────────────────────
if [ "$EVENT" = "SessionEnd" ]; then
  if [ -z "${NODE_BIN}" ]; then
    exit 0
  fi

  # Find most recent session file
  SESSION_FILE=""
  if [ -d "${RPG_DATA}" ]; then
    SESSION_FILE=$(find "${RPG_DATA}" -maxdepth 1 -name "*.session.json" -type f 2>/dev/null \
      | xargs -r ls -t 2>/dev/null | head -1 || true)
  fi

  if [ -z "${SESSION_FILE}" ]; then
    exit 0
  fi

  ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Append a summary line to session-history.jsonl
  "${NODE_BIN}" - "${SESSION_FILE}" "${ENDED_AT}" "${HISTORY}" << 'NODE_EOF'
const fs = require('fs');
const [, , sessionFile, endedAt, historyPath] = process.argv;

let s;
try {
  s = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
} catch {
  process.exit(0);
}

const gt = s.gameTime || {};
const min = String(gt.minute ?? 0).padStart(2, '0');
const summary = {
  endedAt,
  sessionId: s.metadata?.id ?? 'unknown',
  name: s.metadata?.name ?? 'Unknown Session',
  characterCount: Object.keys(s.characters || {}).length,
  noteCount: (s.notes || []).length,
  gameTime: `Day ${gt.day ?? '?'} ${gt.hour ?? '?'}:${min}`,
  flagCount: (s.flags || []).length,
  worldPackId: s.worldPackId ?? null,
};

fs.appendFileSync(historyPath, JSON.stringify(summary) + '\n');
NODE_EOF

  exit 0
fi

# Unknown or missing event — no-op
exit 0
