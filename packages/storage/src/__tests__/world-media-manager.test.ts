/**
 * Tests for WorldMediaManager
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { WorldMediaManager } from "../managers/world-media-manager.js";
import type { MediaEntry } from "../schemas/media.js";

describe("WorldMediaManager", () => {
  let tempDir: string;
  let manager: WorldMediaManager;

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
    tempDir = await mkdtemp(join(tmpdir(), "storage-world-media-"));
    manager = new WorldMediaManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("save() + get()", () => {
    it("writes file and manifest entry", async () => {
      const entry = makeEntry({ id: "img-1" });
      await manager.save("pack-1", entry, testBuffer);
      const result = await manager.get("pack-1", "img-1");
      expect(result).not.toBeNull();
      expect(result!.entry.id).toBe("img-1");
      expect(result!.path).toBeTruthy();
    });

    it("returns null for nonexistent media", async () => {
      const result = await manager.get("pack-1", "nope");
      expect(result).toBeNull();
    });

    it("stores files under worlds/<packId>/media/", async () => {
      const entry = makeEntry({ id: "img-2", filename: "portrait.png" });
      const filePath = await manager.save("pack-abc", entry, testBuffer);
      expect(filePath).toContain("worlds");
      expect(filePath).toContain("pack-abc");
      expect(filePath).toContain("media");
      expect(filePath).toContain("portrait.png");
    });
  });

  describe("list()", () => {
    it("returns all entries for a pack", async () => {
      await manager.save("pack-1", makeEntry({ id: "a" }), testBuffer);
      await manager.save("pack-1", makeEntry({ id: "b", filename: "b.png" }), testBuffer);
      const entries = await manager.list("pack-1");
      expect(entries).toHaveLength(2);
      const ids = entries.map((e) => e.id);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
    });

    it("returns empty array for missing pack", async () => {
      const entries = await manager.list("nonexistent-pack");
      expect(entries).toEqual([]);
    });

    it("does not cross-contaminate between packs", async () => {
      await manager.save("pack-1", makeEntry({ id: "a" }), testBuffer);
      await manager.save("pack-2", makeEntry({ id: "b", filename: "b.png" }), testBuffer);
      const pack1Entries = await manager.list("pack-1");
      expect(pack1Entries).toHaveLength(1);
      expect(pack1Entries[0].id).toBe("a");
    });
  });

  describe("listByEntity()", () => {
    it("filters by entity type and ID", async () => {
      await manager.save(
        "pack-1",
        makeEntry({ id: "portrait", entityType: "npc", entityId: "npc-1" }),
        testBuffer
      );
      await manager.save(
        "pack-1",
        makeEntry({
          id: "scene",
          filename: "scene.png",
          entityType: "location",
          entityId: "loc-1",
        }),
        testBuffer
      );
      const results = await manager.listByEntity("pack-1", "npc", "npc-1");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("portrait");
    });

    it("returns empty array when no matches", async () => {
      await manager.save("pack-1", makeEntry({ entityType: "npc", entityId: "npc-1" }), testBuffer);
      const results = await manager.listByEntity("pack-1", "monster", "mon-1");
      expect(results).toEqual([]);
    });

    it("returns empty array for missing pack", async () => {
      const results = await manager.listByEntity("nonexistent-pack", "archetype", "arch-1");
      expect(results).toEqual([]);
    });
  });

  describe("delete()", () => {
    it("removes manifest entry after delete", async () => {
      await manager.save("pack-1", makeEntry({ id: "del-me" }), testBuffer);
      await manager.delete("pack-1", "del-me");
      const result = await manager.get("pack-1", "del-me");
      expect(result).toBeNull();
      const entries = await manager.list("pack-1");
      expect(entries.find((e) => e.id === "del-me")).toBeUndefined();
    });

    it("is idempotent for nonexistent media", async () => {
      await expect(manager.delete("pack-1", "nonexistent")).resolves.not.toThrow();
    });

    it("preserves other entries when deleting one", async () => {
      await manager.save("pack-1", makeEntry({ id: "keep" }), testBuffer);
      await manager.save("pack-1", makeEntry({ id: "remove", filename: "remove.png" }), testBuffer);
      await manager.delete("pack-1", "remove");
      const entries = await manager.list("pack-1");
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("keep");
    });
  });

  describe("replaceByRole()", () => {
    function entryWithRole(
      id: string,
      filename: string,
      role: "portrait" | "scene" | "icon" | "banner",
      overrides: Partial<MediaEntry> = {}
    ): MediaEntry {
      return makeEntry({
        id,
        filename,
        entityType: "npc",
        entityId: "captain-ravens",
        role,
        ...overrides,
      });
    }

    it("persists the new entry and sweeps prior same-role entries (manifest + files)", async () => {
      await manager.save(
        "pack-1",
        entryWithRole("old-1", "npc_captain-ravens_portrait_111.png", "portrait"),
        testBuffer
      );
      await manager.replaceByRole(
        "pack-1",
        entryWithRole("new", "npc_captain-ravens_portrait_222.png", "portrait"),
        testBuffer
      );

      const entries = await manager.listByEntity("pack-1", "npc", "captain-ravens");
      const portraits = entries.filter((e) => e.role === "portrait");
      expect(portraits).toHaveLength(1);
      expect(portraits[0].id).toBe("new");

      // The old file should be gone too — runtime reads via the manifest
      // but a leftover file would clutter the media dir.
      const { readdir } = await import("fs/promises");
      const files = (await readdir(join(tempDir, "worlds", "pack-1", "media"))).filter((f) =>
        f.endsWith(".png")
      );
      expect(files).toHaveLength(1);
      expect(files[0]).toBe("npc_captain-ravens_portrait_222.png");
    });

    it("preserves entries with the same entity but a different role", async () => {
      await manager.save(
        "pack-1",
        entryWithRole("portrait-old", "p_old.png", "portrait"),
        testBuffer
      );
      await manager.save("pack-1", entryWithRole("token-keep", "tok.png", "icon"), testBuffer);

      await manager.replaceByRole(
        "pack-1",
        entryWithRole("portrait-new", "p_new.png", "portrait"),
        testBuffer
      );

      const entries = await manager.listByEntity("pack-1", "npc", "captain-ravens");
      const ids = entries.map((e) => e.id).sort();
      expect(ids).toEqual(["portrait-new", "token-keep"]);
    });

    it("preserves same-role entries on a different entity", async () => {
      await manager.save(
        "pack-1",
        entryWithRole("a-portrait", "a.png", "portrait", { entityId: "alice" }),
        testBuffer
      );
      await manager.replaceByRole(
        "pack-1",
        entryWithRole("captain-portrait", "c.png", "portrait"),
        testBuffer
      );

      const all = await manager.list("pack-1");
      const ids = all.map((e) => e.id).sort();
      expect(ids).toEqual(["a-portrait", "captain-portrait"]);
    });

    it("serializes concurrent same-role writes — exactly one entry AND one file on disk", async () => {
      // The race CodeRabbit flagged: two replaceByRole calls land at
      // the same time. Without the lock, both snapshot a manifest with
      // 0 same-role entries, both append, the second write overwrites
      // the first. With the lock, one runs to completion before the
      // other starts and the final state has the LATER entry only.
      //
      // Asserts both manifest AND on-disk state — manifest alone
      // doesn't prove serialization (the file sweep could leak both
      // PNGs even with a clean manifest). The dir check makes this
      // test fail if the lock is removed.
      const callA = manager.replaceByRole(
        "pack-1",
        entryWithRole("first", "first.png", "portrait"),
        Buffer.from("a")
      );
      const callB = manager.replaceByRole(
        "pack-1",
        entryWithRole("second", "second.png", "portrait"),
        Buffer.from("b")
      );
      await Promise.all([callA, callB]);

      const portraits = (await manager.listByEntity("pack-1", "npc", "captain-ravens")).filter(
        (e) => e.role === "portrait"
      );
      expect(portraits).toHaveLength(1);
      // Either order is acceptable; both ids must NOT survive together.
      expect(["first", "second"]).toContain(portraits[0].id);

      const { readdir } = await import("fs/promises");
      const files = (await readdir(join(tempDir, "worlds", "pack-1", "media"))).filter((f) =>
        f.endsWith(".png")
      );
      // Exactly one PNG on disk and it matches the surviving manifest entry.
      expect(files).toEqual([portraits[0].filename]);
    });

    it("lock map releases entries after operations complete (no leak)", async () => {
      // Defense against the bug where withPackLock stored
      // `previous.then(() => next)` in the map but the cleanup branch
      // compared against a freshly-constructed promise from the same
      // expression — never equal, map entry leaks per call.
      await manager.replaceByRole(
        "pack-leak-1",
        entryWithRole("a", "a.png", "portrait"),
        testBuffer
      );
      await manager.replaceByRole(
        "pack-leak-2",
        entryWithRole("b", "b.png", "portrait"),
        testBuffer
      );
      // Reach into the private member via cast — this is a regression
      // guard, not a public API contract.
      const locks = (manager as unknown as { locks: Map<string, Promise<void>> }).locks;
      expect(locks.size).toBe(0);
    });

    it("a non-conflicting save() can interleave between two replaceByRole calls", async () => {
      // Lock is per-pack and per-call, not global. Save on pack-2 must
      // not block replaceByRole on pack-1.
      await Promise.all([
        manager.save("pack-2", makeEntry({ id: "p2", filename: "p2.png" }), testBuffer),
        manager.replaceByRole(
          "pack-1",
          entryWithRole("p1-portrait", "p1.png", "portrait"),
          testBuffer
        ),
      ]);
      const p1 = await manager.list("pack-1");
      const p2 = await manager.list("pack-2");
      expect(p1).toHaveLength(1);
      expect(p2).toHaveLength(1);
    });

    it("sweeps pending entries with the same role tuple when a canonical write lands", async () => {
      // A live regen mid-preview should discard the in-flight pending so
      // the user doesn't end up with a stale preview shadowing the new
      // canonical image.
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("preview", "preview.png", "portrait"),
        Buffer.from("preview")
      );
      await manager.replaceByRole(
        "pack-1",
        entryWithRole("live", "live.png", "portrait"),
        Buffer.from("live")
      );

      const all = await manager.listByEntity("pack-1", "npc", "captain-ravens", {
        includePending: true,
      });
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("live");
      expect(all[0].pending).toBeFalsy();

      const { readdir } = await import("fs/promises");
      const files = (await readdir(join(tempDir, "worlds", "pack-1", "media"))).filter((f) =>
        f.endsWith(".png")
      );
      expect(files).toEqual(["live.png"]);
    });
  });

  describe("pending entries", () => {
    function entryWithRole(
      id: string,
      filename: string,
      role: "portrait" | "scene" | "icon" | "banner",
      overrides: Partial<MediaEntry> = {}
    ): MediaEntry {
      return makeEntry({
        id,
        filename,
        entityType: "npc",
        entityId: "captain-ravens",
        role,
        ...overrides,
      });
    }

    it("saveAsPending stores entry with pending=true regardless of input flag", async () => {
      await manager.saveAsPending(
        "pack-1",
        // Caller-provided pending=false must be ignored — saveAsPending
        // is the only writer of pending entries and forces the flag.
        entryWithRole("p", "p.png", "portrait", { pending: false }),
        testBuffer
      );
      const got = await manager.getPending("pack-1", "npc", "captain-ravens", "portrait");
      expect(got).not.toBeNull();
      expect(got!.id).toBe("p");
      expect(got!.pending).toBe(true);
    });

    it("listByEntity excludes pending by default but includes them with includePending", async () => {
      await manager.save("pack-1", entryWithRole("live", "live.png", "portrait"), testBuffer);
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("preview", "preview.png", "portrait"),
        testBuffer
      );

      const defaultList = await manager.listByEntity("pack-1", "npc", "captain-ravens");
      expect(defaultList.map((e) => e.id)).toEqual(["live"]);

      const withPending = await manager.listByEntity("pack-1", "npc", "captain-ravens", {
        includePending: true,
      });
      expect(withPending.map((e) => e.id).sort()).toEqual(["live", "preview"]);
    });

    it("saveAsPending replaces a prior pending for the same role tuple", async () => {
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("first", "first.png", "portrait"),
        Buffer.from("a")
      );
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("second", "second.png", "portrait"),
        Buffer.from("b")
      );

      const all = await manager.listByEntity("pack-1", "npc", "captain-ravens", {
        includePending: true,
      });
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("second");

      const { readdir } = await import("fs/promises");
      const files = (await readdir(join(tempDir, "worlds", "pack-1", "media"))).filter((f) =>
        f.endsWith(".png")
      );
      expect(files).toEqual(["second.png"]);
    });

    it("saveAsPending leaves an existing canonical untouched", async () => {
      await manager.save("pack-1", entryWithRole("live", "live.png", "portrait"), testBuffer);
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("preview", "preview.png", "portrait"),
        testBuffer
      );

      const list = await manager.listByEntity("pack-1", "npc", "captain-ravens");
      expect(list.map((e) => e.id)).toEqual(["live"]);
    });

    it("promotePending swaps pending into canonical and sweeps prior canonical", async () => {
      await manager.save(
        "pack-1",
        entryWithRole("live-old", "live-old.png", "portrait"),
        Buffer.from("old")
      );
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("preview", "preview.png", "portrait"),
        Buffer.from("new")
      );
      const promoted = await manager.promotePending("pack-1", "npc", "captain-ravens", "portrait");
      expect(promoted).not.toBeNull();
      expect(promoted!.id).toBe("preview");
      expect(promoted!.pending).toBe(false);

      const list = await manager.listByEntity("pack-1", "npc", "captain-ravens");
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("preview");

      const { readdir } = await import("fs/promises");
      const files = (await readdir(join(tempDir, "worlds", "pack-1", "media"))).filter((f) =>
        f.endsWith(".png")
      );
      expect(files).toEqual(["preview.png"]);
    });

    it("promotePending returns null when no pending exists", async () => {
      const result = await manager.promotePending("pack-1", "npc", "captain-ravens", "portrait");
      expect(result).toBeNull();
    });

    it("discardPending removes the manifest entry and the file", async () => {
      await manager.save("pack-1", entryWithRole("live", "live.png", "portrait"), testBuffer);
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("preview", "preview.png", "portrait"),
        testBuffer
      );
      const discarded = await manager.discardPending("pack-1", "npc", "captain-ravens", "portrait");
      expect(discarded).toBe(true);

      const all = await manager.listByEntity("pack-1", "npc", "captain-ravens", {
        includePending: true,
      });
      expect(all.map((e) => e.id)).toEqual(["live"]);

      const { readdir } = await import("fs/promises");
      const files = (await readdir(join(tempDir, "worlds", "pack-1", "media"))).filter((f) =>
        f.endsWith(".png")
      );
      expect(files).toEqual(["live.png"]);
    });

    it("discardPending returns false when there is no pending", async () => {
      const discarded = await manager.discardPending("pack-1", "npc", "captain-ravens", "portrait");
      expect(discarded).toBe(false);
    });

    it("getPending isolates by role tuple", async () => {
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("portrait-preview", "p.png", "portrait"),
        testBuffer
      );
      await manager.saveAsPending(
        "pack-1",
        entryWithRole("scene-preview", "s.png", "scene"),
        testBuffer
      );

      const portrait = await manager.getPending("pack-1", "npc", "captain-ravens", "portrait");
      const scene = await manager.getPending("pack-1", "npc", "captain-ravens", "scene");
      const icon = await manager.getPending("pack-1", "npc", "captain-ravens", "icon");
      expect(portrait?.id).toBe("portrait-preview");
      expect(scene?.id).toBe("scene-preview");
      expect(icon).toBeNull();
    });
  });
});
