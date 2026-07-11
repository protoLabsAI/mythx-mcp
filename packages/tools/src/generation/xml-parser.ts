/**
 * XML Parsing Utilities for World Generation
 *
 * Provides functions to extract structured data from XML-formatted LLM outputs.
 * More robust than JSON parsing since LLMs naturally produce XML-like structures.
 *
 * Based on the xml-parser from content-creation-system with additions for
 * repeated elements and optional fields.
 */

/**
 * Extract content from a single XML tag.
 * Returns undefined if tag not found or empty.
 *
 * @param output - The string to search in
 * @param tag - The tag name (alphanumerics, hyphens, underscores only)
 * @returns The trimmed content or undefined
 */
export function extractTag(output: string, tag: string): string | undefined {
  // Validate tag name for safety
  if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
    throw new Error(
      `Invalid tag name: ${tag}. Must contain only alphanumerics, hyphens, and underscores`
    );
  }

  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = output.match(regex);

  if (!match) {
    return undefined;
  }

  const content = match[1].trim();
  return content.length > 0 ? content : undefined;
}

/**
 * Extract content from a tag, throwing if not found.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @returns The trimmed content
 * @throws Error if tag not found or empty
 */
export function extractRequiredTag(output: string, tag: string): string {
  const content = extractTag(output, tag);
  if (content === undefined) {
    throw new Error(`Required tag <${tag}> not found or empty in output`);
  }
  return content;
}

/**
 * Extract content from a tag, returning a default value if not found.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @param defaultValue - Value to return if tag not found
 * @returns The trimmed content or default value
 */
export function extractOptionalTag(output: string, tag: string, defaultValue: string): string {
  return extractTag(output, tag) ?? defaultValue;
}

/**
 * Extract all occurrences of a repeated tag.
 * Useful for parsing arrays of items.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @returns Array of trimmed content strings
 */
export function extractAllTags(output: string, tag: string): string[] {
  // Validate tag name for safety
  if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
    throw new Error(
      `Invalid tag name: ${tag}. Must contain only alphanumerics, hyphens, and underscores`
    );
  }

  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(output)) !== null) {
    const content = match[1].trim();
    if (content.length > 0) {
      matches.push(content);
    }
  }

  return matches;
}

/**
 * Extract JSON content from within an XML tag.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @returns Parsed JSON object
 * @throws Error if tag not found or JSON parse fails
 */
export function extractTaggedJSON<T>(output: string, tag: string): T {
  const content = extractRequiredTag(output, tag);
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from <${tag}> tag: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract an integer from a tag.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @returns The parsed integer
 * @throws Error if tag not found or not a valid integer
 */
export function extractRequiredInt(output: string, tag: string): number {
  const content = extractRequiredTag(output, tag);
  const parsed = parseInt(content, 10);
  if (isNaN(parsed)) {
    throw new Error(`Tag <${tag}> does not contain a valid integer: ${content}`);
  }
  return parsed;
}

/**
 * Extract an integer from a tag, clamped to a min/max range.
 * Useful for ability scores where LLMs may generate out-of-bounds values.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns The parsed and clamped integer
 * @throws Error if tag not found or not a valid integer
 */
export function extractClampedInt(output: string, tag: string, min: number, max: number): number {
  const value = extractRequiredInt(output, tag);
  return Math.max(min, Math.min(max, value));
}

/**
 * Extract an optional integer from a tag.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @returns The parsed integer or undefined
 */
export function extractOptionalInt(output: string, tag: string): number | undefined {
  const content = extractTag(output, tag);
  if (content === undefined) {
    return undefined;
  }
  const parsed = parseInt(content, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Extract an optional integer from a tag, clamped to a min/max range.
 * Returns defaultValue if tag not found.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param defaultValue - Value to return if tag not found
 * @returns The parsed and clamped integer, or defaultValue
 */
export function extractOptionalClampedInt(
  output: string,
  tag: string,
  min: number,
  max: number,
  defaultValue: number
): number {
  const value = extractOptionalInt(output, tag);
  if (value === undefined) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Extract a boolean from a tag.
 * Recognizes: yes/no, true/false, 1/0
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @param defaultValue - Value to return if tag not found
 * @returns The parsed boolean
 */
export function extractBoolean(output: string, tag: string, defaultValue: boolean): boolean {
  const content = extractTag(output, tag);
  if (content === undefined) {
    return defaultValue;
  }
  const lower = content.toLowerCase();
  return lower === "yes" || lower === "true" || lower === "1";
}

/**
 * Check if a string appears to be XML (has at least one tag).
 *
 * @param content - The string to check
 * @returns True if content appears to be XML
 */
export function isXML(content: string): boolean {
  // Look for at least one XML-like tag pattern
  return /<[a-zA-Z][a-zA-Z0-9_-]*>[\s\S]*?<\/[a-zA-Z][a-zA-Z0-9_-]*>/i.test(content);
}

/**
 * Extract an enum value from a tag with case-insensitive matching.
 * Returns the canonical casing from validValues.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @param validValues - Array of valid enum values (canonical casing)
 * @returns The validated enum value in canonical casing
 * @throws Error if tag not found or value not in valid values
 */
export function extractRequiredEnum<T extends string>(
  output: string,
  tag: string,
  validValues: readonly T[]
): T {
  const content = extractRequiredTag(output, tag);
  const contentLower = content.toLowerCase();

  // 1. Exact case-insensitive match
  const exact = validValues.findIndex((v) => v.toLowerCase() === contentLower);
  if (exact !== -1) {
    return validValues[exact];
  }

  // 2. Tolerant compound-token match. Some models return hyphenated /
  //    slashed combinations like "renaissance-industrial" or
  //    "minion/standard" when one of the listed values was expected.
  //    Split on common separators and accept the result only when one
  //    token EXACTLY matches a valid enum. Avoids silently coercing
  //    unrelated values like "uncommon" into "common" or "modernized"
  //    into "modern".
  const tokens = contentLower.split(/[-/|,\s]+/).filter(Boolean);
  if (tokens.length >= 2) {
    // Prefer longer valid values when multiple tokens match
    // (e.g. "futuristic-modern" → "futuristic" not "modern")
    const sorted = [...validValues].sort((a, b) => b.length - a.length);
    for (const v of sorted) {
      if (tokens.includes(v.toLowerCase())) {
        return v;
      }
    }
  }

  throw new Error(
    `Tag <${tag}> has invalid value "${content}". Must be one of: ${validValues.join(", ")}`
  );
}

/**
 * Extract an optional enum value from a tag with case-insensitive matching.
 * Returns the canonical casing from validValues.
 * Warns when tag exists but contains an invalid value.
 *
 * @param output - The string to search in
 * @param tag - The tag name
 * @param validValues - Array of valid enum values (canonical casing)
 * @returns The validated enum value in canonical casing, or undefined if tag not found
 */
export function extractOptionalEnum<T extends string>(
  output: string,
  tag: string,
  validValues: readonly T[]
): T | undefined {
  const content = extractTag(output, tag);
  if (content === undefined) {
    return undefined;
  }

  const contentLower = content.toLowerCase();

  // 1. Exact case-insensitive match
  const exact = validValues.findIndex((v) => v.toLowerCase() === contentLower);
  if (exact !== -1) {
    return validValues[exact];
  }

  // 2. Tolerant compound-token match (see extractRequiredEnum for rationale)
  const tokens = contentLower.split(/[-/|,\s]+/).filter(Boolean);
  if (tokens.length >= 2) {
    const sorted = [...validValues].sort((a, b) => b.length - a.length);
    for (const v of sorted) {
      if (tokens.includes(v.toLowerCase())) {
        return v;
      }
    }
  }

  console.warn(
    `Tag <${tag}> has invalid value "${content}". Expected one of: ${validValues.join(", ")}`
  );
  return undefined;
}
