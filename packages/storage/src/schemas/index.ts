import { z } from "zod";

export * from "./config.js";
export * from "./chat.js";
export * from "./media.js";

/**
 * Session index entry — stored in sessions/index.json
 */
export const SessionIndexEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  worldPackId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SessionIndexEntry = z.infer<typeof SessionIndexEntrySchema>;

export const SessionIndexSchema = z.array(SessionIndexEntrySchema);
export type SessionIndex = z.infer<typeof SessionIndexSchema>;

/**
 * World pack index entry — stored in worlds/index.json
 */
export const WorldIndexEntrySchema = z.object({
  packId: z.string(),
  name: z.string(),
  tier: z.enum(["small", "medium", "large"]).optional(),
  status: z.string().optional(),
  createdAt: z.string(),
});

export type WorldIndexEntry = z.infer<typeof WorldIndexEntrySchema>;

export const WorldIndexSchema = z.array(WorldIndexEntrySchema);
export type WorldIndex = z.infer<typeof WorldIndexSchema>;
