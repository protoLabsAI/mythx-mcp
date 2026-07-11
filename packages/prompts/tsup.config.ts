import { defineConfig } from "tsup";
import { cpSync } from "fs";

// Public build of @mythxengine/prompts — the skills-only subset. The private
// upstream has additional entries (prompt management, raw prompt bodies)
// that never ship here; the only public surface is the "./skills" subpath
// consumed by @mythxengine/tools' load_skill.
export default defineConfig({
  entry: {
    skills: "src/skills.ts",
  },
  format: ["esm"],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  sourcemap: true,
  clean: true,
  splitting: false,
  // Copy the on-demand skill .md files after build (clean: true wipes dist
  // between builds, so this restores them).
  onSuccess: async () => {
    cpSync("src/skills", "dist/skills", { recursive: true });
    console.log("Copied skills to dist/skills");
  },
});
