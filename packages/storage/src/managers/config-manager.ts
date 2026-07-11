/**
 * File-based config manager
 *
 * Single file at <root>/config.json with Zod validation.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import type { AppConfig } from "../schemas/config.js";
import { AppConfigSchema, DEFAULT_CONFIG } from "../schemas/config.js";
import { atomicWriteJSON } from "../utils/atomic-write.js";

export class FileConfigManager {
  private configPath: string;

  constructor(rootDir: string) {
    this.configPath = join(rootDir, "config.json");
  }

  async get(): Promise<AppConfig> {
    try {
      const content = await readFile(this.configPath, "utf-8");
      return AppConfigSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...DEFAULT_CONFIG };
      }
      throw error;
    }
  }

  async set(config: AppConfig): Promise<void> {
    const validated = AppConfigSchema.parse(config);
    await atomicWriteJSON(this.configPath, validated);
  }

  async patch(partial: Partial<AppConfig>): Promise<void> {
    const current = await this.get();
    const merged = { ...current, ...partial };
    await this.set(merged);
  }
}
