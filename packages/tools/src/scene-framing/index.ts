/**
 * Scene Framing Tools Module
 *
 * Shared tool definitions for scene pacing and transitions.
 */

export {
  analyzeSceneTool,
  AnalyzeSceneInputSchema,
} from "./analyze-scene.js";
export type {
  AnalyzeSceneInput,
  AnalyzeSceneOutput,
} from "./analyze-scene.js";

export {
  suggestSceneCutTool,
  SuggestSceneCutInputSchema,
} from "./suggest-scene-cut.js";
export type {
  SuggestSceneCutInput,
  SuggestSceneCutOutput,
} from "./suggest-scene-cut.js";

export {
  frameSceneTool,
  FrameSceneInputSchema,
} from "./frame-scene.js";
export type {
  FrameSceneInput,
  FrameSceneOutput,
} from "./frame-scene.js";

// Export all scene framing tools as an array
import { analyzeSceneTool } from "./analyze-scene.js";
import { suggestSceneCutTool } from "./suggest-scene-cut.js";
import { frameSceneTool } from "./frame-scene.js";

export const sceneFramingTools = [
  analyzeSceneTool,
  suggestSceneCutTool,
  frameSceneTool,
];
