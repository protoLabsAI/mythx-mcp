/**
 * File-based media manager for world packs
 *
 * Files stored at worlds/<packId>/media/<filename>
 * Manifest at worlds/<packId>/media/manifest.json
 *
 * Concurrency model:
 *   Every operation that reads-then-writes the manifest takes a per-pack
 *   in-process mutex via withPackLock(). This serializes save / delete /
 *   replaceByRole calls for the same pack so two concurrent requests
 *   can't snapshot the same pre-write manifest, write back independently,
 *   and lose each other's mutations.
 *
 *   Single-process scope: this is enough for the current Next.js server
 *   topology. Multi-process or external writers would need a file-system
 *   lock (proper-lockfile etc.) layered on top.
 */

import { readFile, writeFile, rm } from "fs/promises";
import { join } from "path";
import type { MediaEntry, MediaManifest } from "../schemas/media.js";
import { atomicWriteJSON } from "../utils/atomic-write.js";
import { ensureDir } from "../utils/ensure-dir.js";

export class WorldMediaManager {
  private worldsDir: string;
  /**
   * Per-pack lock chain. Each entry is a tail Promise that the next
   * locked operation awaits before running. Ensures all read-modify-write
   * sequences for one packId are serialized while different packs proceed
   * in parallel.
   */
  private locks = new Map<string, Promise<void>>();

  constructor(rootDir: string) {
    this.worldsDir = join(rootDir, "worlds");
  }

  private mediaDir(packId: string): string {
    return join(this.worldsDir, packId, "media");
  }

  private manifestPath(packId: string): string {
    return join(this.mediaDir(packId), "manifest.json");
  }

  private async readManifest(packId: string): Promise<MediaManifest> {
    try {
      const content = await readFile(this.manifestPath(packId), "utf-8");
      return JSON.parse(content) as MediaManifest;
    } catch {
      return { entries: [] };
    }
  }

  private async writeManifest(packId: string, manifest: MediaManifest): Promise<void> {
    await ensureDir(this.mediaDir(packId));
    await atomicWriteJSON(this.manifestPath(packId), manifest);
  }

  /**
   * Run `fn` while holding the pack's manifest mutex. The next caller
   * for the same pack queues behind us. Errors propagate but do NOT
   * break the chain — the lock is released either way.
   */
  private async withPackLock<T>(packId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(packId) ?? Promise.resolve();
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Store the chained tail in a local so the cleanup compare below
    // can match by reference. previous.then(() => next) returns a
    // FRESH promise on each call, so calling it twice would never
    // equal the stored entry and the map would leak.
    const chainTail = previous.then(() => next);
    this.locks.set(packId, chainTail);
    try {
      await previous;
      return await fn();
    } finally {
      release!();
      // Best-effort cleanup so finished pack chains don't leak. We
      // only delete the entry if it still points at OUR `chainTail`
      // — a later caller might have already chained past us, and we
      // must not drop their tail.
      if (this.locks.get(packId) === chainTail) {
        this.locks.delete(packId);
      }
    }
  }

  async save(packId: string, entry: MediaEntry, data: Buffer): Promise<string> {
    return this.withPackLock(packId, async () => {
      const dir = this.mediaDir(packId);
      await ensureDir(dir);
      const filePath = join(dir, entry.filename);
      await writeFile(filePath, data);

      const manifest = await this.readManifest(packId);
      // Upsert by id — remove existing entry with same id before adding
      manifest.entries = manifest.entries.filter((e) => e.id !== entry.id);
      manifest.entries.push(entry);
      await this.writeManifest(packId, manifest);

      return filePath;
    });
  }

  /**
   * Atomic save + same-role sweep. Persists `entry` and removes every
   * other manifest entry for the same (entityType, entityId, role)
   * tuple — including their backing files — under a single manifest
   * lock. Replaces the previous list/save/delete sequence in callers
   * that produced same-role accumulation under concurrent regenerate/upload
   * requests.
   *
   * Pending entries with the same role tuple are also swept — promoting
   * a new live image discards any in-flight preview for the same slot.
   *
   * Returns the persisted file path (same shape as save()).
   */
  async replaceByRole(packId: string, entry: MediaEntry, data: Buffer): Promise<string> {
    return this.withPackLock(packId, async () => {
      const dir = this.mediaDir(packId);
      await ensureDir(dir);
      const filePath = join(dir, entry.filename);
      // Write the new file FIRST so a crash between this and the
      // manifest update leaves a stray file (which hydration ignores)
      // rather than a manifest pointing at a non-existent file.
      await writeFile(filePath, data);

      const manifest = await this.readManifest(packId);

      // Drop two classes of prior entry from the manifest:
      //   1. Same id as the new entry — upsert by id so a second call
      //      with a known id doesn't leave its old filename pointer behind.
      //   2. Same (entityType, entityId, role) tuple — the actual
      //      replace-by-role behavior the caller wants. Includes pending
      //      entries: a fresh canonical write also discards any in-flight
      //      preview for the same role.
      const removed = manifest.entries.filter(
        (e) =>
          e.id === entry.id ||
          (e.entityType === entry.entityType &&
            e.entityId === entry.entityId &&
            e.role === entry.role)
      );

      manifest.entries = manifest.entries.filter((e) => !removed.includes(e));
      manifest.entries.push(entry);
      await this.writeManifest(packId, manifest);

      // Manifest is durable; sweep the orphaned files. Skip any peer
      // whose filename matches the new entry's filename — that would
      // delete the file we just persisted (eg. UUID-slice or pixelgen
      // seed collision producing identical names; rare but defended
      // against because the cost is destroying the entity's image).
      // Best-effort: a leftover file with no manifest entry is dead
      // weight, not a correctness bug, so missing/locked files don't
      // fail the call.
      await Promise.all(
        removed
          .filter((old) => old.filename !== entry.filename)
          .map(async (old) => {
            try {
              await rm(join(dir, old.filename), { force: true });
            } catch {
              // ignore — orphan file stays on disk, hydration won't see it
            }
          })
      );

      return filePath;
    });
  }

  /**
   * Save `entry` as a PENDING preview. Does NOT touch any canonical
   * (live) entry for the same (entityType, entityId, role) tuple —
   * the canonical image keeps showing in `listByEntity` until the
   * caller commits the preview via `promotePending`.
   *
   * Replaces any prior pending entry for the same role tuple, so
   * multiple gen/upload attempts during a preview session don't
   * accumulate. Forces `pending: true` on the entry regardless of
   * caller-provided value — this method is the only writer of
   * pending entries.
   */
  async saveAsPending(packId: string, entry: MediaEntry, data: Buffer): Promise<string> {
    return this.withPackLock(packId, async () => {
      const dir = this.mediaDir(packId);
      await ensureDir(dir);
      const filePath = join(dir, entry.filename);
      await writeFile(filePath, data);

      const pendingEntry: MediaEntry = { ...entry, pending: true };
      const manifest = await this.readManifest(packId);

      // Sweep prior pendings for the same role tuple (only one preview
      // at a time per slot) plus any prior with the same id. Canonical
      // entries are LEFT ALONE — the preview is purely additive.
      const removed = manifest.entries.filter(
        (e) =>
          e.id === entry.id ||
          (e.pending === true &&
            e.entityType === entry.entityType &&
            e.entityId === entry.entityId &&
            e.role === entry.role)
      );

      manifest.entries = manifest.entries.filter((e) => !removed.includes(e));
      manifest.entries.push(pendingEntry);
      await this.writeManifest(packId, manifest);

      await Promise.all(
        removed
          .filter((old) => old.filename !== entry.filename)
          .map(async (old) => {
            try {
              await rm(join(dir, old.filename), { force: true });
            } catch {
              // ignore — orphan file stays on disk
            }
          })
      );

      return filePath;
    });
  }

  /**
   * Find the pending entry for the given (entityType, entityId, role)
   * tuple, if any. Read-only — no manifest write, so no lock needed.
   */
  async getPending(
    packId: string,
    entityType: string,
    entityId: string,
    role: string
  ): Promise<MediaEntry | null> {
    const manifest = await this.readManifest(packId);
    return (
      manifest.entries.find(
        (e) =>
          e.pending === true &&
          e.entityType === entityType &&
          e.entityId === entityId &&
          e.role === role
      ) ?? null
    );
  }

  /**
   * Promote the pending entry for the given role tuple into the
   * canonical slot. Atomic: under the manifest lock, drops the
   * pending flag, replaces any existing canonical (sweeping its file),
   * keeping the pending entry's file in place as the new canonical.
   * Returns the promoted entry, or null if there was no pending.
   */
  async promotePending(
    packId: string,
    entityType: string,
    entityId: string,
    role: string
  ): Promise<MediaEntry | null> {
    return this.withPackLock(packId, async () => {
      const dir = this.mediaDir(packId);
      const manifest = await this.readManifest(packId);

      const pending = manifest.entries.find(
        (e) =>
          e.pending === true &&
          e.entityType === entityType &&
          e.entityId === entityId &&
          e.role === role
      );
      if (!pending) return null;

      // Strip the pending flag — the entry stays in the manifest as
      // the new canonical. Sweep any prior canonical with the same
      // role tuple (and any peer with the same id, defensive).
      const promoted: MediaEntry = { ...pending, pending: false };
      const removed = manifest.entries.filter(
        (e) =>
          e !== pending &&
          (e.id === pending.id ||
            (e.pending !== true &&
              e.entityType === entityType &&
              e.entityId === entityId &&
              e.role === role))
      );

      manifest.entries = manifest.entries.filter((e) => e !== pending && !removed.includes(e));
      manifest.entries.push(promoted);
      await this.writeManifest(packId, manifest);

      await Promise.all(
        removed
          .filter((old) => old.filename !== pending.filename)
          .map(async (old) => {
            try {
              await rm(join(dir, old.filename), { force: true });
            } catch {
              // ignore
            }
          })
      );

      return promoted;
    });
  }

  /**
   * Discard the pending entry for the given role tuple. Atomic:
   * drops the manifest entry under the lock, then sweeps the file.
   * Canonical entries are untouched. Returns true if a pending was
   * discarded, false if there was nothing to discard.
   */
  async discardPending(
    packId: string,
    entityType: string,
    entityId: string,
    role: string
  ): Promise<boolean> {
    return this.withPackLock(packId, async () => {
      const dir = this.mediaDir(packId);
      const manifest = await this.readManifest(packId);

      const pending = manifest.entries.find(
        (e) =>
          e.pending === true &&
          e.entityType === entityType &&
          e.entityId === entityId &&
          e.role === role
      );
      if (!pending) return false;

      manifest.entries = manifest.entries.filter((e) => e !== pending);
      await this.writeManifest(packId, manifest);

      try {
        await rm(join(dir, pending.filename), { force: true });
      } catch {
        // ignore — orphan file stays on disk
      }

      return true;
    });
  }

  async get(packId: string, mediaId: string): Promise<{ entry: MediaEntry; path: string } | null> {
    const manifest = await this.readManifest(packId);
    const entry = manifest.entries.find((e) => e.id === mediaId);
    if (!entry) return null;
    return { entry, path: join(this.mediaDir(packId), entry.filename) };
  }

  async list(packId: string): Promise<MediaEntry[]> {
    const manifest = await this.readManifest(packId);
    return manifest.entries;
  }

  async listByEntity(
    packId: string,
    entityType: string,
    entityId: string,
    opts: { includePending?: boolean } = {}
  ): Promise<MediaEntry[]> {
    const manifest = await this.readManifest(packId);
    return manifest.entries.filter((e) => {
      if (e.entityType !== entityType || e.entityId !== entityId) return false;
      // Pending entries are previews — hidden from the default listing
      // so consumers (entity-list hydration, runtime image lookup) see
      // only canonical state. Modal/edit flows opt in via includePending.
      if (e.pending === true && !opts.includePending) return false;
      return true;
    });
  }

  async delete(packId: string, mediaId: string): Promise<void> {
    return this.withPackLock(packId, async () => {
      const manifest = await this.readManifest(packId);
      const entry = manifest.entries.find((e) => e.id === mediaId);
      if (!entry) return;

      // Make the manifest update authoritative: rewrite first, then
      // sweep the file. If we removed the file first and the manifest
      // write failed, the entry would point at a missing file and
      // hydration would 404. Reversing the order leaves at worst an
      // orphan file (dead weight, not a correctness bug).
      manifest.entries = manifest.entries.filter((e) => e.id !== mediaId);
      await this.writeManifest(packId, manifest);

      try {
        await rm(join(this.mediaDir(packId), entry.filename), { force: true });
      } catch {
        // ignore — orphan file stays on disk, hydration won't see it
      }
    });
  }
}
