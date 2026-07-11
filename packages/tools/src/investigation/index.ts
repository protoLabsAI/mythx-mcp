/**
 * Investigation Tools
 *
 * Tools for tracking investigations, evidence, hypotheses, and null results.
 * Based on Alexandrian principles: Three Clue Rule and hypothesis testing.
 */

// Types and helpers (excluding formatGameTime to avoid conflicts)
export type {
  InvestigationStatus,
  HypothesisStatus,
  TestResult,
  Evidence,
  HypothesisTest,
  Hypothesis,
  NullResult,
  InvestigationTruth,
  Investigation,
  InvestigationSession,
} from "./types.js";
export {
  INVESTIGATION_STATUS,
  HYPOTHESIS_STATUS,
  TEST_RESULTS,
  getInvestigations,
  saveInvestigations,
} from "./types.js";

// Tools
export {
  startInvestigationTool,
  type StartInvestigationInput,
  type StartInvestigationOutput,
} from "./start-investigation.js";

export {
  addEvidenceTool,
  type AddEvidenceInput,
  type AddEvidenceOutput,
} from "./add-evidence.js";

export {
  addHypothesisTool,
  type AddHypothesisInput,
  type AddHypothesisOutput,
} from "./add-hypothesis.js";

export {
  testHypothesisTool,
  type TestHypothesisInput,
  type TestHypothesisOutput,
} from "./test-hypothesis.js";

export {
  recordNullResultTool,
  type RecordNullResultInput,
  type RecordNullResultOutput,
} from "./record-null-result.js";

export {
  getInvestigationStatusTool,
  type GetInvestigationStatusInput,
  type GetInvestigationStatusOutput,
} from "./get-investigation-status.js";

export {
  suggestInvestigationStepsTool,
  type SuggestInvestigationStepsInput,
  type SuggestInvestigationStepsOutput,
} from "./suggest-investigation-steps.js";

export {
  updateInvestigationStatusTool,
  type UpdateInvestigationStatusInput,
  type UpdateInvestigationStatusOutput,
} from "./update-investigation-status.js";

// Tool array
import { startInvestigationTool } from "./start-investigation.js";
import { addEvidenceTool } from "./add-evidence.js";
import { addHypothesisTool } from "./add-hypothesis.js";
import { testHypothesisTool } from "./test-hypothesis.js";
import { recordNullResultTool } from "./record-null-result.js";
import { getInvestigationStatusTool } from "./get-investigation-status.js";
import { suggestInvestigationStepsTool } from "./suggest-investigation-steps.js";
import { updateInvestigationStatusTool } from "./update-investigation-status.js";

/**
 * All investigation tools
 */
export const investigationTools = [
  startInvestigationTool,
  addEvidenceTool,
  addHypothesisTool,
  testHypothesisTool,
  recordNullResultTool,
  getInvestigationStatusTool,
  suggestInvestigationStepsTool,
  updateInvestigationStatusTool,
];
