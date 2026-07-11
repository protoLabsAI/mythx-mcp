/**
 * StorageRoot integration test
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createStorageRoot } from "../storage-root.js";
import { createTestSession, createTestWorldPack } from "./fixtures.js";
import type { GetRulesFunction } from "@mythxengine/types";

describe("createStorageRoot", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "storage-root-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a StorageRoot with all managers", () => {
    const storage = createStorageRoot(tempDir);
    expect(storage.rootDir).toBe(tempDir);
    expect(storage.sessions).toBeDefined();
    expect(storage.worldPacks).toBeDefined();
    expect(storage.generation).toBeDefined();
  });

  it("sessions and worldPacks work end-to-end", async () => {
    const storage = createStorageRoot(tempDir);

    // Session round-trip
    const session = createTestSession({ metadata: { id: "e2e-session" } });
    await storage.sessions.save(session);
    const loaded = await storage.sessions.get("e2e-session");
    expect(loaded).not.toBeNull();
    expect(loaded!.metadata.id).toBe("e2e-session");

    // World pack round-trip
    const pack = createTestWorldPack("e2e-world");
    await storage.worldPacks.save("e2e-world", pack);
    const loadedPack = await storage.worldPacks.get("e2e-world");
    expect(loadedPack).not.toBeNull();
  });

  it("toToolContext() returns a valid ToolContext", () => {
    const storage = createStorageRoot(tempDir);
    const mockGetRules: GetRulesFunction = async () => ({ rules: {} });
    const ctx = storage.toToolContext(mockGetRules);

    expect(ctx.sessions).toBe(storage.sessions);
    expect(ctx.worldPacks).toBe(storage.worldPacks);
    expect(ctx.getRules).toBe(mockGetRules);
    expect(ctx.eventBus).toBeDefined();
    // eventBus should be the nullEventBus by default
    expect(ctx.eventBus.publish).toBeTypeOf("function");
  });

  it("toToolContext() accepts a custom eventBus", () => {
    const storage = createStorageRoot(tempDir);
    const mockGetRules: GetRulesFunction = async () => ({ rules: {} });
    const mockEventBus = {
      publish: () => {},
      subscribe: () => () => {},
      psubscribe: () => () => {},
    };
    const ctx = storage.toToolContext(mockGetRules, mockEventBus);
    expect(ctx.eventBus).toBe(mockEventBus);
  });
});
