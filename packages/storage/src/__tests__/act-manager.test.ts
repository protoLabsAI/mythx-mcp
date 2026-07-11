/**
 * ActManager tests — in-memory SQLite
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabase, type Database } from "../sqlite/connection.js";
import { initializeSchema } from "../sqlite/schema.js";
import { ActManager } from "../managers/act-manager.js";

const SESSION_ID = "session-test-001";

describe("ActManager", () => {
  let db: Database;
  let manager: ActManager;

  beforeEach(() => {
    db = createDatabase(":memory:");
    initializeSchema(db);
    // Insert a minimal sessions row so FK constraints are satisfied
    db.prepare(
      "INSERT INTO sessions (id, name, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run(SESSION_ID, "Test Session", "{}", new Date().toISOString(), new Date().toISOString());
    manager = new ActManager(db);
  });

  afterEach(() => {
    db.close();
  });

  // ---------------------------------------------------------------------------
  // openFirstAct
  // ---------------------------------------------------------------------------
  describe("openFirstAct", () => {
    it("creates act 1 with correct defaults", async () => {
      const act = await manager.openFirstAct(SESSION_ID);

      expect(act.id).toMatch(/^act-/);
      expect(act.sessionId).toBe(SESSION_ID);
      expect(act.actNumber).toBe(1);
      expect(act.status).toBe("active");
      expect(act.summaryStatus).toBe("none");
      expect(act.messages).toEqual([]);
      expect(act.messageCount).toBe(0);
      expect(act.openedAt).toBeTruthy();
      expect(act.closedAt).toBeUndefined();
    });

    it("is idempotent — returns existing act on second call", async () => {
      const first = await manager.openFirstAct(SESSION_ID);
      const second = await manager.openFirstAct(SESSION_ID);

      expect(second.id).toBe(first.id);
      expect(second.actNumber).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getActiveAct
  // ---------------------------------------------------------------------------
  describe("getActiveAct", () => {
    it("returns null when no acts exist", async () => {
      const result = await manager.getActiveAct(SESSION_ID);
      expect(result).toBeNull();
    });

    it("returns the active act after creation", async () => {
      await manager.openFirstAct(SESSION_ID);
      const active = await manager.getActiveAct(SESSION_ID);

      expect(active).not.toBeNull();
      expect(active!.actNumber).toBe(1);
      expect(active!.status).toBe("active");
    });

    it("returns null after the only act is closed (before next act is opened separately)", async () => {
      // closeAct always opens the next act, so this verifies the NEW act is active
      await manager.openFirstAct(SESSION_ID);
      const { opened } = await manager.closeAct(SESSION_ID, { summary: "Done" });
      const active = await manager.getActiveAct(SESSION_ID);

      expect(active).not.toBeNull();
      expect(active!.id).toBe(opened.id);
      expect(active!.actNumber).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getOrCreateActiveAct
  // ---------------------------------------------------------------------------
  describe("getOrCreateActiveAct", () => {
    it("creates act 1 when no acts exist", async () => {
      const act = await manager.getOrCreateActiveAct(SESSION_ID);
      expect(act.actNumber).toBe(1);
      expect(act.status).toBe("active");
    });

    it("returns existing active act without creating a duplicate", async () => {
      const first = await manager.openFirstAct(SESSION_ID);
      const second = await manager.getOrCreateActiveAct(SESSION_ID);

      expect(second.id).toBe(first.id);
    });
  });

  // ---------------------------------------------------------------------------
  // saveActiveMessages
  // ---------------------------------------------------------------------------
  describe("saveActiveMessages", () => {
    it("saves messages into the active act", async () => {
      await manager.openFirstAct(SESSION_ID);

      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "World" },
      ];
      await manager.saveActiveMessages(SESSION_ID, messages);

      const act = await manager.getAct(SESSION_ID, 1);
      expect(act!.messages).toEqual(messages);
      expect(act!.messageCount).toBe(2);
    });

    it("overwrites previously saved messages", async () => {
      await manager.openFirstAct(SESSION_ID);
      await manager.saveActiveMessages(SESSION_ID, [{ role: "user", content: "Hello" }]);
      await manager.saveActiveMessages(SESSION_ID, [{ role: "user", content: "Updated" }]);

      const act = await manager.getAct(SESSION_ID, 1);
      expect(act!.messageCount).toBe(1);
      expect((act!.messages[0] as { content: string }).content).toBe("Updated");
    });

    it("throws when no active act exists", async () => {
      await expect(
        manager.saveActiveMessages(SESSION_ID, [{ role: "user", content: "Hi" }])
      ).rejects.toThrow(/no active act/i);
    });
  });

  // ---------------------------------------------------------------------------
  // closeAct
  // ---------------------------------------------------------------------------
  describe("closeAct", () => {
    it("closes the active act and opens the next one", async () => {
      await manager.openFirstAct(SESSION_ID);
      const { closed, opened } = await manager.closeAct(SESSION_ID, {
        title: "The Beginning",
        summary: "Act 1 summary",
        keyEvents: ["Met the hero", "Found the map"],
      });

      expect(closed.actNumber).toBe(1);
      expect(closed.status).toBe("closed");
      expect(closed.summaryStatus).toBe("pending");
      expect(closed.title).toBe("The Beginning");
      expect(closed.summary).toBe("Act 1 summary");
      expect(closed.keyEvents).toEqual(["Met the hero", "Found the map"]);
      expect(closed.closedAt).toBeTruthy();

      expect(opened.actNumber).toBe(2);
      expect(opened.status).toBe("active");
      expect(opened.messages).toEqual([]);
    });

    it("works without optional title and keyEvents", async () => {
      await manager.openFirstAct(SESSION_ID);
      const { closed } = await manager.closeAct(SESSION_ID, { summary: "Minimal close" });

      expect(closed.title).toBeUndefined();
      expect(closed.keyEvents).toBeUndefined();
      expect(closed.summary).toBe("Minimal close");
    });

    it("throws when no active act exists", async () => {
      await expect(manager.closeAct(SESSION_ID, { summary: "Nothing to close" })).rejects.toThrow(
        /no active act/i
      );
    });

    it("handles multiple close cycles correctly", async () => {
      await manager.openFirstAct(SESSION_ID);
      const r1 = await manager.closeAct(SESSION_ID, { summary: "Act 1 done" });
      const r2 = await manager.closeAct(SESSION_ID, { summary: "Act 2 done" });

      expect(r1.closed.actNumber).toBe(1);
      expect(r1.opened.actNumber).toBe(2);
      expect(r2.closed.actNumber).toBe(2);
      expect(r2.opened.actNumber).toBe(3);

      const active = await manager.getActiveAct(SESSION_ID);
      expect(active!.actNumber).toBe(3);
    });

    it("allows closing an act with fewer than 2 messages", async () => {
      await manager.openFirstAct(SESSION_ID);
      // No messages saved — should still close
      await expect(manager.closeAct(SESSION_ID, { summary: "Empty act" })).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getActSummaries
  // ---------------------------------------------------------------------------
  describe("getActSummaries", () => {
    it("returns empty array when no acts exist", async () => {
      const summaries = await manager.getActSummaries(SESSION_ID);
      expect(summaries).toEqual([]);
    });

    it("returns summaries ordered by act_number", async () => {
      await manager.openFirstAct(SESSION_ID);
      await manager.closeAct(SESSION_ID, { summary: "Act 1 done" });
      await manager.closeAct(SESSION_ID, { summary: "Act 2 done" });

      const summaries = await manager.getActSummaries(SESSION_ID);
      expect(summaries).toHaveLength(3);
      expect(summaries[0].actNumber).toBe(1);
      expect(summaries[1].actNumber).toBe(2);
      expect(summaries[2].actNumber).toBe(3);
    });

    it("does not include the messages field", async () => {
      await manager.openFirstAct(SESSION_ID);
      await manager.saveActiveMessages(SESSION_ID, [{ role: "user", content: "Hi" }]);

      const summaries = await manager.getActSummaries(SESSION_ID);
      expect(summaries[0]).not.toHaveProperty("messages");
    });

    it("includes correct statuses", async () => {
      await manager.openFirstAct(SESSION_ID);
      await manager.closeAct(SESSION_ID, { summary: "Closed" });

      const summaries = await manager.getActSummaries(SESSION_ID);
      expect(summaries[0].status).toBe("closed");
      expect(summaries[1].status).toBe("active");
    });
  });

  // ---------------------------------------------------------------------------
  // getAct
  // ---------------------------------------------------------------------------
  describe("getAct", () => {
    it("returns null for a non-existent act number", async () => {
      const act = await manager.getAct(SESSION_ID, 99);
      expect(act).toBeNull();
    });

    it("returns the full act with messages", async () => {
      await manager.openFirstAct(SESSION_ID);
      const messages = [{ role: "user", content: "Test" }];
      await manager.saveActiveMessages(SESSION_ID, messages);

      const act = await manager.getAct(SESSION_ID, 1);
      expect(act).not.toBeNull();
      expect(act!.messages).toEqual(messages);
      expect(act!.messageCount).toBe(1);
    });

    it("returns the correct act by number", async () => {
      await manager.openFirstAct(SESSION_ID);
      await manager.closeAct(SESSION_ID, { summary: "One" });

      const act1 = await manager.getAct(SESSION_ID, 1);
      const act2 = await manager.getAct(SESSION_ID, 2);

      expect(act1!.status).toBe("closed");
      expect(act2!.status).toBe("active");
    });
  });

  // ---------------------------------------------------------------------------
  // updateActSummary
  // ---------------------------------------------------------------------------
  describe("updateActSummary", () => {
    it("updates summary fields on a closed act", async () => {
      await manager.openFirstAct(SESSION_ID);
      const { closed } = await manager.closeAct(SESSION_ID, { summary: "Initial" });

      await manager.updateActSummary(closed.actNumber, SESSION_ID, {
        title: "New Title",
        summary: "Updated summary",
        keyEvents: ["Event A"],
        summaryStatus: "complete",
      });

      const updated = await manager.getAct(SESSION_ID, 1);
      expect(updated!.title).toBe("New Title");
      expect(updated!.summary).toBe("Updated summary");
      expect(updated!.keyEvents).toEqual(["Event A"]);
      expect(updated!.summaryStatus).toBe("complete");
    });

    it("only updates provided fields, leaving others unchanged", async () => {
      await manager.openFirstAct(SESSION_ID);
      await manager.closeAct(SESSION_ID, {
        title: "Original Title",
        summary: "Original Summary",
      });

      await manager.updateActSummary(1, SESSION_ID, { summaryStatus: "complete" });

      const act = await manager.getAct(SESSION_ID, 1);
      expect(act!.title).toBe("Original Title");
      expect(act!.summary).toBe("Original Summary");
      expect(act!.summaryStatus).toBe("complete");
    });

    it("can set summaryStatus to failed", async () => {
      await manager.openFirstAct(SESSION_ID);
      await manager.closeAct(SESSION_ID, { summary: "Done" });

      await manager.updateActSummary(1, SESSION_ID, { summaryStatus: "failed" });

      const act = await manager.getAct(SESSION_ID, 1);
      expect(act!.summaryStatus).toBe("failed");
    });
  });
});
