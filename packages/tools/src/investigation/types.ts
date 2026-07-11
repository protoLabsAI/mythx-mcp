/**
 * Investigation types
 */

import type { GameTime } from "@mythxengine/types";

/** Investigation status */
export const INVESTIGATION_STATUS = ["active", "solved", "cold", "abandoned"] as const;
export type InvestigationStatus = (typeof INVESTIGATION_STATUS)[number];

/** Hypothesis status */
export const HYPOTHESIS_STATUS = ["active", "confirmed", "refuted", "abandoned"] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUS)[number];

/** Test result */
export const TEST_RESULTS = ["untested", "supports", "refutes", "inconclusive"] as const;
export type TestResult = (typeof TEST_RESULTS)[number];

/**
 * Evidence in an investigation
 */
export interface Evidence {
  id: string;
  description: string;
  source: string;
  discoveredAt: GameTime;
  connects?: string[];
  interpretation?: string;
  isRedHerring?: boolean;
}

/**
 * Test performed on a hypothesis
 */
export interface HypothesisTest {
  description: string;
  result?: TestResult;
}

/**
 * Player hypothesis about the mystery
 */
export interface Hypothesis {
  id: string;
  statement: string;
  status: HypothesisStatus;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  tests: HypothesisTest[];
}

/**
 * Null result (search that found nothing)
 */
export interface NullResult {
  search: string;
  location?: string;
  timestamp: GameTime;
  meaning: string;
}

/**
 * Investigation truth (GM-only)
 */
export interface InvestigationTruth {
  summary: string;
  perpetrator?: string;
  motive?: string;
  method?: string;
  keyFacts: string[];
}

/**
 * Investigation structure
 */
export interface Investigation {
  id: string;
  name: string;
  status: InvestigationStatus;
  truth: InvestigationTruth;
  evidence: Evidence[];
  hypotheses: Hypothesis[];
  nullResults: NullResult[];
  openQuestions: string[];
  situationIds: string[];
}

/**
 * Session with investigations
 */
export interface InvestigationSession {
  worldState: {
    investigations?: Investigation[];
  };
  flags: string[];
  gameTime: GameTime;
}

/**
 * Get investigations from session
 */
export function getInvestigations(session: InvestigationSession): Investigation[] {
  return session.worldState.investigations || [];
}

/**
 * Save investigations to session
 */
export function saveInvestigations(
  session: InvestigationSession,
  investigations: Investigation[]
): void {
  session.worldState.investigations = investigations;
}

/**
 * Format game time
 */
export function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}
