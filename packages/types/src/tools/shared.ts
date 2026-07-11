/**
 * Shared Tool Architecture Types
 *
 * Transport-agnostic interfaces that work with both MCP server and LangGraph.
 * Future-proofed for PayloadCMS persistence and EventBus real-time sync.
 */

import { z } from "zod";
import type { SessionState } from "../session/index.js";
import type { GameEvent } from "../game/index.js";

// ============================================================================
// Storage Provider Interfaces (abstracts File vs PayloadCMS)
// ============================================================================

/**
 * Session storage interface - abstracts file-based vs database persistence
 */
export interface ISessionManager {
  /** Get a session by ID, returns null if not found */
  get(sessionId: string): Promise<SessionState | null>;
  /** Get or create a session */
  getOrCreate(sessionId: string, name?: string): Promise<SessionState>;
  /** Save session state */
  save(state: SessionState): Promise<void>;
  /** Delete a session */
  delete(sessionId: string): Promise<void>;
  /** List all session IDs */
  list(): Promise<string[]>;
}

/**
 * World pack storage interface
 * Uses `unknown` for WorldContentPack to avoid circular dependency with @mythxengine/worlds
 */
export interface IWorldPackManager {
  /** Get a world pack by ID */
  get(packId: string): Promise<unknown | null>;
  /** Get a compact summary of the world pack */
  getSummary?(packId: string): Promise<unknown | null>;
  /** Save a world pack */
  save(packId: string, pack: unknown): Promise<void>;
  /** Delete a world pack */
  delete(packId: string): Promise<void>;
  /** List all world pack IDs */
  list(): Promise<string[]>;
}

// ============================================================================
// EventBus Interface (optional real-time sync)
// ============================================================================

/**
 * Event payload for the event bus
 */
export interface BusEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type (e.g., 'DICE_ROLLED', 'COMBAT_STARTED') */
  type: string;
  /** Channel this event was published to */
  channel: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Associated session ID if applicable */
  sessionId?: string;
  /** Event payload data */
  payload: T;
  /** Event source identification */
  source?: {
    type: "tool" | "agent" | "engine" | "system";
    id: string;
  };
  /** If set, only these players should see this event (client-side filtering) */
  targetPlayerIds?: string[];
  /**
   * Free-form correlation metadata. The gameplay-events sink reads
   * `meta.causedBy` to populate `gameplay_events.turn_id`, grouping
   * tool emits under the parent chat turn — see
   * `packages/storage/src/training/sink.ts:166`.
   */
  meta?: {
    causedBy?: string;
    sequence?: number;
    version?: number;
  };
}

/**
 * Event bus interface for real-time communication
 * Follows Redis pub/sub pattern for compatibility
 */
export interface IEventBus {
  /** Publish an event to a channel */
  publish<T>(channel: string, event: BusEvent<T>): void;
  /** Subscribe to a channel, returns unsubscribe function */
  subscribe<T>(channel: string, handler: (event: BusEvent<T>) => void): () => void;
  /** Pattern-based subscription (Redis-style wildcards) */
  psubscribe<T>(
    pattern: string,
    handler: (channel: string, event: BusEvent<T>) => void
  ): () => void;
}

/**
 * No-op event bus implementation for MCP (file-based, no real-time)
 */
export const nullEventBus: IEventBus = {
  publish: () => {},
  subscribe: () => () => {},
  psubscribe: () => () => {},
};

// ============================================================================
// Rules Context (for game mechanics)
// ============================================================================

/**
 * Rules context interface - minimal definition to avoid circular deps
 * Full implementation in @mythxengine/engine
 */
export interface IRulesContext {
  rules: {
    abilities?: unknown[];
    skills?: unknown[];
    customTests?: unknown[];
    conditions?: unknown[];
  };
}

/**
 * Function to get rules for a session
 */
export type GetRulesFunction = (session: SessionState) => Promise<IRulesContext>;

// ============================================================================
// Tool Context (injected into all shared tools)
// ============================================================================

/** World media manager interface for cache checks in imagegen tools */
export interface IWorldMediaManager {
  listByEntity(
    packId: string,
    entityType: string,
    entityId: string
  ): Promise<Array<{ id: string; filename: string; role?: string }>>;
  save(
    packId: string,
    entry: {
      id: string;
      filename: string;
      mimeType: string;
      entityType?: string;
      entityId?: string;
      role?: string;
      sizeBytes?: number;
      createdAt: string;
    },
    data: Buffer
  ): Promise<string>;
}

/**
 * Minimal structural type for a UI message stream writer the chat
 * route can hand to tools so they can push their own prose / chunks
 * directly into the parent response stream.
 *
 * Matches the shape of AI SDK v6's `UIMessageStreamWriter` (the two
 * methods we actually call) without forcing @mythxengine/types to
 * depend on `ai`. The chat route passes the real writer; tools call
 * `merge()` to splice a subagent's stream into the parent in real
 * time, or `write()` for a single chunk.
 *
 * The chunk type is unconstrained here because tools shouldn't be
 * authoring custom UI chunk shapes — they should be calling
 * `merge()` with a stream produced by AI SDK helpers (e.g.
 * `streamText(...).toUIMessageStream()`).
 */
export interface ChatStreamWriter {
  /** Push a single UI chunk into the parent stream. */
  write(chunk: unknown): void;
  /** Splice another readable stream of UI chunks into the parent. */
  merge(stream: ReadableStream<unknown>): void;
}

/**
 * Context object provided to all shared tools
 */
export interface ToolContext {
  /** Session storage manager */
  sessions: ISessionManager;
  /** World pack storage manager */
  worldPacks: IWorldPackManager;
  /** Function to get rules context for a session */
  getRules: GetRulesFunction;
  /** Event bus for real-time sync (nullEventBus for MCP) */
  eventBus: IEventBus;
  /** World pack media storage (optional — not available in MCP server) */
  worldMedia?: IWorldMediaManager;
  /** Session media storage (optional — for runtime image saves) */
  sessionMedia?: ISessionMediaManager;
  /**
   * Active session ID for the current request.
   *
   * Set by the chat route at request scope. The AI SDK tool adapter
   * overrides every tool input's `sessionId` field with this value
   * before Zod validation — so a model that fabricates a placeholder
   * ("session_01", "current_session_id") or omits sessionId entirely
   * still ends up calling the right session. This matters most for
   * subagents whose only context is the orchestrator's brief: they
   * don't see the request scope at all without this defaulting.
   *
   * Optional because non-chat callers (MCP server, scripts, unit
   * tests) supply sessionId per-call and don't need a context-level
   * default.
   */
  sessionId?: string;
  /**
   * Current chat turn ID — when set by the chat route, every tool that
   * publishes a BusEvent should pass this as `meta.causedBy` so the
   * gameplay-events sink can group the resulting row under the same
   * `turn_id` as the parent `chat_turn_started` row. Without this,
   * events emitted from tools (e.g. SCENE_FRAMED from frame_scene)
   * land in `gameplay_events` with `turn_id = NULL` and the
   * training-export pipeline can't reconstruct what happened in that
   * turn. Optional because non-chat callers (MCP server, agent
   * scripts) don't have a turn concept.
   */
  currentTurnId?: string;
  /**
   * Abort signal for the current request. When the chat route is
   * driven by a Web `Request`, this is `request.signal` — wired
   * straight through to `streamText({ abortSignal })`, sub-loop
   * `generateText({ abortSignal })` (in dispatch_subagent), and any
   * tool whose handler does its own long-running work (image
   * generation, fetches to a remote model). When the user hits the
   * "Stop" button in the chat UI, `useChat`'s `stop()` aborts the
   * underlying fetch — the server sees this signal flip to aborted,
   * and we want it to propagate everywhere instead of letting an
   * 8-step plan keep burning tokens after the user has already
   * walked away.
   *
   * Optional because non-HTTP callers (MCP server, agent scripts,
   * unit tests) don't have a request signal — they should be able to
   * run tools without one. cc-2.18 pattern #5 (interruptBehavior).
   */
  abortSignal?: AbortSignal;
  /**
   * Skills the agent has loaded this session via `load_skill`.
   *
   * Built by scanning prior model messages when the chat route
   * constructs the context, then mutated by `load_skill`'s postTool
   * hook so within-turn retries see the just-loaded skill in the
   * same multi-step loop.
   *
   * Gates on skill-prerequisite tools (`take_rest`, `browse_shop`,
   * `buy_item`, etc.) read this Set via the `requireSkill` helper
   * and refuse with a "load X first" reason when the required skill
   * isn't present. This is the cc-2.18 pattern of making a
   * specialized capability load-bearing — if the playbook says
   * "load skill X before doing Y", the gate enforces it instead of
   * leaving it to model discretion.
   *
   * Optional because non-chat callers (MCP server, scripts, unit
   * tests) don't have a skill-loading concept; the gates pass
   * through unconditionally there.
   */
  loadedSkills?: Set<string>;
  /**
   * Live UI-message stream writer for the current chat turn.
   *
   * The chat route wraps its `streamText` call in
   * `createUIMessageStream({ execute: ({ writer }) => ... })` and
   * passes that writer through here so subagents can stream their
   * prose directly into the parent response — interleaved with the
   * orchestrator's tool calls in real time — instead of returning
   * text via a tool-result the orchestrator would then have to relay.
   *
   * This is the "pure split" architecture: the smart orchestrator
   * emits only tool calls; the visible prose comes from fast-driven
   * subagents pushing UI chunks straight to the user.
   *
   * Structurally typed (no `ai` import) so @mythxengine/types stays
   * dependency-light. The chat route supplies the real
   * UIMessageStreamWriter; this interface declares only what tools
   * actually call on it.
   *
   * Optional because non-chat callers (MCP server, scripts, unit
   * tests) don't have a UI stream — subagents fall back to
   * returning text via tool-result in those contexts.
   */
  streamWriter?: ChatStreamWriter;
  /** Optional callback for image generation tracing (Langfuse, logging, etc.) */
  onImageGenerated?: (meta: {
    type: "portrait" | "scene" | "item";
    prompt: string;
    negativePrompt: string;
    entityId?: string;
    generationTimeMs?: number;
    seed?: number;
  }) => void;
}

/** Session media manager interface for runtime image storage */
export interface ISessionMediaManager {
  save(
    sessionId: string,
    entry: {
      id: string;
      filename: string;
      mimeType: string;
      entityType?: string;
      entityId?: string;
      role?: string;
      sizeBytes?: number;
      createdAt: string;
    },
    data: Buffer
  ): Promise<string>;
}

// ============================================================================
// Shared Tool Definition
// ============================================================================

/**
 * A transport-agnostic tool definition
 *
 * @template TInput - Zod schema type for input validation
 * @template TOutput - Output type returned by the handler
 */
/**
 * Result of a tool gate check. Modeled on cc-2.18's
 * `Tool.checkPermissions` (Tool.ts:500-503): allow proceeds to the
 * handler; deny short-circuits with a structured reason the LLM can
 * read and self-correct from.
 *
 * Gates exist to make game-mechanic invariants enforceable instead of
 * vibes — e.g. `attack` requires an active combat session, `tick_clock`
 * requires the clock to exist. Without gates the handler errors at
 * the bottom of the stack and the LLM has to interpret a thrown
 * exception; with gates the LLM gets a normal tool result with a
 * clear "you can't do this because X" message.
 */
export type GateResult = { allow: true } | { allow: false; reason: string };

/**
 * Pre-execution gate. Runs after schema validation but before the
 * handler. Mirror of cc-2.18 `wrappedCanUseTool` in QueryEngine.ts:244-271.
 */
export type ToolGate<TInput> = (
  input: TInput,
  ctx: ToolContext
) => Promise<GateResult> | GateResult;

/**
 * Pre-execution observation hook. Runs after the gate (if any) and
 * before the handler. Cannot reject — that's the gate's job. Mirror
 * of cc-2.18 PreToolUse hooks; use for logging, telemetry, or
 * cross-domain side effects (e.g. starting a span for the upcoming
 * call). Hook errors are swallowed so a buggy hook can never break
 * the tool.
 */
export type PreToolHook<TInput> = (input: TInput, ctx: ToolContext) => void | Promise<void>;

/**
 * Post-execution transform hook. Runs after the handler succeeds.
 * Receives the original input + the handler's result, can return a
 * modified result (or the same one), or perform side effects. Mirror
 * of cc-2.18 PostToolUse hooks; use for cross-domain reactions (e.g.
 * "after attack with partial outcome, auto-tick any active doom
 * clock") that don't belong in the handler itself.
 *
 * Hook errors are swallowed and the original handler result is
 * returned so a buggy hook can never break the tool.
 */
export type PostToolHook<TInput, TOutput> = (
  input: TInput,
  result: TOutput,
  ctx: ToolContext
) => TOutput | Promise<TOutput>;

export interface SharedToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown,
> {
  /** Tool name (e.g., 'roll_dice') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Zod schema for input validation (single source of truth) */
  inputSchema: TInput;
  /** Tool handler function */
  handler: (input: z.infer<TInput>, ctx: ToolContext) => Promise<TOutput>;
  /** Optional: event types this tool may emit (for documentation) */
  emits?: string[];
  /**
   * Optional pre-execution gate. When present, runs after schema
   * validation and before the handler. Returning `{allow: false, reason}`
   * short-circuits with a denied tool result the LLM reads as
   * `{ status: "denied", reason }`. Use to enforce game-mechanic
   * invariants (e.g. "attack requires combat to be active").
   */
  gate?: ToolGate<z.infer<TInput>>;
  /**
   * Optional pre-execution observation hook. Runs after the gate and
   * before the handler. Errors are swallowed (logged) so a buggy hook
   * can't break the tool.
   */
  preTool?: PreToolHook<z.infer<TInput>>;
  /**
   * Optional post-execution transform/side-effect hook. Receives the
   * handler result and can return a modified one. Errors are
   * swallowed; the original handler result is returned on hook
   * failure so a buggy hook can't break the tool.
   */
  postTool?: PostToolHook<z.infer<TInput>, TOutput>;
}

/**
 * Type helper for creating tool definitions with proper typing
 */
export function defineSharedTool<TInput extends z.ZodTypeAny, TOutput>(
  definition: SharedToolDefinition<TInput, TOutput>
): SharedToolDefinition<TInput, TOutput> {
  return definition;
}

// ============================================================================
// Tool Result Types
// ============================================================================

/**
 * Standard tool result with optional events
 */
export interface ToolResult<T = unknown> {
  /** The result data */
  data: T;
  /** Events emitted during execution */
  events?: GameEvent[];
}

/**
 * Wrap a result with events
 */
export function toolResult<T>(data: T, events?: GameEvent[]): ToolResult<T> {
  return { data, events };
}
