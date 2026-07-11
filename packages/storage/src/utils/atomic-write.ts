import { writeFile, rename } from "fs/promises";
import { join, dirname } from "path";
import { randomUUID } from "crypto";
import { ensureDir } from "./ensure-dir.js";

/**
 * Write a file atomically using temp file + rename.
 * Prevents partial writes on crash.
 */
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const dir = dirname(filePath);
  await ensureDir(dir);

  const tempPath = join(dir, `.${randomUUID()}.tmp`);
  await writeFile(tempPath, data, "utf-8");
  await rename(tempPath, filePath);
}

/**
 * Write JSON atomically with pretty-printing
 */
export async function atomicWriteJSON(filePath: string, data: unknown): Promise<void> {
  await atomicWriteFile(filePath, JSON.stringify(data, null, 2));
}
