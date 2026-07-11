import { z } from "zod";

/**
 * Media manifest entry schema
 * Stored in sessions/<id>/media/manifest.json
 */
export const MediaEntrySchema = z.object({
  /** Unique media ID */
  id: z.string(),

  /** Filename on disk (within the media/ directory) */
  filename: z.string(),

  /** MIME type */
  mimeType: z.string(),

  /** Entity type this media is associated with */
  entityType: z
    .enum(["character", "archetype", "npc", "monster", "item", "location", "scene", "faction"])
    .optional(),

  /** Entity ID this media is associated with */
  entityId: z.string().optional(),

  /** Role of the media (e.g., portrait, scene illustration) */
  role: z.string().optional(),

  /** File size in bytes */
  sizeBytes: z.number().optional(),

  /** ISO timestamp */
  createdAt: z.string(),

  /**
   * Pending preview marker. When true, this entry is a staged
   * candidate that the user has generated/uploaded but not yet
   * approved. Excluded from `listByEntity` by default (callers
   * opt in via `includePending: true`) so the canonical
   * (entityType, entityId, role) tuple is unaffected by previews.
   *
   * Only one pending entry is allowed per (entityType, entityId,
   * role) tuple — calling `saveAsPending` again replaces the
   * prior pending. Promoting via `promotePending` collapses the
   * pending entry into the canonical via the same atomic
   * `replaceByRole` path live writes use.
   */
  pending: z.boolean().optional(),
});

export type MediaEntry = z.infer<typeof MediaEntrySchema>;

/**
 * Media manifest schema (the full manifest.json file)
 */
export const MediaManifestSchema = z.object({
  entries: z.array(MediaEntrySchema),
});

export type MediaManifest = z.infer<typeof MediaManifestSchema>;
