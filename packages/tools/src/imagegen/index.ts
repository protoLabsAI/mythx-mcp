/**
 * Image Generation Tools
 *
 * Agent-callable tools for triggering SDXL image generation.
 */

export { generateSceneImageTool, GenerateSceneImageInputSchema } from "./generate-scene-image.js";
export type { GenerateSceneImageInput, GenerateSceneImageOutput } from "./generate-scene-image.js";

export { generatePortraitTool, GeneratePortraitInputSchema } from "./generate-portrait.js";
export type { GeneratePortraitInput, GeneratePortraitOutput } from "./generate-portrait.js";

export { generateItemArtTool, GenerateItemArtInputSchema } from "./generate-item-art.js";
export type { GenerateItemArtInput, GenerateItemArtOutput } from "./generate-item-art.js";

export {
  generateWorldImagesTool,
  GenerateWorldImagesInputSchema,
} from "./generate-world-images.js";
export type {
  GenerateWorldImagesInput,
  GenerateWorldImagesOutput,
  GenerateWorldImagesDetail,
} from "./generate-world-images.js";

// Export all imagegen tools as an array
import { generateSceneImageTool } from "./generate-scene-image.js";
import { generatePortraitTool } from "./generate-portrait.js";
import { generateItemArtTool } from "./generate-item-art.js";
import { generateWorldImagesTool } from "./generate-world-images.js";

export const imagegenTools = [
  generateSceneImageTool,
  generatePortraitTool,
  generateItemArtTool,
  generateWorldImagesTool,
];
