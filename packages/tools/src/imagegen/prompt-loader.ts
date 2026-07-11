/**
 * Image Prompt Template Loader
 *
 * Loads markdown templates from ./templates/, compiles {{VARIABLE}} placeholders,
 * and caches results. Templates follow SDXL prompt best practices:
 * medium/style → subject type → subject → composition → mood → quality.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, "templates");

export type ImageType = "portrait" | "scene" | "item";

// ─── Template Cache ─────────────────────────────────────────────────────────

const templateCache = new Map<string, string>();

function loadTemplate(filename: string): string {
  if (templateCache.has(filename)) return templateCache.get(filename)!;

  const content = readFileSync(resolve(TEMPLATES_DIR, filename), "utf-8").trim();
  templateCache.set(filename, content);
  return content;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ImagePromptVariables {
  /** Style prefix (from resolveStylePrefix) */
  STYLE_PREFIX: string;
  /** Entity name */
  SUBJECT: string;
  /** Visual description (first sentence of entity description) */
  DESCRIPTION?: string;
  /** World aesthetic tone keywords */
  TONE_KEYWORDS?: string;
  /** Item rarity glow effect (items only) */
  RARITY_EFFECT?: string;
}

/**
 * Compile an image prompt from a template and variables.
 * Handles empty variables by removing them and cleaning up dangling commas.
 */
export function compileImagePrompt(type: ImageType, variables: ImagePromptVariables): string {
  const template = loadTemplate(`${type}.md`);
  const vars: Record<string, string | undefined> = { ...variables };
  return compileAndClean(template, vars);
}

/**
 * Load the negative prompt for an image type.
 */
export function getImageNegativePrompt(type: ImageType): string {
  return loadTemplate(`negative-${type}.md`);
}

/**
 * Extract the first visual sentence from a description.
 * Strips narrative fluff, keeps concrete visual details.
 */
export function extractVisualDescription(description?: string): string {
  if (!description) return "";
  const firstSentence = description.split(/[.!?]/)[0].trim();
  return firstSentence || "";
}

// ─── Internal ───────────────────────────────────────────────────────────────

// Keys are from ImagePromptVariables (STYLE_PREFIX, SUBJECT, etc.) — always safe alphanumeric/underscore.
function compileAndClean(template: string, variables: Record<string, string | undefined>): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value?.trim() || "");
  }

  // Remove any remaining unreplaced variables
  result = result.replace(/\{\{[A-Z_]+\}\}/g, "");

  // Clean up dangling commas and whitespace
  result = result
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/g, "")
    .replace(/^\s*,/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return result;
}
