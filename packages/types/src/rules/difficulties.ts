/**
 * Difficulty Configuration
 *
 * Allows world packs to define custom difficulty levels.
 */

/**
 * Definition of a difficulty level
 */
export interface DifficultyDefinition {
  /** Unique identifier (e.g., "EASY", "STANDARD", "HARD") */
  id: string;
  /** Display name (e.g., "Easy", "Standard", "Hard") */
  name: string;
  /** Target number to meet or exceed */
  target: number;
  /** Description of when to use this difficulty */
  description?: string;
}

/**
 * Configuration for difficulties in a world pack
 */
export interface DifficultiesConfig {
  /**
   * Replace all base difficulties with these.
   * Use for systems with different difficulty scales.
   */
  replace?: DifficultyDefinition[];

  /**
   * Add these difficulties to the base set.
   * Use to add intermediate levels like "MODERATE" or "TRIVIAL".
   */
  add?: DifficultyDefinition[];
}

/**
 * Base difficulty definitions (the defaults)
 */
export const BASE_DIFFICULTIES: DifficultyDefinition[] = [
  {
    id: "EASY",
    name: "Easy",
    target: 8,
    description: "Simple tasks that most could accomplish",
  },
  {
    id: "STANDARD",
    name: "Standard",
    target: 12,
    description: "Tasks requiring skill or focus",
  },
  {
    id: "HARD",
    name: "Hard",
    target: 16,
    description: "Challenging tasks requiring expertise",
  },
  {
    id: "EXTREME",
    name: "Extreme",
    target: 20,
    description: "Near-impossible feats requiring mastery and luck",
  },
];

/**
 * Get the effective difficulties after applying configuration
 */
export function resolveDifficulties(
  config?: DifficultiesConfig
): DifficultyDefinition[] {
  if (!config) {
    return BASE_DIFFICULTIES;
  }

  // If replacing, use replacement set
  if (config.replace) {
    return config.replace;
  }

  // Start with base and add new ones
  let difficulties = [...BASE_DIFFICULTIES];

  if (config.add) {
    difficulties = [...difficulties, ...config.add];
  }

  // Sort by target number
  return difficulties.sort((a, b) => a.target - b.target);
}

/**
 * Find a difficulty by ID or target number
 */
export function findDifficulty(
  difficulties: DifficultyDefinition[],
  idOrTarget: string | number
): DifficultyDefinition | undefined {
  if (typeof idOrTarget === "string") {
    return difficulties.find(
      (d) => d.id.toUpperCase() === idOrTarget.toUpperCase()
    );
  }
  return difficulties.find((d) => d.target === idOrTarget);
}

/**
 * Convert difficulty levels to a record for easy lookup
 * @throws Error if duplicate IDs are found
 */
export function difficultiesToRecord(
  difficulties: DifficultyDefinition[]
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const d of difficulties) {
    if (record[d.id] !== undefined) {
      throw new Error(
        `Duplicate difficulty ID "${d.id}" with targets ${record[d.id]} and ${d.target}`
      );
    }
    record[d.id] = d.target;
  }
  return record;
}
