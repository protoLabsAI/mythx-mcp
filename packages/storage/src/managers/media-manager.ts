/**
 * File-based media manager
 *
 * Files stored at sessions/<id>/media/<filename>
 * Manifest at sessions/<id>/media/manifest.json
 */

import { readFile, writeFile, rm } from "fs/promises";
import { join } from "path";
import type { MediaEntry, MediaManifest } from "../schemas/media.js";
import { atomicWriteJSON } from "../utils/atomic-write.js";
import { ensureDir } from "../utils/ensure-dir.js";

export class FileMediaManager {
  private sessionsDir: string;

  constructor(rootDir: string) {
    this.sessionsDir = join(rootDir, "sessions");
  }

  private mediaDir(sessionId: string): string {
    return join(this.sessionsDir, sessionId, "media");
  }

  private manifestPath(sessionId: string): string {
    return join(this.mediaDir(sessionId), "manifest.json");
  }

  private async readManifest(sessionId: string): Promise<MediaManifest> {
    try {
      const content = await readFile(this.manifestPath(sessionId), "utf-8");
      return JSON.parse(content) as MediaManifest;
    } catch {
      return { entries: [] };
    }
  }

  private async writeManifest(sessionId: string, manifest: MediaManifest): Promise<void> {
    await ensureDir(this.mediaDir(sessionId));
    await atomicWriteJSON(this.manifestPath(sessionId), manifest);
  }

  async save(sessionId: string, entry: MediaEntry, data: Buffer): Promise<string> {
    const dir = this.mediaDir(sessionId);
    await ensureDir(dir);
    const filePath = join(dir, entry.filename);
    await writeFile(filePath, data);

    const manifest = await this.readManifest(sessionId);
    manifest.entries.push(entry);
    await this.writeManifest(sessionId, manifest);

    return filePath;
  }

  async get(
    sessionId: string,
    mediaId: string
  ): Promise<{ entry: MediaEntry; path: string } | null> {
    const manifest = await this.readManifest(sessionId);
    const entry = manifest.entries.find((e) => e.id === mediaId);
    if (!entry) return null;
    return { entry, path: join(this.mediaDir(sessionId), entry.filename) };
  }

  async list(sessionId: string): Promise<MediaEntry[]> {
    const manifest = await this.readManifest(sessionId);
    return manifest.entries;
  }

  async listByEntity(
    sessionId: string,
    entityType: string,
    entityId: string
  ): Promise<MediaEntry[]> {
    const manifest = await this.readManifest(sessionId);
    return manifest.entries.filter((e) => e.entityType === entityType && e.entityId === entityId);
  }

  async delete(sessionId: string, mediaId: string): Promise<void> {
    const manifest = await this.readManifest(sessionId);
    const entry = manifest.entries.find((e) => e.id === mediaId);
    if (!entry) return;

    try {
      await rm(join(this.mediaDir(sessionId), entry.filename), { force: true });
    } catch {
      // ignore
    }

    manifest.entries = manifest.entries.filter((e) => e.id !== mediaId);
    await this.writeManifest(sessionId, manifest);
  }
}
