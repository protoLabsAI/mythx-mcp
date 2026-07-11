/**
 * MCP Server factory
 * Adapted from rogue-borg shared-mcp-server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { MCPToolRegistry } from "@mythxengine/types";

export interface MCPServerConfig {
  name: string;
  version: string;
}

export interface ResourceHandler {
  list: () => Promise<Array<{ uri: string; name: string; mimeType?: string }>>;
  read: (
    uri: string
  ) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;
}

export interface MCPServerOptions {
  tools: MCPToolRegistry;
  resources?: ResourceHandler;
  onError?: (error: Error, toolName: string) => { message: string; isError: boolean };
}

/**
 * Create an MCP server with the given tools
 */
export function createMCPServer(config: MCPServerConfig, options: MCPServerOptions): Server {
  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
        resources: options.resources ? {} : undefined,
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Array.from(options.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = options.tools.get(toolName);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      const args = request.params.arguments || {};
      const result = await tool.handler(args);

      // If result already has content field, return as-is
      if (result && typeof result === "object" && "content" in result) {
        return result;
      }

      // Wrap result in standard MCP format
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (options.onError) {
        const customError = options.onError(
          error instanceof Error ? error : new Error(String(error)),
          toolName
        );
        return {
          content: [{ type: "text", text: customError.message }],
          isError: customError.isError,
        };
      }

      return {
        content: [{ type: "text", text: `Error: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  // Resource handlers (if provided)
  if (options.resources) {
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await options.resources!.list();
      return { resources };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const result = await options.resources!.read(request.params.uri);
      return result;
    });
  }

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
export async function startMCPServer(server: Server, serverName: string): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${serverName} MCP Server running on stdio`);
}
