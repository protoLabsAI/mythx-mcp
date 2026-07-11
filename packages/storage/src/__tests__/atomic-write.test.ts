import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { atomicWriteFile, atomicWriteJSON } from "../utils/atomic-write.js";

describe("atomicWriteFile", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "storage-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes a file that can be read back", async () => {
    const filePath = join(tempDir, "test.txt");
    await atomicWriteFile(filePath, "hello world");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("hello world");
  });

  it("creates parent directories if they don't exist", async () => {
    const filePath = join(tempDir, "a", "b", "c", "test.txt");
    await atomicWriteFile(filePath, "nested");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("nested");
  });

  it("overwrites existing file", async () => {
    const filePath = join(tempDir, "test.txt");
    await atomicWriteFile(filePath, "first");
    await atomicWriteFile(filePath, "second");
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("second");
  });

  it("leaves no temp files on success", async () => {
    const filePath = join(tempDir, "test.txt");
    await atomicWriteFile(filePath, "clean");
    const { readdir } = await import("fs/promises");
    const files = await readdir(tempDir);
    expect(files).toEqual(["test.txt"]);
  });
});

describe("atomicWriteJSON", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "storage-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes valid JSON", async () => {
    const filePath = join(tempDir, "data.json");
    const data = { name: "test", count: 42, nested: { a: true } };
    await atomicWriteJSON(filePath, data);
    const content = await readFile(filePath, "utf-8");
    expect(JSON.parse(content)).toEqual(data);
  });

  it("pretty-prints with 2-space indent", async () => {
    const filePath = join(tempDir, "data.json");
    await atomicWriteJSON(filePath, { a: 1 });
    const content = await readFile(filePath, "utf-8");
    expect(content).toBe(JSON.stringify({ a: 1 }, null, 2));
  });
});
