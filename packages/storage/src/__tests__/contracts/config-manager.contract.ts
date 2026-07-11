/**
 * Config Manager Contract Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { AppConfig } from "../../schemas/config.js";

export interface IConfigManager {
  get(): Promise<AppConfig>;
  set(config: AppConfig): Promise<void>;
  patch(partial: Partial<AppConfig>): Promise<void>;
}

export interface ConfigManagerFactory {
  create(): Promise<IConfigManager>;
  cleanup(): Promise<void>;
}

export function configManagerContractTests(factory: ConfigManagerFactory): void {
  let manager: IConfigManager;

  beforeEach(async () => {
    manager = await factory.create();
  });

  describe("get()", () => {
    it("returns defaults when no file exists", async () => {
      const config = await manager.get();
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    });
  });

  describe("set() + get()", () => {
    it("persists and returns updated config", async () => {
      const config: AppConfig = {
        apiKeys: { anthropic: "sk-test" },
        preferences: { theme: "dark" },
        lastSessionId: "session-1",
      };
      await manager.set(config);
      const loaded = await manager.get();
      expect(loaded.apiKeys?.anthropic).toBe("sk-test");
      expect(loaded.preferences?.theme).toBe("dark");
      expect(loaded.lastSessionId).toBe("session-1");
    });

    it("overwrites entire config", async () => {
      await manager.set({
        apiKeys: { anthropic: "key-1" },
        preferences: { theme: "dark", autoSave: true },
      });
      await manager.set({
        preferences: { theme: "light" },
      });
      const loaded = await manager.get();
      // apiKeys should be gone since we replaced the whole config
      expect(loaded.apiKeys).toBeUndefined();
      expect(loaded.preferences?.theme).toBe("light");
      expect(loaded.preferences?.autoSave).toBeUndefined();
    });
  });

  describe("patch()", () => {
    it("merges without losing other fields", async () => {
      await manager.set({
        apiKeys: { anthropic: "sk-keep" },
        preferences: { theme: "dark" },
      });
      await manager.patch({ lastSessionId: "new-session" });
      const loaded = await manager.get();
      expect(loaded.apiKeys?.anthropic).toBe("sk-keep");
      expect(loaded.preferences?.theme).toBe("dark");
      expect(loaded.lastSessionId).toBe("new-session");
    });

    it("overwrites patched fields", async () => {
      await manager.set({ preferences: { theme: "dark" } });
      await manager.patch({ preferences: { theme: "light" } });
      const loaded = await manager.get();
      expect(loaded.preferences?.theme).toBe("light");
    });
  });

  describe("validation", () => {
    it("handles missing optional fields gracefully", async () => {
      await manager.set({});
      const loaded = await manager.get();
      expect(loaded).toBeDefined();
      expect(loaded.apiKeys).toBeUndefined();
      expect(loaded.preferences).toBeUndefined();
    });
  });
}
