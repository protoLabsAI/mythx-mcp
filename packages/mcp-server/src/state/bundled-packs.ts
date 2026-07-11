/**
 * First-run bundled-pack import.
 *
 * On MCP server startup, ensures every pack declared in
 * `bundled-packs/manifest.json` exists in the user's SQLite db. Missing
 * packs are imported from `bundled-packs/packs/<slug>.world.json`.
 *
 * Design rules:
 * - **Never overwrite an existing pack.** If the user has a pack with the
 *   same ID (whether bundled-stock or user-customized), we leave it alone.
 *   Bundled packs only fill empty slots.
 * - **Never crash the server.** All errors are logged and swallowed —
 *   the server stays bootable even if the bundle is missing or corrupt.
 * - **Path resolution works in dev + installed + bundled.** Resolution
 *   order: `BUNDLED_PACKS_DIR` env var (the desktop app sets it) →
 *   `<package root>/bundled-packs`, where the package root is found by
 *   walking up from the compiled file looking for this package's own
 *   package.json. That works for the tsc layout (`dist/state/*.js`, two
 *   levels down) and the single-file npm publish bundle (`dist/index.js`,
 *   one level down) alike.
 *
 * Versioning: deferred. v0 imports a pack only if its ID is absent. Future
 * version-aware refresh (re-import when manifest.version bumps) lives behind
 * a flag once we have a real upgrade story.
 */

import { readFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { WorldContentPackSchema } from "@mythxengine/worlds";

import { worldPackManager } from "./worldpacks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Walk up from the compiled file's directory looking for the package.json
 * whose `name` is `@mythxengine/mcp-server`. Requiring the exact name (not
 * just any package.json) keeps the walk from latching onto a consumer's
 * manifest if this module is ever compiled into another package.
 */
function findPackageRoot(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    const manifestPath = join(dir, "package.json");
    if (existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as { name?: string };
        if (parsed.name === "@mythxengine/mcp-server") return dir;
      } catch {
        // Unreadable/invalid package.json — keep walking.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve the bundled-packs directory. Highest priority is the
 * `BUNDLED_PACKS_DIR` env override (set by the desktop app, which points
 * it at the extracted app bundle); otherwise `<package root>/bundled-packs`.
 */
function resolveBundledPacksDir(): string | null {
  const override = process.env.BUNDLED_PACKS_DIR;
  if (override) return override;

  const pkgRoot = findPackageRoot(__dirname);
  if (pkgRoot) return join(pkgRoot, "bundled-packs");

  return null;
}

const ManifestPackSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().optional(),
  tone: z.string().optional(),
  tier: z.string().optional(),
  seedFile: z.string().optional(),
  packFile: z.string(),
});

const ManifestSchema = z.object({
  version: z.string().optional(),
  generatedAt: z.string().nullable().optional(),
  packs: z.array(ManifestPackSchema),
});

type ManifestPack = z.infer<typeof ManifestPackSchema>;
type Manifest = z.infer<typeof ManifestSchema>;

export interface ImportSummary {
  imported: string[];
  skipped: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Import any missing bundled packs into the user's SQLite db.
 *
 * Idempotent: existing packs (by ID) are never touched.
 */
export async function importBundledPacks(): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: [], skipped: [], failed: [] };

  const bundledPacksDir = resolveBundledPacksDir();
  if (!bundledPacksDir) {
    // Couldn't locate our own package root — fine, server still boots.
    return summary;
  }

  const manifestPath = join(bundledPacksDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    // No bundle shipped — fine, server still boots. But if the location
    // was explicitly configured, a silent no-op would hide a typo'd path,
    // so say what we looked for.
    if (process.env.BUNDLED_PACKS_DIR) {
      console.warn(`[bundled-packs] BUNDLED_PACKS_DIR is set but no manifest at ${manifestPath}`);
    }
    return summary;
  }

  let manifest: Manifest;
  try {
    const raw = await readFile(manifestPath, "utf-8");
    manifest = ManifestSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error(
      `[bundled-packs] failed to read or validate ${manifestPath}:`,
      err instanceof Error ? err.message : err
    );
    return summary;
  }

  // Snapshot the existing IDs once instead of N round-trips to the db.
  let existingIds: Set<string>;
  try {
    existingIds = new Set(await worldPackManager.list());
  } catch (err) {
    console.error(
      `[bundled-packs] failed to list existing packs:`,
      err instanceof Error ? err.message : err
    );
    return summary;
  }

  for (const pack of manifest.packs) {
    if (existingIds.has(pack.id)) {
      summary.skipped.push(pack.id);
      continue;
    }

    try {
      await importOnePack(bundledPacksDir, pack);
      summary.imported.push(pack.id);
      // Defensive: guard against duplicate IDs in manifest.packs.
      existingIds.add(pack.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.failed.push({ id: pack.id, error: message });
      console.error(`[bundled-packs] failed to import ${pack.id}: ${message}`);
    }
  }

  if (summary.imported.length > 0) {
    console.info(
      `[bundled-packs] imported ${summary.imported.length} pack(s): ${summary.imported.join(", ")}`
    );
  }

  return summary;
}

async function importOnePack(bundledPacksDir: string, pack: ManifestPack): Promise<void> {
  const packPath = join(bundledPacksDir, pack.packFile);
  if (!existsSync(packPath)) {
    throw new Error(`pack file missing at ${packPath}`);
  }

  const raw = await readFile(packPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  // Validate the full pack against the canonical schema before saving.
  // This catches malformed bundles (truncated files, schema drift between
  // a stale bundled pack and a newer mcp-server build) before they reach
  // SQLite and surface as runtime crashes during play.
  const validated = WorldContentPackSchema.parse(parsed);

  // Sanity-check meta.id matches what the manifest claims so we don't
  // import a pack under the wrong key.
  if (validated.meta.id !== pack.id) {
    throw new Error(`pack meta.id ${validated.meta.id} does not match manifest id ${pack.id}`);
  }

  await worldPackManager.save(pack.id, validated);
}
