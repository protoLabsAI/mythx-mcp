/**
 * Leads Tools
 *
 * Tools for managing leads/clues during gameplay.
 */

// Shared types and helpers (exported for potential reuse)
export {
  type Lead,
  type Situation,
  type LeadsSession,
  isSituation,
  getSituations,
  getAllLeads,
} from "./helpers.js";

export {
  getAvailableLeadsTool,
  type GetAvailableLeadsInput,
  type GetAvailableLeadsOutput,
} from "./get-available-leads.js";

export {
  revealLeadTool,
  type RevealLeadInput,
  type RevealLeadOutput,
} from "./reveal-lead.js";

export {
  searchLeadsTool,
  type SearchLeadsInput,
  type SearchLeadsOutput,
} from "./search-leads.js";

export {
  getDiscoveredLeadsTool,
  type GetDiscoveredLeadsInput,
  type GetDiscoveredLeadsOutput,
} from "./get-discovered-leads.js";

export {
  suggestLeadOpportunityTool,
  type SuggestLeadOpportunityInput,
  type SuggestLeadOpportunityOutput,
} from "./suggest-lead-opportunity.js";

import { getAvailableLeadsTool } from "./get-available-leads.js";
import { revealLeadTool } from "./reveal-lead.js";
import { searchLeadsTool } from "./search-leads.js";
import { getDiscoveredLeadsTool } from "./get-discovered-leads.js";
import { suggestLeadOpportunityTool } from "./suggest-lead-opportunity.js";

/**
 * All leads tools
 */
export const leadsTools = [
  getAvailableLeadsTool,
  revealLeadTool,
  searchLeadsTool,
  getDiscoveredLeadsTool,
  suggestLeadOpportunityTool,
];
