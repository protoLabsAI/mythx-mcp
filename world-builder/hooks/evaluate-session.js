#!/usr/bin/env node
/* global process */
/**
 * evaluate-session.js — SessionEnd hook for session transcript evaluation.
 *
 * Reads a SessionEnd JSON event from stdin. Scans the conversation transcript
 * for actionable patterns (bugs, improvement opportunities, gotchas) and
 * assigns a confidence score to each. Patterns with confidence >= 0.6 are
 * surfaced as hookSpecificOutput so they can be reviewed and optionally
 * promoted to board features.
 *
 * Uses the JSON stdin/stdout protocol (same as other hooks in this directory).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIDENCE_THRESHOLD = 0.6;

// ── Pattern detectors ────────────────────────────────────────────────────────

/**
 * Each detector receives the full transcript text and returns zero or more
 * pattern objects: { type, description, confidence, evidence }.
 */
const DETECTORS = [
  // Repeated tool retries — suggests a recurring bug or misunderstanding
  {
    name: "repeated_retries",
    run(transcript) {
      const toolCallCounts = {};
      const toolPattern = /"tool_name"\s*:\s*"([^"]+)"/g;
      let m;
      while ((m = toolPattern.exec(transcript)) !== null) {
        const tool = m[1];
        toolCallCounts[tool] = (toolCallCounts[tool] || 0) + 1;
      }

      const patterns = [];
      for (const [tool, count] of Object.entries(toolCallCounts)) {
        if (count >= 4) {
          const confidence = Math.min(0.5 + (count - 4) * 0.1, 0.95);
          patterns.push({
            type: "bug",
            description: `Tool '${tool}' was called ${count} times — possible retry loop or recurring failure`,
            confidence,
            evidence: `Tool call count: ${count}`,
          });
        }
      }
      return patterns;
    },
  },

  // Zod / schema validation errors — common source of bugs
  {
    name: "schema_errors",
    run(transcript) {
      const zodErrors = (
        transcript.match(/ZodError|z\.parse\s+failed|validation.*failed|invalid.*schema/gi) || []
      ).length;

      if (zodErrors >= 2) {
        return [
          {
            type: "bug",
            description: `${zodErrors} schema validation errors detected — LLM-generated content may not match expected structure`,
            confidence: Math.min(0.55 + zodErrors * 0.08, 0.9),
            evidence: `Zod/schema error occurrences: ${zodErrors}`,
          },
        ];
      }
      return [];
    },
  },

  // Missing required fields in responses
  {
    name: "missing_fields",
    run(transcript) {
      const missingCount = (
        transcript.match(/missing.*field|required.*field|field.*required|undefined.*property/gi) ||
        []
      ).length;

      if (missingCount >= 2) {
        return [
          {
            type: "gotcha",
            description: `${missingCount} missing-field errors detected — generation prompts may need stronger field requirements`,
            confidence: Math.min(0.5 + missingCount * 0.07, 0.88),
            evidence: `Missing-field error occurrences: ${missingCount}`,
          },
        ];
      }
      return [];
    },
  },

  // Step failures in world generation
  {
    name: "generation_step_failures",
    run(transcript) {
      const failCount = (transcript.match(/"status"\s*:\s*"failed"/g) || []).length;

      if (failCount >= 1) {
        return [
          {
            type: "bug",
            description: `${failCount} generation step(s) marked as failed — content may be incomplete or generation pipeline needs review`,
            confidence: Math.min(0.65 + failCount * 0.05, 0.92),
            evidence: `Failed step count: ${failCount}`,
          },
        ];
      }
      return [];
    },
  },

  // Repeated generation tool calls — improvement opportunity
  {
    name: "inefficient_generation",
    run(transcript) {
      const genCalls = (
        transcript.match(
          /generate_(?:world_seed|archetypes|monsters|items|encounters|locations|npcs|narrative|situations|arcs)/g
        ) || []
      ).length;

      if (genCalls >= 8) {
        return [
          {
            type: "improvement",
            description: `${genCalls} world generation tool calls in one session — consider batch generation or caching to reduce round-trips`,
            confidence: 0.62,
            evidence: `Generation tool call count: ${genCalls}`,
          },
        ];
      }
      return [];
    },
  },

  // Session state not found errors — common gotcha
  {
    name: "session_not_found",
    run(transcript) {
      const notFoundCount = (transcript.match(/session.*not.*found|no.*session.*found/gi) || [])
        .length;

      if (notFoundCount >= 1) {
        return [
          {
            type: "gotcha",
            description: `Session-not-found error(s) detected — ensure create_session is called before using session-dependent tools`,
            confidence: Math.min(0.7 + notFoundCount * 0.05, 0.9),
            evidence: `Occurrences: ${notFoundCount}`,
          },
        ];
      }
      return [];
    },
  },

  // Unresolved entity references / dangling IDs
  {
    name: "dangling_references",
    run(transcript) {
      const refErrors = (
        transcript.match(/reference.*not.*found|unknown.*id|invalid.*id|no.*entity.*with/gi) || []
      ).length;

      if (refErrors >= 2) {
        return [
          {
            type: "bug",
            description: `${refErrors} unresolved entity reference errors — IDs from generation output may not be persisted before assembly`,
            confidence: Math.min(0.6 + refErrors * 0.06, 0.88),
            evidence: `Reference error occurrences: ${refErrors}`,
          },
        ];
      }
      return [];
    },
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Only process SessionEnd events
  const eventName = event.hook_event_name || event.hookEventName || "";
  if (eventName !== "SessionEnd") {
    process.exit(0);
  }

  // Stringify the full event for pattern scanning
  const transcript = JSON.stringify(event);
  if (!transcript || transcript.length < 100) {
    process.exit(0);
  }

  // Run all detectors
  const allPatterns = [];
  for (const detector of DETECTORS) {
    try {
      const found = detector.run(transcript);
      allPatterns.push(...found);
    } catch {
      // Detector errors are non-fatal
    }
  }

  if (allPatterns.length === 0) {
    process.exit(0);
  }

  // Separate into high-confidence and low-confidence
  const highConfidence = allPatterns.filter((p) => p.confidence >= CONFIDENCE_THRESHOLD);
  const lowConfidence = allPatterns.filter((p) => p.confidence < CONFIDENCE_THRESHOLD);

  // Persist all patterns to .claude/data/session-patterns.jsonl for record keeping
  const claudeDir = path.resolve(__dirname, "..");
  const dataDir = path.join(claudeDir, "data");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const record = {
      timestamp: new Date().toISOString(),
      sessionId: event.session_id || event.sessionId || null,
      patterns: allPatterns,
    };
    fs.appendFileSync(
      path.join(dataDir, "session-patterns.jsonl"),
      JSON.stringify(record) + "\n",
      "utf8"
    );
  } catch {
    // Non-fatal — don't block session teardown
  }

  if (highConfidence.length === 0) {
    process.exit(0);
  }

  // Format high-confidence patterns for surfacing to Claude
  const lines = [
    `## Session Evaluation: ${highConfidence.length} actionable pattern(s) found (confidence >= ${CONFIDENCE_THRESHOLD})`,
    "",
  ];

  for (const p of highConfidence) {
    const icon =
      p.type === "bug" ? "[BUG]" : p.type === "improvement" ? "[IMPROVEMENT]" : "[GOTCHA]";
    lines.push(`${icon} ${p.description}`);
    lines.push(`   Confidence: ${(p.confidence * 100).toFixed(0)}% | Evidence: ${p.evidence}`);
    lines.push("");
  }

  if (lowConfidence.length > 0) {
    lines.push(
      `(${lowConfidence.length} lower-confidence pattern(s) logged to .claude/data/session-patterns.jsonl)`
    );
    lines.push("");
  }

  lines.push("Consider reviewing these patterns and creating board features for recurring issues.");

  const output = {
    hookSpecificOutput: {
      hookEventName: "SessionEnd",
      additionalContext: lines.join("\n"),
    },
  };

  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch(() => process.exit(0));
