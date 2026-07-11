/**
 * Leads Helpers
 *
 * Shared types and utilities for lead tools.
 */

import type { GameTime, ToolContext } from "@mythxengine/types";
import { resolveRawSituations, type SituationSourceSession } from "../situations/index.js";

/**
 * Lead type from generated content
 */
export interface Lead {
  id: string;
  information: string;
  targetSituationId: string;
  discovery: {
    method: string;
    sourceId?: string;
    description: string;
    test?: {
      ability: string;
      difficulty: number;
      skill?: string;
    };
  };
  prominence: "obvious" | "available" | "hidden" | "obscured";
  prerequisites?: {
    requiredFlags?: string[];
    blockedByFlags?: string[];
    timeWindow?: {
      after?: { day: number; hour: number };
      before?: { day: number; hour: number };
    };
  };
  gmNotes?: string;
}

/**
 * Situation type from generated content
 */
export interface Situation {
  id: string;
  name: string;
  outgoingLeads: Lead[];
}

/**
 * Session shape expected by leads helpers
 */
export type LeadsSession = SituationSourceSession;

/**
 * Type guard to check if an unknown value is a valid Situation
 */
export function isSituation(value: unknown): value is Situation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    (obj.outgoingLeads === undefined || Array.isArray(obj.outgoingLeads))
  );
}

/**
 * Get all situations for a session with runtime validation.
 * Reads generated content first, falling back to the session's world pack.
 *
 * @param ctx - Tool context (world pack access for the fallback)
 * @param session - Session with generation data and/or worldPackId
 * @returns Array of validated Situation objects
 */
export async function getSituations(
  ctx: Pick<ToolContext, "worldPacks">,
  session: LeadsSession
): Promise<Situation[]> {
  const raw = await resolveRawSituations(ctx, session);
  return raw.filter(isSituation);
}

/**
 * Get all leads across all situations
 *
 * @param situations - Array of Situation objects
 * @returns Flattened array of all leads
 */
export function getAllLeads(situations: Situation[]): Lead[] {
  const leads: Lead[] = [];
  for (const situation of situations) {
    if (situation.outgoingLeads) {
      leads.push(...situation.outgoingLeads);
    }
  }
  return leads;
}

/**
 * Format game time as human-readable string
 *
 * @param time - GameTime object with day, hour, minute
 * @returns Formatted string like "Day 1, 2:30 PM"
 */
export function formatGameTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? "AM" : "PM";
  const min = time.minute.toString().padStart(2, "0");
  return `Day ${time.day}, ${hour12}:${min} ${ampm}`;
}
