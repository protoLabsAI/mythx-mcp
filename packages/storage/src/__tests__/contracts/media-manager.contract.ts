/**
 * Media Manager Contract Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { MediaEntry } from "../../schemas/media.js";

export interface IMediaManager {
  save(sessionId: string, entry: MediaEntry, data: Buffer): Promise<string>;
  get(sessionId: string, mediaId: string): Promise<{ entry: MediaEntry; path: string } | null>;
  list(sessionId: string): Promise<MediaEntry[]>;
  listByEntity(sessionId: string, entityType: string, entityId: string): Promise<MediaEntry[]>;
  delete(sessionId: string, mediaId: string): Promise<void>;
}

export interface MediaManagerFactory {
  create(): Promise<IMediaManager>;
  cleanup(): Promise<void>;
}

export function mediaManagerContractTests(factory: MediaManagerFactory): void {
  let manager: IMediaManager;

  const testBuffer = Buffer.from("fake-image-data");

  function makeEntry(overrides: Partial<MediaEntry> = {}): MediaEntry {
    return {
      id: overrides.id ?? "media-1",
      filename: overrides.filename ?? "test.png",
      mimeType: overrides.mimeType ?? "image/png",
      createdAt: overrides.createdAt ?? new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    manager = await factory.create();
  });

  describe("save() + get()", () => {
    it("writes file and manifest entry", async () => {
      const entry = makeEntry({ id: "img-1" });
      await manager.save("session-1", entry, testBuffer);
      const result = await manager.get("session-1", "img-1");
      expect(result).not.toBeNull();
      expect(result!.entry.id).toBe("img-1");
      expect(result!.path).toBeTruthy();
    });

    it("returns null for nonexistent media", async () => {
      const result = await manager.get("session-1", "nope");
      expect(result).toBeNull();
    });
  });

  describe("list()", () => {
    it("returns all entries", async () => {
      await manager.save("session-1", makeEntry({ id: "a" }), testBuffer);
      await manager.save("session-1", makeEntry({ id: "b", filename: "b.png" }), testBuffer);
      const entries = await manager.list("session-1");
      expect(entries).toHaveLength(2);
      const ids = entries.map((e) => e.id);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
    });

    it("returns empty for session with no media", async () => {
      const entries = await manager.list("nonexistent");
      expect(entries).toEqual([]);
    });
  });

  describe("listByEntity()", () => {
    it("filters by entity type and ID", async () => {
      await manager.save(
        "session-1",
        makeEntry({ id: "portrait", entityType: "character", entityId: "char-1" }),
        testBuffer
      );
      await manager.save(
        "session-1",
        makeEntry({
          id: "scene",
          filename: "scene.png",
          entityType: "location",
          entityId: "loc-1",
        }),
        testBuffer
      );
      const results = await manager.listByEntity("session-1", "character", "char-1");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("portrait");
    });

    it("returns empty when no matches", async () => {
      await manager.save(
        "session-1",
        makeEntry({ entityType: "character", entityId: "char-1" }),
        testBuffer
      );
      const results = await manager.listByEntity("session-1", "monster", "mon-1");
      expect(results).toEqual([]);
    });
  });

  describe("delete()", () => {
    it("removes file and manifest entry", async () => {
      await manager.save("session-1", makeEntry({ id: "del-me" }), testBuffer);
      await manager.delete("session-1", "del-me");
      const result = await manager.get("session-1", "del-me");
      expect(result).toBeNull();
      const entries = await manager.list("session-1");
      expect(entries.find((e) => e.id === "del-me")).toBeUndefined();
    });

    it("is idempotent", async () => {
      await expect(manager.delete("session-1", "nonexistent")).resolves.not.toThrow();
    });
  });
}
