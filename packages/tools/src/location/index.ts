/**
 * Location Tools Module
 *
 * Shared tool definitions for party-position state.
 */

export { setPartyLocationTool, SetPartyLocationInputSchema } from "./set-party-location.js";
export type { SetPartyLocationInput, SetPartyLocationOutput } from "./set-party-location.js";

import { setPartyLocationTool } from "./set-party-location.js";

export const locationTools = [setPartyLocationTool];
