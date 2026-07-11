/**
 * File-based chat history manager
 *
 * JSONL append-only log at sessions/<id>/chat.jsonl
 */

import { join } from "path";
import type { ChatMessage } from "../schemas/chat.js";
import { appendJSONL, readJSONL, readRecentJSONL, countJSONL, clearJSONL } from "../utils/jsonl.js";

export class FileChatHistoryManager {
  private sessionsDir: string;

  constructor(rootDir: string) {
    this.sessionsDir = join(rootDir, "sessions");
  }

  private chatPath(sessionId: string): string {
    return join(this.sessionsDir, sessionId, "chat.jsonl");
  }

  async append(sessionId: string, message: ChatMessage): Promise<void> {
    await appendJSONL(this.chatPath(sessionId), message);
  }

  async getAll(sessionId: string): Promise<ChatMessage[]> {
    return readJSONL<ChatMessage>(this.chatPath(sessionId));
  }

  async getRecent(sessionId: string, count: number): Promise<ChatMessage[]> {
    return readRecentJSONL<ChatMessage>(this.chatPath(sessionId), count);
  }

  async count(sessionId: string): Promise<number> {
    return countJSONL(this.chatPath(sessionId));
  }

  async clear(sessionId: string): Promise<void> {
    await clearJSONL(this.chatPath(sessionId));
  }
}
