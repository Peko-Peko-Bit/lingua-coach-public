/**
 * lib/parser.ts
 *
 * @CRITICAL AIResponse JSON parser (4-step fallback)
 *
 * This module compensates for "incomplete JSON output" from lightweight models like Mistral.
 * Step 4 Auto-Wrap is a required safeguard that prevents double-calling the Secondary model
 * (= latency spike). Enforce the following rules in all future changes:
 *
 *  1. Do NOT replace parseAIResponse with a simple JSON.parse.
 *  2. Do NOT remove Step 4 Auto-Wrap.
 *  3. Do NOT delete or inline extractJsonCandidate / sanitize.
 *
 * Parse flow:
 *   Pre-process: strip code fences (```)
 *   Step 1: try JSON.parse(text) directly (fastest)
 *   Step 2: extract JSON block with /\{[\s\S]*\}/ and parse
 *   Step 3: sanitize control chars & invalid backslashes, then re-extract
 *   Step 4: Auto-Wrap — for pure natural language with no JSON,
 *           pipe text into response_text and return empty grammar_check
 */

import { AIResponseSchema, type AIResponse } from "./ai/schemas";

// ============================================================
// Helper functions
// ============================================================

/**
 * If the response_text of a parsed AIResponse is itself a JSON string,
 * re-parse it to extract the correct response_text.
 *
 * This happens when the AI over-interprets system prompt instructions in grammar_mode
 * and embeds an additional JSON string inside the response_text field.
 * On parse failure, returns the original result (fail-safe).
 */
function unwrapNestedJson(result: AIResponse): AIResponse {
  const text = result.response_text.trim();
  if (!text.startsWith("{")) return result;

  try {
    const inner = JSON.parse(text);
    const unwrapped = AIResponseSchema.safeParse(inner);
    if (unwrapped.success) {
      console.log("[JSON Rescue] Unwrapped nested JSON from response_text.");
      return unwrapped.data;
    }
  } catch { /* parse failed → return original result */ }

  return result;
}

/**
 * Extract the first `{` to the last `}` from text using a regex.
 * Returns null if no JSON block is found.
 */
export function extractJsonCandidate(text: string): string | null {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

/**
 * Remove characters that break JSON.parse.
 *   - control chars 0x00-0x1F (except \t \n \r)
 *   - invalid lone backslashes (all except \\, \", \n, \r, \t, \/, \uXXXX, \b, \f)
 */
export function sanitize(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/\\(?!["\\/bfnrtu])/g, "");
}

// ============================================================
// @CRITICAL Main parser
// ============================================================

/**
 * Convert raw AI model response to AIResponse type.
 *
 * @CRITICAL
 * Step 4 Auto-Wrap is required: prevents Secondary model fallback when a lightweight model
 * (e.g. Mistral) returns pure natural language.
 * Removing this step will re-introduce latency spikes.
 */
export function parseAIResponse(raw: string): AIResponse {
  // ── Pre-process: strip code fences ──────────────────────────────
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // ── Step 1: standard parse (fastest) ──────────────────────────────
  try {
    return unwrapNestedJson(AIResponseSchema.parse(JSON.parse(cleaned)));
  } catch { /* fall through */ }

  // ── Step 2: extract { ... } with regex ───────────────
  const candidate = extractJsonCandidate(cleaned);
  if (candidate) {
    try {
      const result = AIResponseSchema.parse(JSON.parse(candidate));
      console.log("[JSON Rescue] Successfully extracted JSON from conversational response.");
      return unwrapNestedJson(result);
    } catch { /* fall through */ }
  }

  // ── Step 3: sanitize then re-extract ────────────────────────────
  const candidate2 = extractJsonCandidate(sanitize(cleaned));
  if (candidate2) {
    try {
      const result = AIResponseSchema.parse(JSON.parse(candidate2));
      console.log("[JSON Rescue] Successfully extracted JSON from conversational response. (Step 3: sanitized)");
      return unwrapNestedJson(result);
    } catch { /* fall through */ }
  }

  // ── Step 4: Auto-Wrap (@CRITICAL — DO NOT REMOVE) ─────────────────
  //   Pure natural language response with no JSON at all.
  //   Pipe raw text into response_text; fill grammar_check with defaults.
  //   Return success (not throw) to block Secondary fallback
  //   and avoid the double-call latency spike.
  console.log("[JSON Rescue] Step 4 Auto-Wrap: wrapping plain-text response into AIResponse structure.");
  return {
    response_text: raw.trim(),
    grammar_check: {
      has_error:        false,
      original:         "",
      corrected:        "",
      explanation:      "",
      error_categories: [],
    },
  };
}
