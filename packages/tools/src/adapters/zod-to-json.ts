/**
 * Zod to JSON Schema Conversion
 *
 * Converts Zod schemas to JSON Schema format for MCP compatibility.
 * Uses zod-to-json-schema library for reliable conversion.
 */

import { z } from "zod";
import { zodToJsonSchema as zodToJsonSchemaLib } from "zod-to-json-schema";

/**
 * JSON Schema type for MCP tool input schemas
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

/**
 * Convert a Zod schema to JSON Schema format
 *
 * @param schema - The Zod schema to convert
 * @param options - Optional conversion options
 * @returns JSON Schema object suitable for MCP tool registration
 */
export function zodToJsonSchema(
  schema: z.ZodTypeAny,
  options?: {
    /** Remove $schema field from output */
    removeSchema?: boolean;
    /** Target JSON Schema version */
    target?: "jsonSchema7" | "jsonSchema2019-09" | "openApi3";
  }
): JsonSchema {
  const converted = zodToJsonSchemaLib(schema, {
    target: options?.target ?? "jsonSchema7",
    $refStrategy: "none", // Inline all definitions for MCP compatibility
  });

  // Remove $schema if requested (MCP doesn't need it)
  if (options?.removeSchema !== false) {
    const { $schema: _$schema, ...rest } = converted as Record<string, unknown>;
    return upgradeToDraft202012(rest) as JsonSchema;
  }

  return upgradeToDraft202012(converted) as JsonSchema;
}

/**
 * Recursively upgrade JSON Schema 7 constructs to draft 2020-12.
 *
 * The Claude API validates tool schemas against draft 2020-12.
 * zod-to-json-schema produces draft 7 which uses `items: [schema, schema]`
 * for tuple validation. Draft 2020-12 requires `prefixItems` instead.
 */
function upgradeToDraft202012(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(upgradeToDraft202012);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }

  const obj = node as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === "items" && Array.isArray(value)) {
      // Draft 7 tuple: items: [schemaA, schemaB]
      // Draft 2020-12: prefixItems: [schemaA, schemaB]
      result["prefixItems"] = value.map(upgradeToDraft202012);
    } else {
      result[key] = upgradeToDraft202012(value);
    }
  }

  return result;
}

/**
 * Extract required fields from a Zod object schema
 */
export function getRequiredFields(schema: z.ZodTypeAny): string[] {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      // A field is required if it's not optional and not nullable without default
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return required;
  }

  return [];
}

/**
 * Get property descriptions from a Zod object schema
 */
export function getPropertyDescriptions(schema: z.ZodTypeAny): Record<string, string> {
  const descriptions: Record<string, string> = {};

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;

    for (const [key, value] of Object.entries(shape)) {
      const desc = (value as z.ZodTypeAny).description;
      if (desc) {
        descriptions[key] = desc;
      }
    }
  }

  return descriptions;
}
