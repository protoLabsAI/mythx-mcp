import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { appendJSONL, readJSONL, readRecentJSONL, countJSONL, clearJSONL } from "../utils/jsonl.js";

describe("JSONL utilities", () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "storage-jsonl-"));
    filePath = join(tempDir, "test.jsonl");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("appendJSONL + readJSONL", () => {
    it("appends and reads a single record", async () => {
      await appendJSONL(filePath, { id: 1, text: "hello" });
      const records = await readJSONL<{ id: number; text: string }>(filePath);
      expect(records).toEqual([{ id: 1, text: "hello" }]);
    });

    it("appends multiple records in order", async () => {
      await appendJSONL(filePath, { n: 1 });
      await appendJSONL(filePath, { n: 2 });
      await appendJSONL(filePath, { n: 3 });
      const records = await readJSONL<{ n: number }>(filePath);
      expect(records).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    });

    it("returns empty array for nonexistent file", async () => {
      const records = await readJSONL(join(tempDir, "nope.jsonl"));
      expect(records).toEqual([]);
    });

    it("creates parent directories", async () => {
      const nested = join(tempDir, "a", "b", "data.jsonl");
      await appendJSONL(nested, { x: true });
      const records = await readJSONL<{ x: boolean }>(nested);
      expect(records).toEqual([{ x: true }]);
    });
  });

  describe("readRecentJSONL", () => {
    it("returns last N records", async () => {
      for (let i = 1; i <= 5; i++) {
        await appendJSONL(filePath, { n: i });
      }
      const recent = await readRecentJSONL<{ n: number }>(filePath, 2);
      expect(recent).toEqual([{ n: 4 }, { n: 5 }]);
    });

    it("returns all if fewer than N records exist", async () => {
      await appendJSONL(filePath, { n: 1 });
      const recent = await readRecentJSONL<{ n: number }>(filePath, 10);
      expect(recent).toEqual([{ n: 1 }]);
    });

    it("returns empty for nonexistent file", async () => {
      const recent = await readRecentJSONL(join(tempDir, "nope.jsonl"), 5);
      expect(recent).toEqual([]);
    });
  });

  describe("countJSONL", () => {
    it("returns 0 for nonexistent file", async () => {
      expect(await countJSONL(join(tempDir, "nope.jsonl"))).toBe(0);
    });

    it("counts records correctly", async () => {
      await appendJSONL(filePath, { a: 1 });
      await appendJSONL(filePath, { a: 2 });
      await appendJSONL(filePath, { a: 3 });
      expect(await countJSONL(filePath)).toBe(3);
    });
  });

  describe("clearJSONL", () => {
    it("removes all records", async () => {
      await appendJSONL(filePath, { a: 1 });
      await appendJSONL(filePath, { a: 2 });
      await clearJSONL(filePath);
      expect(await readJSONL(filePath)).toEqual([]);
      expect(await countJSONL(filePath)).toBe(0);
    });

    it("works on nonexistent file (creates empty)", async () => {
      const newFile = join(tempDir, "fresh.jsonl");
      await clearJSONL(newFile);
      expect(await readJSONL(newFile)).toEqual([]);
    });
  });
});
