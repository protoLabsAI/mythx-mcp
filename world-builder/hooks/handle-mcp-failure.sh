#!/bin/bash
# MCP failure recovery hook.
#
# Reads a PostToolUse JSON event from stdin. When an MCP tool call fails,
# diagnoses the failure type and emits recovery instructions via
# hookSpecificOutput so Claude can self-recover without human intervention.
#
# Failure types detected:
#   - server_unreachable  : connection refused / server not running
#   - auth_failure        : 401/403 / invalid credentials
#   - generic_error       : any other non-zero MCP error
#
# Uses jq-based JSON stdin/stdout protocol (same as guard-bash.sh).

set -euo pipefail

INPUT=$(cat)

# Only act when the tool produced an error result
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
IS_ERROR=$(echo "$INPUT" | jq -r '.tool_response.is_error // false' 2>/dev/null || true)

if [[ "$IS_ERROR" != "true" ]]; then
  exit 0
fi

CONTENT=$(echo "$INPUT" | jq -r '.tool_response.content // ""' 2>/dev/null || true)

# Classify the failure
if echo "$CONTENT" | grep -qiE '(connection refused|ECONNREFUSED|server.*not.*running|unreachable|ENOTFOUND|ETIMEDOUT)'; then
  REASON="MCP server appears to be unreachable (connection refused or timed out). Recovery steps: (1) Check that the MCP server can start: \`npx -y @mythxengine/mcp-server@^0.3.0\` (same pinned spec as plugin.json). (2) Verify RPG_MCP_DATA_DIR is set if using a custom data directory (default: ~/.mythxengine/data). (3) Restart the server and retry the tool call."

elif echo "$CONTENT" | grep -qiE '(401|403|unauthorized|forbidden|invalid.*key|invalid.*token|auth.*fail)'; then
  REASON="MCP authentication failure. Recovery steps: (1) Verify your API keys / credentials in environment variables. (2) Check the rpg entry under mcpServers in the plugin's plugin.json launches the right server. (3) Restart Claude Code after updating credentials."

else
  REASON="MCP tool '${TOOL_NAME}' returned an error: ${CONTENT}. Recovery steps: (1) Review the error message above for details. (2) Verify the tool input parameters match the schema. (3) If the server state is corrupted, inspect the session file in the data directory and correct or delete it. (4) Retry the operation."
fi

jq -n --arg reason "$REASON" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $reason
  }
}'
