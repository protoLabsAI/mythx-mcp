/**
 * Tests for the skills loader — specifically the candidate-based
 * directory resolution added for the mcp-server npm publish bundle:
 *
 *   1. MYTHX_SKILLS_DIR env var (explicit override)
 *   2. <__dirname>/skills (prompts' own src/dist layout)
 *   3. <consuming package root>/skills (bundled into another package)
 *
 * Candidate 3 can't be exercised from inside this package (candidate 2
 * always exists here); it's covered end-to-end by
 * scripts/smoke-npm-tarball.mjs, which calls load_skill against the
 * installed npm tarball.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSkills, getSkill, resetSkillsCache } from "../skills.js";

const savedEnv = process.env.MYTHX_SKILLS_DIR;
const tempDir = mkdtempSync(join(tmpdir(), "mythx-skills-test-"));

writeFileSync(
  join(tempDir, "test-skill.md"),
  [
    "---",
    "name: test-skill",
    "description: A skill used only by tests.",
    "---",
    "",
    "# Test Skill",
    "",
    "Body content for the test skill.",
  ].join("\n")
);

beforeEach(() => {
  resetSkillsCache();
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.MYTHX_SKILLS_DIR;
  else process.env.MYTHX_SKILLS_DIR = savedEnv;
  resetSkillsCache();
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("skills directory resolution", () => {
  it("MYTHX_SKILLS_DIR override wins over the package's own skills dir", () => {
    process.env.MYTHX_SKILLS_DIR = tempDir;
    const skills = listSkills();
    expect(skills).toEqual([{ name: "test-skill", description: "A skill used only by tests." }]);
    expect(getSkill("test-skill").body).toContain("Body content for the test skill.");
  });

  it("falls back to the package's own skills dir when no override is set", () => {
    delete process.env.MYTHX_SKILLS_DIR;
    const names = listSkills().map((s) => s.name);
    // The five runtime skills the public load_skill tool must ship.
    expect(names).toEqual(
      expect.arrayContaining([
        "combat-runner",
        "companion-intelligence",
        "engine-flows",
        "image-generation",
        "player-interaction",
      ])
    );
    for (const skill of listSkills()) {
      expect(skill.description.length).toBeGreaterThan(0);
    }
  });

  it("an override pointing at a missing dir yields no skills but warns (env is trusted, not fixed up)", () => {
    const missingDir = join(tempDir, "does-not-exist");
    process.env.MYTHX_SKILLS_DIR = missingDir;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(listSkills()).toEqual([]);
      expect(() => getSkill("combat-runner")).toThrow(/Available: \(none\)/);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`MYTHX_SKILLS_DIR is set but no directory at ${missingDir}`)
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("unknown skill error lists the available names so the agent can self-correct", () => {
    process.env.MYTHX_SKILLS_DIR = tempDir;
    expect(() => getSkill("nope")).toThrow(/Skill not found: "nope"\. Available: test-skill/);
  });
});
