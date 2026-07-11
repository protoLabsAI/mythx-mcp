/**
 * ActManager — SQLite-backed manager for narrative act storage.
 *
 * Acts chunk chat history by narrative arc. Each session has one active act
 * at a time. Closing an act automatically opens the next one.
 */

import { randomUUID } from "crypto";
import type { Database, Statement } from "../sqlite/connection.js";

export type SummaryStatus = "none" | "pending" | "complete" | "failed";

export interface Act {
  id: string;
  sessionId: string;
  actNumber: number;
  title?: string;
  summary?: string;
  summaryStatus: SummaryStatus;
  keyEvents?: string[];
  messages: unknown[]; // UIMessage[] but storage layer stays loosely typed
  messageCount: number;
  status: "active" | "closed";
  openedAt: string;
  closedAt?: string;
}

export interface ActSummary {
  id: string;
  actNumber: number;
  title?: string;
  summary?: string;
  summaryStatus: SummaryStatus;
  keyEvents?: string[];
  messageCount: number;
  status: "active" | "closed";
  openedAt: string;
  closedAt?: string;
}

export interface CloseActOptions {
  title?: string;
  summary: string;
  keyEvents?: string[];
}

// Raw row shape from SQLite
interface ActRow {
  id: string;
  session_id: string;
  act_number: number;
  title: string | null;
  summary: string | null;
  summary_status: string;
  key_events: string | null;
  messages: string;
  message_count: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

interface ActSummaryRow {
  id: string;
  session_id: string;
  act_number: number;
  title: string | null;
  summary: string | null;
  summary_status: string;
  key_events: string | null;
  message_count: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

function safeJsonParse<T>(json: string, fallback: T, context: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    console.error(`[ActManager] Corrupted JSON in ${context}:`, err);
    return fallback;
  }
}

function rowToAct(row: ActRow): Act {
  return {
    id: row.id,
    sessionId: row.session_id,
    actNumber: row.act_number,
    title: row.title ?? undefined,
    summary: row.summary ?? undefined,
    summaryStatus: row.summary_status as SummaryStatus,
    keyEvents: row.key_events
      ? safeJsonParse<string[]>(row.key_events, [], `act ${row.id} key_events`)
      : undefined,
    messages: safeJsonParse<unknown[]>(row.messages, [], `act ${row.id} messages`),
    messageCount: row.message_count,
    status: row.status as "active" | "closed",
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
  };
}

function rowToActSummary(row: ActSummaryRow): ActSummary {
  return {
    id: row.id,
    actNumber: row.act_number,
    title: row.title ?? undefined,
    summary: row.summary ?? undefined,
    summaryStatus: row.summary_status as SummaryStatus,
    keyEvents: row.key_events
      ? safeJsonParse<string[]>(row.key_events, [], `act ${row.id} key_events`)
      : undefined,
    messageCount: row.message_count,
    status: row.status as "active" | "closed",
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
  };
}

export class ActManager {
  private db: Database;
  private stmts: {
    getActive: Statement;
    getByNumber: Statement;
    insert: Statement;
    updateMessages: Statement;
    closeAct: Statement;
    getSummaries: Statement;
    updateSummary: Statement;
    maxActNumber: Statement;
  };

  constructor(db: Database) {
    this.db = db;
    this.stmts = {
      getActive: db.prepare(`
        SELECT * FROM acts
        WHERE session_id = ? AND status = 'active'
        LIMIT 1
      `),
      getByNumber: db.prepare(`
        SELECT * FROM acts
        WHERE session_id = ? AND act_number = ?
        LIMIT 1
      `),
      insert: db.prepare(`
        INSERT INTO acts (id, session_id, act_number, messages, message_count, status, opened_at)
        VALUES (?, ?, ?, '[]', 0, 'active', ?)
      `),
      updateMessages: db.prepare(`
        UPDATE acts
        SET messages = ?, message_count = ?
        WHERE session_id = ? AND status = 'active'
      `),
      closeAct: db.prepare(`
        UPDATE acts
        SET status = 'closed',
            summary_status = 'pending',
            title = ?,
            summary = ?,
            key_events = ?,
            closed_at = ?
        WHERE session_id = ? AND status = 'active'
      `),
      getSummaries: db.prepare(`
        SELECT id, session_id, act_number, title, summary, summary_status, key_events,
               message_count, status, opened_at, closed_at
        FROM acts
        WHERE session_id = ?
        ORDER BY act_number ASC
      `),
      updateSummary: db.prepare(`
        UPDATE acts
        SET title = COALESCE(?, title),
            summary = COALESCE(?, summary),
            key_events = COALESCE(?, key_events),
            summary_status = COALESCE(?, summary_status)
        WHERE act_number = ? AND session_id = ?
      `),
      maxActNumber: db.prepare(`
        SELECT COALESCE(MAX(act_number), 0) AS max_num
        FROM acts
        WHERE session_id = ?
      `),
    };
  }

  /**
   * Opens act 1 for a session. Idempotent — returns the existing act if already present.
   */
  async openFirstAct(sessionId: string): Promise<Act> {
    const existing = this.stmts.getByNumber.get(sessionId, 1) as ActRow | undefined;
    if (existing) return rowToAct(existing);

    const id = `act-${randomUUID()}`;
    const now = new Date().toISOString();
    try {
      this.stmts.insert.run(id, sessionId, 1, now);
    } catch (err) {
      // Handle race condition: another call created act 1 between our check and insert
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        const row = this.stmts.getByNumber.get(sessionId, 1) as ActRow;
        return rowToAct(row);
      }
      throw err;
    }

    const row = this.stmts.getByNumber.get(sessionId, 1) as ActRow;
    return rowToAct(row);
  }

  /**
   * Returns the currently active act for a session, or null if none exists.
   */
  async getActiveAct(sessionId: string): Promise<Act | null> {
    const row = this.stmts.getActive.get(sessionId) as ActRow | undefined;
    return row ? rowToAct(row) : null;
  }

  /**
   * Returns the active act, creating act 1 if no acts exist yet.
   */
  async getOrCreateActiveAct(sessionId: string): Promise<Act> {
    const active = await this.getActiveAct(sessionId);
    if (active) return active;

    return this.openFirstAct(sessionId);
  }

  /**
   * Upserts messages into the active act. Throws if no active act exists.
   */
  async saveActiveMessages(sessionId: string, messages: unknown[]): Promise<void> {
    const active = await this.getActiveAct(sessionId);
    if (!active) {
      throw new Error(`No active act found for session ${sessionId}`);
    }

    const serialized = JSON.stringify(messages);
    const changes = this.stmts.updateMessages.run(serialized, messages.length, sessionId);
    if ((changes as { changes: number }).changes === 0) {
      throw new Error(`Failed to save messages — no active act for session ${sessionId}`);
    }
  }

  /**
   * Closes the active act and opens the next one.
   * Sets summary_status = 'pending' on the closed act.
   * Throws if no active act exists.
   * Returns { closed, opened }.
   */
  async closeAct(
    sessionId: string,
    options: CloseActOptions
  ): Promise<{ closed: Act; opened: Act }> {
    const closeAndOpen = this.db.transaction(() => {
      const active = this.stmts.getActive.get(sessionId) as ActRow | undefined;
      if (!active) {
        throw new Error(`No active act found for session ${sessionId}`);
      }

      const now = new Date().toISOString();
      this.stmts.closeAct.run(
        options.title ?? null,
        options.summary,
        options.keyEvents ? JSON.stringify(options.keyEvents) : null,
        now,
        sessionId
      );

      const closed = this.stmts.getByNumber.get(sessionId, active.act_number) as ActRow;

      // Open next act
      const nextNumber = active.act_number + 1;
      const newId = `act-${randomUUID()}`;
      this.stmts.insert.run(newId, sessionId, nextNumber, now);

      const opened = this.stmts.getByNumber.get(sessionId, nextNumber) as ActRow;

      return { closed: rowToAct(closed), opened: rowToAct(opened) };
    });

    return closeAndOpen();
  }

  /**
   * Returns act summaries (without the messages field) for a session, ordered by act_number.
   */
  async getActSummaries(sessionId: string): Promise<ActSummary[]> {
    const rows = this.stmts.getSummaries.all(sessionId) as ActSummaryRow[];
    return rows.map(rowToActSummary);
  }

  /**
   * Returns a full act (including messages) by act number.
   */
  async getAct(sessionId: string, actNumber: number): Promise<Act | null> {
    const row = this.stmts.getByNumber.get(sessionId, actNumber) as ActRow | undefined;
    return row ? rowToAct(row) : null;
  }

  /**
   * Updates title, summary, keyEvents, and/or summaryStatus on a closed act.
   * Only provided (non-undefined) fields are updated.
   */
  async updateActSummary(
    actNumber: number,
    sessionId: string,
    update: {
      title?: string;
      summary?: string;
      keyEvents?: string[];
      summaryStatus?: SummaryStatus;
    }
  ): Promise<void> {
    this.stmts.updateSummary.run(
      update.title ?? null,
      update.summary ?? null,
      update.keyEvents ? JSON.stringify(update.keyEvents) : null,
      update.summaryStatus ?? null,
      actNumber,
      sessionId
    );
  }
}
