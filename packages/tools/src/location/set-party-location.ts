/**
 * Set Party Location Tool (Shared)
 *
 * Update the session's currentLocationId — the canonical "where the
 * party is" pointer. Drives the persistent scene panel in the UI
 * (looked up against the world pack to render the location's
 * pack-bundled image, name, description, connections).
 *
 * Validates against the active world pack: the locationId must exist
 * in the pack's locations bucket. Refuses unknown ids rather than
 * silently writing — invalid pointers would produce a "scene unset"
 * UI state with no signal of why.
 */

import { z } from "zod";
import { defineSharedTool } from "@mythxengine/types";

export const SetPartyLocationInputSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  locationId: z
    .string()
    .min(1)
    .describe("Id of the location the party is now at — must exist in the active world pack"),
});

export type SetPartyLocationInput = z.infer<typeof SetPartyLocationInputSchema>;

export interface SetPartyLocationOutput {
  /** Previous locationId, or null if unset */
  previousLocationId: string | null;
  /** New locationId now persisted on the session */
  currentLocationId: string;
  /** Resolved location name from the world pack, when available */
  locationName: string | null;
}

/**
 * Shape of what we read off a location entity in the compiled pack.
 * Pack JSON is user-authored and may carry extra fields — we only
 * inspect name to surface back in the tool result.
 */
interface PackLocationEntry {
  name?: string;
}

/**
 * Minimal compiled-pack shape we need: just the locations bucket
 * keyed by id. Anything else in the pack is ignored.
 */
interface CompiledPackLike {
  locations?: Record<string, PackLocationEntry>;
}

export const setPartyLocationTool = defineSharedTool({
  name: "set_party_location",
  description:
    "Update the session's current party location. The locationId must exist in the active world pack. Drives the persistent scene panel in the UI.",
  inputSchema: SetPartyLocationInputSchema,

  handler: async (input, ctx): Promise<SetPartyLocationOutput> => {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    // Validate against the world pack when one is active. Without a
    // pack we can't check membership — accept the write anyway so
    // pre-pack sessions (e.g. tutorials) aren't blocked. The UI lookup
    // will degrade gracefully if the id has no matching location.
    //
    // Capture the resolved location entry from this single fetch so
    // we can return its name in the result without a second round trip.
    const packId = session.worldPackId;
    let locationName: string | null = null;
    if (packId) {
      const pack = (await ctx.worldPacks.get(packId)) as CompiledPackLike | null;
      if (!pack) {
        throw new Error(`World pack not found: ${packId}`);
      }
      const locations = pack.locations ?? {};
      const entry = locations[input.locationId];
      if (!entry) {
        throw new Error(
          `Location '${input.locationId}' not found in world pack '${packId}'. Use a location id from the pack's locations bucket.`
        );
      }
      if (typeof entry.name === "string") {
        locationName = entry.name;
      }
    }

    const previousLocationId = session.currentLocationId ?? null;
    const updatedSession = {
      ...session,
      currentLocationId: input.locationId,
    };
    await ctx.sessions.save(updatedSession);

    return {
      previousLocationId,
      currentLocationId: input.locationId,
      locationName,
    };
  },
});
