/**
 * Zod to JSON Schema conversion tests
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema, getRequiredFields } from "../adapters/zod-to-json.js";

describe("zodToJsonSchema", () => {
  it("converts simple object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties).toBeDefined();
    expect((jsonSchema.properties as Record<string, unknown>).name).toEqual({
      type: "string",
    });
    expect((jsonSchema.properties as Record<string, unknown>).age).toEqual({
      type: "number",
    });
    expect(jsonSchema.required).toEqual(["name", "age"]);
  });

  it("handles optional fields", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.required).toEqual(["required"]);
  });

  it("converts descriptions", () => {
    const schema = z.object({
      name: z.string().describe("The user's name"),
    });

    const jsonSchema = zodToJsonSchema(schema);
    const nameSchema = (jsonSchema.properties as Record<string, unknown>)
      .name as Record<string, unknown>;

    expect(nameSchema.description).toBe("The user's name");
  });

  it("handles enums", () => {
    const schema = z.object({
      ability: z.enum(["STR", "AGI", "WIT", "CON"]),
    });

    const jsonSchema = zodToJsonSchema(schema);
    const abilitySchema = (jsonSchema.properties as Record<string, unknown>)
      .ability as Record<string, unknown>;

    expect(abilitySchema.type).toBe("string");
    expect(abilitySchema.enum).toEqual(["STR", "AGI", "WIT", "CON"]);
  });

  it("handles union types", () => {
    const schema = z.object({
      difficulty: z.union([
        z.number(),
        z.enum(["EASY", "STANDARD", "HARD", "EXTREME"]),
      ]),
    });

    const jsonSchema = zodToJsonSchema(schema);
    const difficultySchema = (jsonSchema.properties as Record<string, unknown>)
      .difficulty as Record<string, unknown>;

    // Should have anyOf/oneOf for union
    expect(
      difficultySchema.anyOf !== undefined || difficultySchema.oneOf !== undefined
    ).toBe(true);
  });

  it("handles arrays", () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });

    const jsonSchema = zodToJsonSchema(schema);
    const tagsSchema = (jsonSchema.properties as Record<string, unknown>)
      .tags as Record<string, unknown>;

    expect(tagsSchema.type).toBe("array");
    expect(tagsSchema.items).toEqual({ type: "string" });
  });

  it("removes $schema by default", () => {
    const schema = z.object({
      name: z.string(),
    });

    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.$schema).toBeUndefined();
  });
});

describe("getRequiredFields", () => {
  it("returns required fields from object schema", () => {
    const schema = z.object({
      required1: z.string(),
      required2: z.number(),
      optional: z.string().optional(),
    });

    const required = getRequiredFields(schema);

    expect(required).toContain("required1");
    expect(required).toContain("required2");
    expect(required).not.toContain("optional");
  });

  it("handles default values as not required", () => {
    const schema = z.object({
      required: z.string(),
      withDefault: z.string().default("test"),
    });

    const required = getRequiredFields(schema);

    expect(required).toContain("required");
    expect(required).not.toContain("withDefault");
  });

  it("returns empty array for non-object schemas", () => {
    const schema = z.string();

    const required = getRequiredFields(schema);

    expect(required).toEqual([]);
  });
});
