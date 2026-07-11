import { z } from "zod";

/**
 * Application configuration schema
 * Stored in <root>/config.json
 */
export const AppConfigSchema = z.object({
  /** API keys for LLM providers */
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      openai: z.string().optional(),
    })
    .optional(),

  /** User preferences */
  preferences: z
    .object({
      theme: z.enum(["light", "dark", "system"]).optional(),
      fontSize: z.number().min(8).max(32).optional(),
      autoSave: z.boolean().optional(),
    })
    .optional(),

  /** Window bounds (for Electron) */
  windowBounds: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      maximized: z.boolean().optional(),
    })
    .optional(),

  /** Last active session ID */
  lastSessionId: z.string().optional(),

  /** Last active world pack ID */
  lastWorldPackId: z.string().optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/** Default config when no file exists */
export const DEFAULT_CONFIG: AppConfig = {};
