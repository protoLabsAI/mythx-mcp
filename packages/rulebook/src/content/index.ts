/**
 * Rulebook content — assembled from the per-chapter files.
 *
 * Each chapter lives in its own file (e.g. `01-foundations.ts`) and
 * exports a `Chapter` value. This barrel imports them in order and
 * builds the full `Rulebook` value. The `version` is bumped manually
 * when authored content changes meaningfully.
 *
 * The exported `rulebook` is parsed against `RulebookSchema` so any
 * shape error surfaces at module-load time, not at first render.
 */

import { RulebookSchema, type Rulebook } from "../schema/index.js";
import { foundationsChapter } from "./01-foundations.js";
import { outcomeSystemChapter } from "./02-outcome-system.js";
import { positionEffectChapter } from "./03-position-effect.js";
import { testsChapter } from "./04-tests.js";
import { stressChapter } from "./05-stress.js";
import { combatChapter } from "./06-combat.js";
import { conditionsChapter } from "./07-conditions.js";
import { equipmentChapter } from "./08-equipment.js";
import { timeClocksChapter } from "./09-time-clocks.js";
import { gmMovesChapter } from "./10-gm-moves.js";
import { worldOverridesChapter } from "./11-world-overrides.js";
import { gmSupportChapter } from "./12-gm-support.js";

const rawRulebook: Rulebook = {
  title: "MythxEngine Rulebook",
  version: "0.1.0",
  chapters: [
    foundationsChapter,
    outcomeSystemChapter,
    positionEffectChapter,
    testsChapter,
    stressChapter,
    combatChapter,
    conditionsChapter,
    equipmentChapter,
    timeClocksChapter,
    gmMovesChapter,
    worldOverridesChapter,
    gmSupportChapter,
  ],
};

/**
 * The full rulebook, validated against `RulebookSchema` on load.
 *
 * Throws at module-init if the authored content is malformed — that's
 * intentional: a broken rulebook should fail loud at build/import,
 * not silently render garbage in the UI.
 */
export const rulebook: Rulebook = RulebookSchema.parse(rawRulebook);
