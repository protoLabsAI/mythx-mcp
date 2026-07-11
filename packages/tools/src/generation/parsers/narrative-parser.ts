/**
 * Narrative Guidance XML Parser
 *
 * Parses XML output for narrative guidance into NarrativeGuidance schema.
 */

import { NarrativeGuidanceSchema, type NarrativeGuidance } from "@mythxengine/worlds";
import { extractRequiredTag, extractAllTags } from "../xml-parser.js";

/**
 * Parse narrative guidance from XML output.
 *
 * Expected format:
 * ```xml
 * <narrative>
 *   <opening_scenes>
 *     <scene>The party awakens in a dimly lit tavern...</scene>
 *     <scene>A mysterious stranger approaches...</scene>
 *   </opening_scenes>
 *   <plot_hooks>
 *     <hook>The mayor's daughter has gone missing...</hook>
 *     <hook>Strange lights appear in the abandoned mine...</hook>
 *   </plot_hooks>
 *   <common_conflicts>
 *     <conflict>Rival factions vie for control of the city...</conflict>
 *     <conflict>Ancient evil stirs beneath the earth...</conflict>
 *   </common_conflicts>
 *   <resolution_patterns>
 *     <pattern>Heroes uncover the truth behind the conspiracy...</pattern>
 *     <pattern>A sacrifice must be made to save the realm...</pattern>
 *   </resolution_patterns>
 * </narrative>
 * ```
 */
export function parseNarrativeXML(output: string): NarrativeGuidance {
  const narrativeBlock = extractRequiredTag(output, "narrative");

  const narrative: NarrativeGuidance = {
    openingScenes: extractAllTags(extractRequiredTag(narrativeBlock, "opening_scenes"), "scene"),
    plotHooks: extractAllTags(extractRequiredTag(narrativeBlock, "plot_hooks"), "hook"),
    commonConflicts: extractAllTags(
      extractRequiredTag(narrativeBlock, "common_conflicts"),
      "conflict"
    ),
    resolutionPatterns: extractAllTags(
      extractRequiredTag(narrativeBlock, "resolution_patterns"),
      "pattern"
    ),
  };

  // Validate against Zod schema
  return NarrativeGuidanceSchema.parse(narrative);
}
