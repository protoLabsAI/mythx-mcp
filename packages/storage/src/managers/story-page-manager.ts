/**
 * StoryPageManager — SQLite-backed manager for story-page storage.
 *
 * Story pages are narrator-voice summaries of ~8-turn windows within
 * an act. They're the compressible-history unit Phase B (#70) of the
 * context-compaction rollout introduces. The runtime can swap raw
 * transcripts for pages once Phase C (#71) ships; until then, pages
 * are generated and stored but not injected.
 *
 * Lifecycle:
 *   1. Trigger fires (every Nth turn within an act) →
 *      `createPagePending` reserves the next page_number row.
 *   2. Generator runs LLM call →
 *      `completePage` fills in title/text/keyEvents.
 *   3. On generator failure →
 *      `failPage` flips status to 'failed' so retries can pick it up.
 *
 * See docs/context-compaction-architecture.md §3 for the design.
 */

import { randomUUID } from "crypto";
import type { Database, Statement } from "../sqlite/connection.js";

export type StoryPageStatus = "pending" | "complete" | "failed";

export interface StoryPage {
  id: string;
  sessionId: string;
  pageNumber: number;
  actNumber: number;
  title?: string;
  text: string;
  keyEvents?: string[];
  triggerTurnId?: string;
  status: StoryPageStatus;
  createdAt: string;
  completedAt?: string;
}

interface StoryPageRow {
  id: string;
  session_id: string;
  page_number: number;
  act_number: number;
  title: string | null;
  text: string;
  key_events: string | null;
  trigger_turn_id: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

function safeJsonParse<T>(json: string, fallback: T, context: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    console.error(`[StoryPageManager] Corrupted JSON in ${context}:`, err);
    return fallback;
  }
}

function rowToStoryPage(row: StoryPageRow): StoryPage {
  return {
    id: row.id,
    sessionId: row.session_id,
    pageNumber: row.page_number,
    actNumber: row.act_number,
    title: row.title ?? undefined,
    text: row.text,
    keyEvents: row.key_events
      ? safeJsonParse<string[]>(row.key_events, [], `page ${row.id} key_events`)
      : undefined,
    triggerTurnId: row.trigger_turn_id ?? undefined,
    status: row.status as StoryPageStatus,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

export class StoryPageManager {
  private db: Database;
  private stmts: {
    insert: Statement;
    listForSession: Statement;
    listCompleteForSession: Statement;
    maxPageNumber: Statement;
    getById: Statement;
    completePage: Statement;
    failPage: Statement;
  };

  constructor(db: Database) {
    this.db = db;
    this.stmts = {
      insert: db.prepare(`
        INSERT INTO story_pages
          (id, session_id, page_number, act_number, trigger_turn_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `),
      listForSession: db.prepare(`
        SELECT * FROM story_pages
        WHERE session_id = ?
        ORDER BY page_number ASC
      `),
      listCompleteForSession: db.prepare(`
        SELECT * FROM story_pages
        WHERE session_id = ? AND status = 'complete'
        ORDER BY page_number ASC
      `),
      maxPageNumber: db.prepare(`
        SELECT COALESCE(MAX(page_number), 0) AS max_num
        FROM story_pages
        WHERE session_id = ?
      `),
      getById: db.prepare(`SELECT * FROM story_pages WHERE id = ?`),
      completePage: db.prepare(`
        UPDATE story_pages
        SET status = 'complete',
            title = ?,
            text = ?,
            key_events = ?,
            completed_at = ?
        WHERE id = ?
      `),
      failPage: db.prepare(`
        UPDATE story_pages
        SET status = 'failed',
            completed_at = ?
        WHERE id = ?
      `),
    };
  }

  /**
   * Reserve the next page row for a session as `pending`. Caller is the
   * trigger (chat route turn-counter); the generator backfills via
   * `completePage` when the LLM call returns.
   *
   * Wraps the MAX(page_number) read + INSERT in a transaction so two
   * concurrent triggers can't reserve the same page_number — the
   * UNIQUE(session_id, page_number) index would otherwise turn one
   * into a constraint failure. ActManager.closeAct uses the same
   * pattern for the same reason.
   */
  async createPagePending(opts: {
    sessionId: string;
    actNumber: number;
    triggerTurnId?: string;
  }): Promise<StoryPage> {
    const id = `page-${randomUUID()}`;
    const now = new Date().toISOString();

    const reserve = this.db.transaction(() => {
      const max = this.stmts.maxPageNumber.get(opts.sessionId) as { max_num: number } | undefined;
      const pageNumber = (max?.max_num ?? 0) + 1;

      this.stmts.insert.run(
        id,
        opts.sessionId,
        pageNumber,
        opts.actNumber,
        opts.triggerTurnId ?? null,
        now
      );

      return this.stmts.getById.get(id) as StoryPageRow;
    });

    return rowToStoryPage(reserve());
  }

  /** Backfill a pending page with the generator's output. */
  async completePage(
    id: string,
    update: { title?: string; text: string; keyEvents?: string[] }
  ): Promise<void> {
    this.stmts.completePage.run(
      update.title ?? null,
      update.text,
      update.keyEvents ? JSON.stringify(update.keyEvents) : null,
      new Date().toISOString(),
      id
    );
  }

  /** Mark a pending page as failed. The trigger may re-fire on the next turn. */
  async failPage(id: string): Promise<void> {
    this.stmts.failPage.run(new Date().toISOString(), id);
  }

  /** All pages for a session, ordered by page_number. Includes pending/failed. */
  async listForSession(sessionId: string): Promise<StoryPage[]> {
    const rows = this.stmts.listForSession.all(sessionId) as StoryPageRow[];
    return rows.map(rowToStoryPage);
  }

  /** Complete pages only — what the chat route injects into the prompt. */
  async listCompleteForSession(sessionId: string): Promise<StoryPage[]> {
    const rows = this.stmts.listCompleteForSession.all(sessionId) as StoryPageRow[];
    return rows.map(rowToStoryPage);
  }

  async getById(id: string): Promise<StoryPage | null> {
    const row = this.stmts.getById.get(id) as StoryPageRow | undefined;
    return row ? rowToStoryPage(row) : null;
  }
}
