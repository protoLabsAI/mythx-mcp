/**
 * World Pack Management Tools
 *
 * List, load, and delete world packs.
 */

import { z } from "zod";
import type { MCPToolEntry } from "@mythxengine/types";
import { worldPackManager } from "../../state/worldpacks.js";

const LoadWorldPackInput = z.object({
  packId: z.string(),
});

const DeleteWorldPackInput = z.object({
  packId: z.string(),
});

/**
 * list_world_packs tool
 */
export const listWorldPacksTool: MCPToolEntry = {
  name: "list_world_packs",
  description: "List all saved world packs.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    const packIds = await worldPackManager.list();

    const packs = await Promise.all(
      packIds.map(async (id) => {
        const pack = await worldPackManager.get(id);
        if (!pack) return null;
        return {
          id: pack.meta.id,
          name: pack.meta.name,
          tagline: pack.meta.tagline,
          contentCounts: {
            archetypes: Object.keys(pack.archetypes).length,
            monsters: Object.keys(pack.monsters).length,
            items: Object.keys(pack.items).length,
            encounters: Object.keys(pack.encounters).length,
            locations: Object.keys(pack.locations).length,
            npcs: Object.keys(pack.npcs).length,
          },
        };
      })
    );

    return {
      count: packs.filter(Boolean).length,
      packs: packs.filter(Boolean),
    };
  },
};

/**
 * load_world_pack tool
 */
export const loadWorldPackTool: MCPToolEntry = {
  name: "load_world_pack",
  description: "Load a saved world pack by ID.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID to load" },
    },
    required: ["packId"],
  },
  handler: async (args: unknown) => {
    const input = LoadWorldPackInput.parse(args);

    const pack = await worldPackManager.get(input.packId);
    if (!pack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    return {
      pack,
    };
  },
};

/**
 * delete_world_pack tool
 */
export const deleteWorldPackTool: MCPToolEntry = {
  name: "delete_world_pack",
  description: "Delete a saved world pack.",
  inputSchema: {
    type: "object",
    properties: {
      packId: { type: "string", description: "Pack ID to delete" },
    },
    required: ["packId"],
  },
  handler: async (args: unknown) => {
    const input = DeleteWorldPackInput.parse(args);

    const pack = await worldPackManager.get(input.packId);
    if (!pack) {
      throw new Error(`World pack not found: ${input.packId}`);
    }

    await worldPackManager.delete(input.packId);

    return {
      message: `World pack deleted: ${pack.meta.name}`,
      packId: input.packId,
    };
  },
};

export const manageTools = [listWorldPacksTool, loadWorldPackTool, deleteWorldPackTool];
