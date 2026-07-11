import { z } from "zod";

/**
 * Chat message schema for JSONL storage
 * Each line in chat.jsonl is one ChatMessage
 */
export const ChatMessageSchema = z.object({
  /** Unique message ID */
  id: z.string(),

  /** Message role */
  role: z.enum(["user", "assistant", "system"]),

  /** Message content */
  content: z.string(),

  /** ISO timestamp */
  timestamp: z.string(),

  /** Optional metadata */
  metadata: z
    .object({
      /** Tool calls or display actions */
      toolCalls: z.array(z.unknown()).optional(),
      /** Model used for generation */
      model: z.string().optional(),
      /** Token usage */
      tokens: z
        .object({
          input: z.number().optional(),
          output: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
