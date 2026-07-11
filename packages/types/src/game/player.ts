/**
 * Player/Actor types for multi-player support
 *
 * Key insight: Separate players (who takes turns) from characters (game mechanics).
 * A player controls a character, but they are distinct entities.
 */

/**
 * AI playstyle persona for AI-controlled players
 */
export type AIPlaystyle = "tactical" | "roleplay" | "cautious" | "reckless";

/**
 * AI persona configuration for AI-controlled players
 */
export interface PlayerAIPersona {
  /** How the AI approaches decisions */
  playstyle: AIPlaystyle;
  /** How much the AI talks in-character (0-10) */
  talkativeness: number;
  /** Specific personality notes for this AI player */
  personalityNotes?: string;
}

/**
 * Player role in the session
 */
export type PlayerRole = "gm" | "pc" | "spectator";

/**
 * Whether the player is human or AI controlled
 */
export type PlayerControlType = "human" | "ai";

/**
 * Player status in the session
 */
export type PlayerStatus = "active" | "inactive" | "waiting_for_input";

/**
 * Pending action for human players awaiting input
 */
export interface PendingPlayerAction {
  /** What we're asking the player to decide */
  prompt: string;
  /** Optional preset choices */
  choices?: string[];
  /** When this action was requested */
  requestedAt: string;
  /** Context for the decision (scene, situation, etc.) */
  context?: string;
}

/**
 * Player/Actor in the session
 *
 * Represents someone (human or AI) who takes actions in the game.
 * Players control characters, but the mapping is separate.
 */
export interface Player {
  /** Unique player ID (e.g., "player-1", "ai-rogue") */
  id: string;
  /** Display name for this player */
  name: string;
  /** Role in the game */
  role: PlayerRole;
  /** Human or AI controlled */
  controlType: PlayerControlType;
  /** Linked character ID (for PC players) */
  characterId?: string;
  /** Current status */
  status: PlayerStatus;
  /** AI configuration (only for AI players) */
  aiPersona?: PlayerAIPersona;
  /** Pending action awaiting input (only for human players) */
  pendingAction?: PendingPlayerAction;
  /** Dynamic internal state for AI companions (loyalty, opinions, memories) */
  companionState?: CompanionState;
  /** When this player joined */
  joinedAt: string;
  /** Last activity timestamp */
  lastActiveAt: string;
}

/**
 * Turn coordination strategy
 */
export type TurnStrategy = "round_robin" | "gm_directed" | "free_form";

/**
 * Turn state for coordinated gameplay
 */
export interface TurnState {
  /** How turns are managed */
  strategy: TurnStrategy;
  /** Currently active player ID (null if no one's turn) */
  currentPlayerId: string | null;
  /** Turn order (player IDs) for round_robin */
  turnOrder: string[];
  /** Current index in turnOrder */
  turnIndex: number;
  /** Current round number (increments when all players have acted) */
  round: number;
  /** Whether we're waiting for human input */
  waitingForHumanInput: boolean;
  /** When turns started */
  startedAt: string;
}

/**
 * AI companion's dynamic internal state — tracks loyalty, mood, and memories
 * so the GM can reflect evolving relationships and attitudes over time.
 */
export interface CompanionState {
  loyalty: {
    /** Overall party loyalty (0–100) */
    toParty: number;
    /** Per-player trust keyed by player ID (0–100 each) */
    toPlayers: Record<string, number>;
    /** Hidden agenda the companion is pursuing, or null if none */
    hiddenAgenda: string | null;
    /** Conditional triggers that fire when narrative conditions are met */
    triggers?: Array<{
      /** Unique trigger ID */
      id: string;
      /** Natural-language condition that causes this trigger to fire */
      condition: string;
      /** What happens when the trigger fires */
      effect: "increase" | "decrease" | "betray" | "sacrifice";
      /** Magnitude of the loyalty change (1-100) */
      magnitude: number;
      /** Whether this trigger has already fired */
      fired: boolean;
    }>;
  };
  opinions: {
    /** Current emotional state / mood descriptor */
    currentMood: string;
    /** Things the companion resents or holds against the party */
    grievances: string[];
    /** Things the companion genuinely admires */
    admirations: string[];
    /** Active disagreements over plans, values, or actions */
    disagreements: string[];
  };
  memories: Array<{
    /** Description of the memorable event */
    event: string;
    /** Whether this left a good, bad, or complicated impression */
    impact: "positive" | "negative" | "complex";
    /** Whether the companion has worked through this memory */
    resolved: boolean;
  }>;
}

/**
 * Create default AI persona
 */
export function createDefaultAIPersona(playstyle: AIPlaystyle = "tactical"): PlayerAIPersona {
  return {
    playstyle,
    talkativeness: 5,
  };
}

/**
 * Create a new player
 */
export function createPlayer(
  id: string,
  name: string,
  role: PlayerRole,
  controlType: PlayerControlType
): Player {
  const now = new Date().toISOString();
  return {
    id,
    name,
    role,
    controlType,
    status: "active",
    joinedAt: now,
    lastActiveAt: now,
  };
}

/**
 * Create initial turn state
 */
export function createTurnState(strategy: TurnStrategy, playerIds: string[]): TurnState {
  return {
    strategy,
    currentPlayerId: playerIds.length > 0 ? playerIds[0] : null,
    turnOrder: playerIds,
    turnIndex: 0,
    round: 1,
    waitingForHumanInput: false,
    startedAt: new Date().toISOString(),
  };
}
