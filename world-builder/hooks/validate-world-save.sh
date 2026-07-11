#!/bin/bash
# validate-world-save.sh — PostToolUse hook for save_generation_result.
#
# Validates schema compliance of content saved via save_generation_result.
# Reads a PostToolUse JSON event from stdin and checks that the returned
# result has required fields (generatedIds, file path, valid status).
#
# Exits 0 silently when everything looks good. Emits hookSpecificOutput
# with additionalContext warnings when validation issues are detected.
#
# Uses jq-based JSON stdin/stdout protocol (same as handle-mcp-failure.sh).

set -euo pipefail

INPUT=$(cat)

# Only act on save_generation_result tool calls
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
if ! echo "$TOOL_NAME" | grep -q 'save_generation_result'; then
  exit 0
fi

# Skip error responses — handle-mcp-failure.sh covers those
IS_ERROR=$(echo "$INPUT" | jq -r '.tool_response.is_error // false' 2>/dev/null || true)
if [[ "$IS_ERROR" == "true" ]]; then
  exit 0
fi

# ── Validate tool inputs ────────────────────────────────────────────────────
SESSION_ID=$(echo "$INPUT" | jq -r '.tool_input.sessionId // empty' 2>/dev/null || true)
STEP_ID=$(echo "$INPUT" | jq -r '.tool_input.stepId // empty' 2>/dev/null || true)
RESULT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.result | type' 2>/dev/null || true)

# ── Parse tool response ─────────────────────────────────────────────────────
# The handler returns { message, stepId, generatedIds, status, file }
RESPONSE_RAW=$(echo "$INPUT" | jq -r '.tool_response.content[0].text // empty' 2>/dev/null || true)
if [[ -z "$RESPONSE_RAW" ]]; then
  # Some MCP transports embed content directly
  RESPONSE_RAW=$(echo "$INPUT" | jq -r '.tool_response.content // empty' 2>/dev/null || true)
fi

GENERATED_IDS_COUNT=0
FILE=""
STATUS=""

if [[ -n "$RESPONSE_RAW" ]]; then
  GENERATED_IDS_COUNT=$(echo "$RESPONSE_RAW" | jq -r '.generatedIds | length' 2>/dev/null || echo "0")
  FILE=$(echo "$RESPONSE_RAW" | jq -r '.file // empty' 2>/dev/null || true)
  STATUS=$(echo "$RESPONSE_RAW" | jq -r '.status // empty' 2>/dev/null || true)
fi

WARNINGS=()

# Check required inputs were present
if [[ -z "$SESSION_ID" ]]; then
  WARNINGS+=("Missing sessionId in tool input — session association may be lost")
fi
if [[ -z "$STEP_ID" ]]; then
  WARNINGS+=("Missing stepId in tool input — step tracking may be incorrect")
fi

# Check result input type
if [[ "$RESULT_TYPE" == "null" ]] || [[ -z "$RESULT_TYPE" ]]; then
  WARNINGS+=("Tool input 'result' is null or missing — no content was provided to save")
fi

# Check that entity IDs were generated
# Note: Only warn if we successfully parsed the response AND found zero IDs.
# If parsing failed entirely (RESPONSE_RAW is empty), skip — the response format
# varies by transport and a parsing miss is not the same as empty content.
if [[ -n "$RESPONSE_RAW" ]] && [[ "$GENERATED_IDS_COUNT" == "0" ]]; then
  # Double-check: try extracting generatedIds as a raw string to catch format differences
  IDS_RAW=$(echo "$RESPONSE_RAW" | jq -r '.generatedIds // empty' 2>/dev/null || true)
  if [[ -z "$IDS_RAW" ]] || [[ "$IDS_RAW" == "[]" ]] || [[ "$IDS_RAW" == "null" ]]; then
    WARNINGS+=("No entity IDs returned (generatedIds=[]) — saved content may be empty or schema validation failed silently")
  fi
fi

# Note: File-based persistence was replaced by SQLite storage.
# The 'file' field no longer appears in responses — this is expected.

# Validate generation status is a recognized value
VALID_STATUSES="idle|seeding|generating|expanding|assembling|complete|augmenting"
if [[ -n "$STATUS" ]] && ! echo "$STATUS" | grep -qE "^(${VALID_STATUSES})$"; then
  WARNINGS+=("Unexpected generation status '${STATUS}' — expected one of: ${VALID_STATUSES//|/, }")
fi

# All good — exit silently
if [[ ${#WARNINGS[@]} -eq 0 ]]; then
  exit 0
fi

# Emit validation warnings as hookSpecificOutput
WARNING_LINES=$(printf ' - %s\n' "${WARNINGS[@]}")
CONTEXT="save_generation_result schema validation warnings (stepId=${STEP_ID:-unknown}):\n${WARNING_LINES}\nReview the saved content for issues and retry the step if needed."

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
