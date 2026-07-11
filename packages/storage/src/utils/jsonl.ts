import { appendFile, readFile } from "fs/promises";
import { dirname } from "path";
import { ensureDir } from "./ensure-dir.js";

/**
 * Append a single record to a JSONL file.
 * Creates the file and parent directories if they don't exist.
 */
export async function appendJSONL<T>(filePath: string, record: T): Promise<void> {
  await ensureDir(dirname(filePath));
  const line = JSON.stringify(record) + "\n";
  await appendFile(filePath, line, "utf-8");
}

/**
 * Read all records from a JSONL file.
 * Returns empty array if file doesn't exist.
 */
export async function readJSONL<T>(filePath: string): Promise<T[]> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line) => JSON.parse(line) as T);
}

/**
 * Read the last N records from a JSONL file.
 */
export async function readRecentJSONL<T>(filePath: string, count: number): Promise<T[]> {
  const all = await readJSONL<T>(filePath);
  return all.slice(-count);
}

/**
 * Count records in a JSONL file.
 */
export async function countJSONL(filePath: string): Promise<number> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }

  return content.split("\n").filter((line) => line.trim().length > 0).length;
}

/**
 * Clear a JSONL file (truncate to empty).
 */
export async function clearJSONL(filePath: string): Promise<void> {
  await ensureDir(dirname(filePath));
  const { writeFile: wf } = await import("fs/promises");
  await wf(filePath, "", "utf-8");
}
