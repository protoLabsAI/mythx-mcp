/**
 * Game Frame Contract
 *
 * The frame loop's envelope: one GameFrame per turn, rendered as a
 * composed retro screen (scene image + narration + scene-type band +
 * party HUD + action input) instead of a chat transcript. See
 * docs/frame-loop-design.md for the presentation model and
 * stories/4-GameFrame for the comps this contract feeds.
 *
 * Projection composes the existing snapshot schemas (CharacterSnapshot,
 * ClockSnapshot, TimeSnapshot) so the HUD speaks the same shapes the
 * rest of the frontend sync already uses.
 */

import { z } from "zod";
import { ItemRaritySchema } from "./game/items.js";
import { CharacterSnapshotSchema, ClockSnapshotSchema, TimeSnapshotSchema } from "./snapshots.js";

// ============================================================================
// Scene type
// ============================================================================

/**
 * Selects the frame's anatomy: shared chrome stays constant, the
 * center band + action affordances change per type. MVP set — loot,
 * travel, and investigation are added when the projector produces them.
 */
export const SceneTypeSchema = z.enum(["exploration", "combat", "dialogue", "shop", "rest"]);
export type SceneType = z.infer<typeof SceneTypeSchema>;

// ============================================================================
// Frame image
// ============================================================================

/**
 * Scene art slot. Frames never wait on image generation: a frame ships
 * with `status: "pending"` and the viewport swaps the image in when
 * generation lands (same flow as ImageCard executing→complete).
 */
export const FrameImageSchema = z.object({
  url: z.string().nullable(),
  status: z.enum(["pending", "ready", "none"]),
  /** Prompt used (or to be used) for generation — lets a client re-request. */
  prompt: z.string().optional(),
  caption: z.string().optional(),
});
export type FrameImage = z.infer<typeof FrameImageSchema>;

// ============================================================================
// Suggested actions
// ============================================================================

/**
 * Pre-roll stakes on a suggested action — position/effect framed
 * BEFORE the dice (feel-report §(b)1: "the desperate framing before
 * the roll is what made the failure fair"). The action bar renders
 * these as chips; `hint` stays the free-form fallback for actions
 * without structured stakes.
 */
export const ActionStakesSchema = z.object({
  position: z.enum(["controlled", "risky", "desperate"]),
  effect: z.enum(["limited", "standard", "great"]),
  /** Ability tested, e.g. "WIT". */
  ability: z.string().optional(),
  /** Skill applied, e.g. "stealth". */
  skill: z.string().optional(),
  /** Difficulty as display text — a level name ("hard") or DC. */
  difficulty: z.string().optional(),
});
export type ActionStakes = z.infer<typeof ActionStakesSchema>;

/**
 * GM-curated affordances for this frame. `kind` mirrors the game-loop
 * protocol's PlayerActionCategory so dispatch stays one switch.
 */
export const SuggestedActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["move", "attack", "dialogue_choice", "use_item", "rest", "custom"]),
  /** Short mechanical context, e.g. "Kez — Finesse, risky". */
  hint: z.string().optional(),
  /** Structured stakes — preferred over `hint` when present. */
  stakes: ActionStakesSchema.optional(),
  disabled: z.boolean().default(false),
});
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

// ============================================================================
// Resolution beat
// ============================================================================

/**
 * A GM move suggested by a resolution envelope. `id` is the GMMove
 * union value; `label` is display-ready ("OFFER HARD BARGAIN").
 */
export const FrameGMMoveSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
});
export type FrameGMMove = z.infer<typeof FrameGMMoveSchema>;

/**
 * A clock the resolution ticked. Stage numbers are 1-based ("stage N
 * of totalStages"), matching the clock tools' output convention.
 *
 * Hidden clocks (GM-state, `playerVisible: false`) arrive REDACTED:
 * `hidden: true`, name is the redaction glyph, and stage numbers /
 * narrative are absent — dread needs a channel ("▓▓▓▓▓ advances…")
 * but the doom text stays GM-only.
 */
export const FrameClockTickSchema = z.object({
  clockId: z.string(),
  name: z.string(),
  hidden: z.boolean().default(false),
  previousStage: z.number().optional(),
  currentStage: z.number().optional(),
  totalStages: z.number().optional(),
  reachedDoom: z.boolean().default(false),
  /** Stage narrative — the dramatic line for the beat. */
  narrative: z.string().optional(),
});
export type FrameClockTick = z.infer<typeof FrameClockTickSchema>;

/**
 * The resolution beat — a direct projection of the roll_test / attack
 * envelope so the frame can stage the outcome (tier banner, named GM
 * move, clock ticks) instead of mulching it into narration. The frame
 * carries the LAST resolution of the turn; absent when the turn
 * resolved without dice.
 */
export const FrameResolutionSchema = z.object({
  tier: z.enum(["critical_success", "success", "partial", "failure", "critical_failure"]),
  /** Diegetic one-liner from the envelope. */
  summary: z.string(),
  /** What was attempted, for the card header (e.g. "WIT · DC 14" or "Iron Knife vs Enforcer"). */
  testLabel: z.string().optional(),
  roll: z.object({
    natural: z.number(),
    total: z.number(),
    /** Roll total minus difficulty; absent for attacks (not exposed). */
    margin: z.number().optional(),
  }),
  position: z.enum(["controlled", "risky", "desperate"]),
  effect: z.enum(["limited", "standard", "great"]),
  /** Suggested GM moves on partial/failure — first is the primary offer. */
  gmMoves: z.array(FrameGMMoveSchema).default([]),
  clocksTicked: z.array(FrameClockTickSchema).default([]),
  /** FitD meta-currency gate: the roll can be pushed (2 stress, +1d6). */
  pushAvailable: z.boolean().default(false),
  /** Resolved id of the character who rolled — the push interrupt acts on them. */
  actorId: z.string().optional(),
  /**
   * Set after the player pushes this resolution (the push interrupt):
   * tier/roll/summary above are already upgraded to the pushed values;
   * this block records what the push cost so the card can stage it.
   */
  pushed: z
    .object({
      bonus: z.number(),
      stressCost: z.number(),
      traumaGained: z.string().optional(),
    })
    .optional(),
});
export type FrameResolution = z.infer<typeof FrameResolutionSchema>;

// ============================================================================
// Scene-type bands
// ============================================================================

export const FrameDialogueSchema = z.object({
  npcId: z.string().optional(),
  npcName: z.string(),
  npcPortraitUrl: z.string().nullable().default(null),
  text: z.string(),
  responses: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** One-word read on the response, e.g. "Defiant", "Press". */
      tone: z.string().optional(),
    })
  ),
});
export type FrameDialogue = z.infer<typeof FrameDialogueSchema>;

export const FrameShopItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  rarity: ItemRaritySchema.default("common"),
  blurb: z.string().default(""),
});
export type FrameShopItem = z.infer<typeof FrameShopItemSchema>;

export const FrameShopSchema = z.object({
  shopName: z.string(),
  keeperName: z.string(),
  keeperPortraitUrl: z.string().nullable().default(null),
  playerGold: z.number(),
  flavor: z.string().default(""),
  items: z.array(FrameShopItemSchema),
});
export type FrameShop = z.infer<typeof FrameShopSchema>;

export const FrameRestSchema = z.object({
  haven: z.string(),
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      /** What it spends: time, clock ticks, etc. */
      cost: z.string().default(""),
      /** What it recovers or unlocks. */
      effect: z.string().default(""),
    })
  ),
  /** Optional interruption beat surfaced during the rest. */
  campEvent: z.string().optional(),
});
export type FrameRest = z.infer<typeof FrameRestSchema>;

/** Mirrors Enemy["threat"] from game/character.ts. */
export const FrameEnemyTierSchema = z.enum(["minion", "standard", "elite", "boss"]);
export type FrameEnemyTier = z.infer<typeof FrameEnemyTierSchema>;

export const FrameEnemySchema = z.object({
  id: z.string(),
  name: z.string(),
  hp: z.number(),
  maxHp: z.number(),
  tier: FrameEnemyTierSchema.default("standard"),
  conditions: z.array(z.string()).default([]),
  portraitUrl: z.string().nullable().default(null),
});
export type FrameEnemy = z.infer<typeof FrameEnemySchema>;

export const FrameCombatSchema = z.object({
  round: z.number(),
  enemies: z.array(FrameEnemySchema),
  /** Display order; `active` marks whose turn it is. */
  initiative: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isEnemy: z.boolean(),
      active: z.boolean().default(false),
    })
  ),
});
export type FrameCombat = z.infer<typeof FrameCombatSchema>;

// ============================================================================
// GameFrame
// ============================================================================

export const GameFrameSchema = z.object({
  /** Stable id for this frame (frame-<turn>-<nonce>). */
  id: z.string(),
  sessionId: z.string(),
  /** Monotonic per-session frame counter. */
  turn: z.number(),
  sceneType: SceneTypeSchema,
  /** Display name of where the party is; null before first framing. */
  location: z.string().nullable(),
  image: FrameImageSchema,
  /** The GM beat for this frame — prose, no tool chatter. */
  narration: z.string(),
  /**
   * The dice beat that produced this frame, when one happened —
   * rendered as the outcome card above the narration.
   */
  resolution: FrameResolutionSchema.optional(),
  /**
   * The player intent that produced this frame — free text or a
   * suggested-action label. Persisted so the executor can replay
   * frameHistory as alternating user/assistant conversation memory.
   * Absent on state-only projections (turn 0 HUD frames).
   */
  playerInput: z.string().optional(),
  party: z.array(CharacterSnapshotSchema),
  clocks: z.array(ClockSnapshotSchema).default([]),
  time: TimeSnapshotSchema.optional(),
  actions: z.array(SuggestedActionSchema).default([]),
  allowFreeText: z.boolean().default(true),
  /** Discoverable threads surfaced in exploration frames. */
  hints: z.array(z.string()).default([]),
  // Exactly the band matching sceneType is expected to be present.
  dialogue: FrameDialogueSchema.optional(),
  shop: FrameShopSchema.optional(),
  rest: FrameRestSchema.optional(),
  combat: FrameCombatSchema.optional(),
});
export type GameFrame = z.infer<typeof GameFrameSchema>;
