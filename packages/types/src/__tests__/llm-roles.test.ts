/**
 * Smoke tests for the shared LLM tier + role types. The test surface is
 * intentionally narrow — we just need to lock down: every role has a tier,
 * the schemas accept the canonical strings and reject everything else, and
 * the type guard agrees with the schema.
 */

import { describe, it, expect } from "vitest";
import {
  isRPGAgentRole,
  RPG_AGENT_ROLES,
  RPGAgentRoleSchema,
  ROLE_TO_TIER,
  TIER_NAMES,
  TierNameSchema,
} from "../llm-roles.js";

describe("RPG_AGENT_ROLES + ROLE_TO_TIER", () => {
  it("ROLE_TO_TIER has an entry for every role (no orphaned mappings)", () => {
    for (const role of RPG_AGENT_ROLES) {
      expect(ROLE_TO_TIER[role]).toBeDefined();
    }
    // And no extra keys — sizes must match exactly so a typo can't slip in.
    expect(Object.keys(ROLE_TO_TIER).sort()).toEqual([...RPG_AGENT_ROLES].sort());
  });

  it("every ROLE_TO_TIER value is a valid tier", () => {
    for (const tier of Object.values(ROLE_TO_TIER)) {
      expect(TIER_NAMES).toContain(tier);
    }
  });
});

describe("isRPGAgentRole", () => {
  it("accepts every canonical role", () => {
    for (const role of RPG_AGENT_ROLES) {
      expect(isRPGAgentRole(role)).toBe(true);
    }
  });

  it("rejects strings that aren't roles", () => {
    expect(isRPGAgentRole("not-a-role")).toBe(false);
    expect(isRPGAgentRole("")).toBe(false);
    expect(isRPGAgentRole("Orchestrator")).toBe(false); // case-sensitive
  });
});

describe("immutability", () => {
  it("freezes the exported registries so consumers cannot mutate them", () => {
    expect(Object.isFrozen(TIER_NAMES)).toBe(true);
    expect(Object.isFrozen(RPG_AGENT_ROLES)).toBe(true);
    expect(Object.isFrozen(ROLE_TO_TIER)).toBe(true);
  });

  it("rejects writes to ROLE_TO_TIER at runtime in strict mode", () => {
    // ESM is always strict, so a write to a frozen object throws
    // synchronously. This catches the regression where someone deletes
    // Object.freeze and only the type-level Readonly<> remains.
    expect(() => {
      (ROLE_TO_TIER as unknown as Record<string, string>).orchestrator = "fast";
    }).toThrow();
  });
});

describe("schemas", () => {
  it("RPGAgentRoleSchema accepts canonical roles, rejects others", () => {
    expect(RPGAgentRoleSchema.safeParse("orchestrator").success).toBe(true);
    expect(RPGAgentRoleSchema.safeParse("nope").success).toBe(false);
  });

  it("TierNameSchema accepts canonical tiers, rejects others", () => {
    expect(TierNameSchema.safeParse("fast").success).toBe(true);
    expect(TierNameSchema.safeParse("smart").success).toBe(true);
    expect(TierNameSchema.safeParse("creative").success).toBe(true);
    expect(TierNameSchema.safeParse("medium").success).toBe(false);
  });

  it("isRPGAgentRole agrees with RPGAgentRoleSchema", () => {
    const candidates = ["orchestrator", "world-generator", "not-a-role", ""];
    for (const c of candidates) {
      expect(isRPGAgentRole(c)).toBe(RPGAgentRoleSchema.safeParse(c).success);
    }
  });
});
