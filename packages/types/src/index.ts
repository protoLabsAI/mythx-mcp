/**
 * @mythxengine/types
 *
 * Core type definitions for the RPG MCP server
 */

// Game types
export * from "./game/index.js";

// Rules configuration types
export * from "./rules/index.js";

// Session types
export * from "./session/index.js";

// Tool contract types
export * from "./tools/contract.js";

// Snapshot types (shared between agent and frontend)
export * from "./snapshots.js";

// Game-frame envelope (frame loop presentation contract)
export * from "./frames.js";

// LLM tier + agent-role types (shared between the agents config layer and
// the Connections settings UI; lives here so the UI can import without
// pulling in LangChain transitively through @mythxengine/agents).
export * from "./llm-roles.js";
