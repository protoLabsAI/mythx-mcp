/**
 * @mythxengine/rulebook
 *
 * Structured rulebook for MythxEngine — chapter / section / entry
 * hierarchy that powers the in-app GM/player guide and serves as the
 * canonical specification of the engine's mechanics.
 *
 * - Schema lives in `./schema/index.ts` (re-exported here)
 * - Content lives in `./content/index.ts` (re-exported here as `rulebook`)
 * - Lookup, search, and validation helpers in `./helpers.ts`
 */

export * from "./schema/index.js";
export * from "./helpers.js";
export * from "./format.js";
export { rulebook } from "./content/index.js";
