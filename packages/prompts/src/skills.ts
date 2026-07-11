/**
 * Skills system — on-demand prompt fragments the agent can load at runtime.
 *
 * Mirrors Claude Code's skills pattern (one .md per skill, frontmatter +
 * body). The agent sees only the skills index in its system prompt
 * (name + description, ~one line each); the full body is loaded only
 * when the agent calls `load_skill(name)`. This keeps the always-loaded
 * pinned slab small while still making domain-specific guidance available
 * when the agent decides it's relevant.
 *
 * Skills live at `packages/prompts/src/skills/<name>.md` and ship via
 * `dist/skills/` (tsup onSuccess copies them, same as `raw/`).
 *
 * Frontmatter format:
 *
 *   ---
 *   name: image-generation
 *   description: One-line summary the agent reads when deciding whether to load.
 *   when_to_load: human-helpful trigger hints (optional)
 *   ---
 *
 *   # Skill body (markdown)
 *
 * The `description` field is what the agent sees in its skills index, so
 * write it as a useful "this is what's in here" summary, not a tagline.
 */

import { resolve, dirname, join } from "node:path";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Walk up from `startDir` to the nearest directory containing a
 * `package.json` — the root of whatever package this module was
 * compiled into (prompts itself in dev/dist, or a consumer like
 * `@mythxengine/mcp-server` when this file is bundled into its
 * single-file publish build).
 */
function findConsumingPackageRoot(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Where to look for skill .md files, first existing candidate wins:
 *
 * 1. `MYTHX_SKILLS_DIR` env var — explicit override.
 * 2. `<__dirname>/skills` — prompts' own layout: tsup copies
 *    `src/skills/` to `dist/skills/` at build time, so this resolves
 *    in both dev (running from src via tsx) and prod (running from dist).
 * 3. `<consuming package root>/skills` — when this module is bundled
 *    into another package (e.g. the mcp-server npm publish build,
 *    whose compiled file lives at `<pkgRoot>/dist/index.js` and ships
 *    the .md files at `<pkgRoot>/skills/`).
 */
function resolveSkillsDir(): string | null {
  const override = process.env.MYTHX_SKILLS_DIR;
  if (override) {
    // The override is trusted, not fixed up — but a typo'd path would
    // otherwise surface only as a mystifying "no skills available", so
    // say what we looked at (mirrors BUNDLED_PACKS_DIR's warning).
    if (!existsSync(override)) {
      console.warn(`[skills] MYTHX_SKILLS_DIR is set but no directory at ${override}`);
    }
    return override;
  }

  const local = resolve(__dirname, "./skills");
  if (existsSync(local)) return local;

  const pkgRoot = findConsumingPackageRoot(__dirname);
  if (pkgRoot) {
    const packaged = join(pkgRoot, "skills");
    if (existsSync(packaged)) return packaged;
  }

  return null;
}

export interface SkillFrontmatter {
  /** Stable identifier — what callers pass to load_skill. Matches the file basename. */
  name: string;
  /** One-line summary shown in the skills index so the agent can decide whether to load. */
  description: string;
  /** Optional human-helpful trigger hints — not used at runtime, just documentation. */
  when_to_load?: string;
}

export interface Skill extends SkillFrontmatter {
  /** Markdown body (without frontmatter). */
  body: string;
}

/**
 * Parse YAML-ish frontmatter out of a markdown file. Only handles the
 * scalar string fields skills use today (name / description / when_to_load) —
 * if a skill ever needs lists or nested objects, swap in `gray-matter` or
 * similar; the runtime cost of a real YAML parser isn't worth it for the
 * three keys we actually use.
 */
export function parseSkillFrontmatter(source: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(
      "Skill file is missing frontmatter. Expected `---\\nname: ...\\ndescription: ...\\n---\\n` at the top."
    );
  }
  const [, frontmatterRaw, body] = match;
  const fields: Partial<SkillFrontmatter> = {};
  for (const line of frontmatterRaw.split(/\r?\n/)) {
    const fieldMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!fieldMatch) continue;
    const [, key, valueRaw] = fieldMatch;
    const value = valueRaw.trim().replace(/^["'](.*)["']$/, "$1");
    if (key === "name" || key === "description" || key === "when_to_load") {
      fields[key] = value;
    }
  }
  if (!fields.name) throw new Error("Skill frontmatter missing required field: name");
  if (!fields.description) throw new Error("Skill frontmatter missing required field: description");
  return { frontmatter: fields as SkillFrontmatter, body: body.trim() };
}

/**
 * In-memory cache. Skills are read from disk on first access and held
 * for the process lifetime — the bodies don't change at runtime. Tests
 * that mutate the skills dir should `resetSkillsCache()`.
 */
let skillsCache: Map<string, Skill> | null = null;

export function resetSkillsCache(): void {
  skillsCache = null;
}

function loadAllSkills(): Map<string, Skill> {
  if (skillsCache) return skillsCache;
  const map = new Map<string, Skill>();
  const skillsDir = resolveSkillsDir();
  if (!skillsDir || !existsSync(skillsDir)) {
    skillsCache = map;
    return map;
  }
  for (const entry of readdirSync(skillsDir)) {
    if (!entry.endsWith(".md")) continue;
    const fullPath = join(skillsDir, entry);
    const source = readFileSync(fullPath, "utf-8");
    try {
      const { frontmatter, body } = parseSkillFrontmatter(source);
      // Enforce that the file basename matches the declared name so
      // callers can rely on `load_skill(name)` resolving by either.
      const expectedName = entry.replace(/\.md$/, "");
      if (frontmatter.name !== expectedName) {
        throw new Error(
          `Skill ${entry}: frontmatter name "${frontmatter.name}" doesn't match filename "${expectedName}"`
        );
      }
      map.set(frontmatter.name, { ...frontmatter, body });
    } catch (err) {
      throw new Error(`Failed to parse skill ${entry}: ${(err as Error).message}`);
    }
  }
  skillsCache = map;
  return map;
}

/**
 * List every available skill as `{name, description}` pairs. Stable
 * sort by name so the system-prompt index doesn't churn between
 * builds (Anthropic prompt caching is sensitive to ordering).
 */
export function listSkills(): Array<{ name: string; description: string }> {
  const all = loadAllSkills();
  return [...all.values()]
    .map((s) => ({ name: s.name, description: s.description }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load a skill's body. Throws if the skill doesn't exist — callers
 * (the load_skill tool) should surface the available names so the
 * agent can self-correct.
 */
export function getSkill(name: string): Skill {
  const all = loadAllSkills();
  const skill = all.get(name);
  if (!skill) {
    const available = [...all.keys()].sort().join(", ");
    throw new Error(`Skill not found: "${name}". Available: ${available || "(none)"}`);
  }
  return skill;
}
