import { mkdir } from "fs/promises";

/**
 * Ensure a directory exists (mkdir -p)
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}
