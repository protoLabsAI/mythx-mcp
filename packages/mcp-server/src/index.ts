#!/usr/bin/env node
/**
 * RPG MCP Server
 *
 * A Model Context Protocol server for tabletop RPG game mechanics.
 * Provides tools for dice rolling, character management, combat tracking,
 * and session persistence.
 */

import { createMCPServer, startMCPServer } from "./server.js";
import { createToolRegistry } from "./tools/index.js";
import { createResourceHandler } from "./resources/index.js";
import { importBundledPacks } from "./state/bundled-packs.js";

const SERVER_NAME = "mythxengine";
const SERVER_VERSION = "0.2.1";

async function main() {
  // First-run: import any bundled packs not yet present in the user's db.
  // Idempotent and best-effort — failures inside the function are logged.
  // Wrap the call here too so any future refactor that lets exceptions
  // escape can't accidentally block server startup.
  try {
    await importBundledPacks();
  } catch (err) {
    console.warn(
      "[startup] bundled-pack import failed; continuing without bundle:",
      err instanceof Error ? err.message : err
    );
  }

  // Create tool registry
  const tools = createToolRegistry();

  // Create resource handler
  const resources = createResourceHandler();

  // Create server
  const server = createMCPServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      tools,
      resources,
      onError: (error, toolName) => ({
        message: `Error in ${toolName}: ${error.message}`,
        isError: true,
      }),
    }
  );

  // Start server
  await startMCPServer(server, SERVER_NAME);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
