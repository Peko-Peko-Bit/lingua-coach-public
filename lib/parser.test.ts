/**
 * lib/parser.test.ts
 *
 * Tests for the 4-step fallback logic in parseAIResponse.
 *
 * @CRITICAL Step 4 Auto-Wrap tests are mandatory.
 *   Raw text with no JSON must be wrapped in response_text,
 *   and grammar_check must be returned with default values.
 *   Do NOT remove or modify Step 4 while this test is failing.
 */

import { describe, it, expect } from "vitest";
import { parseAIResponse, extractJsonCandidate, sanitize } from "./parser";

// ============================================================
// Test data
// ============================================================

const VALID_AI_RESPONSE_JSON = JSON.stringify({
  response_text: "¡Hola! ¿Cómo estás?",
  grammar_check: {
    has_error:   false,
    original:    "hola",
    corrected:   "hola",
    explanation: "",
  },
});

const VALID_AI_RESPONSE_WITH_ERROR_JSON = JSON.stringify({
  response_text: "Debería decir 'Tengo hambre'.",
  grammar_check: {
    has_error:   true,
    original:    "Yo tengo hambre mucho",
    corrected:   "Tengo mucha hambre",
    explanation: "'Mucho' should come before the noun and agree in gender/number.",
  },
});

// ============================================================
// extractJsonCandidate
// ============================================================
describe("extractJsonCandidate", () => {
  it("extracts { ... } from a string containing a JSON block", () => {
    const text = 'Sure! Here is the result: {"foo": "bar"} Hope that helps.';
    expect(extractJsonCandidate(text)).toBe('{"foo": "bar"}');
  });

  it("returns null when no JSON is present", () => {
    expect(extractJsonCandidate("¡Hola! ¿Cómo estás?")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractJsonCandidate("")).toBeNull();
  });
});

// ============================================================
// sanitize
// ============================================================
describe("sanitize", () => {
  it("removes control characters (\\x00-\\x08)", () => {
    expect(sanitize("hello\x00world")).toBe("helloworld");
    expect(sanitize("foo\x07bar")).toBe("foobar");
  });

  it("preserves \\t \\n \\r", () => {
    const text = "line1\nline2\ttab\r";
    expect(sanitize(text)).toBe(text);
  });

  it("removes invalid lone backslashes", () => {
    // "foo\qbar": \q is an invalid JSON escape. Only \ is removed; q remains.
    // result: "fooqbar" (only the backslash is removed)
    expect(sanitize("foo\\qbar")).toBe("fooqbar");
  });

  it("preserves valid escape sequences", () => {
    const text = 'He said \\"hello\\" and left.';
    expect(sanitize(text)).toBe(text);
  });
});

// ============================================================
// parseAIResponse — Step 1: standard parse
// ============================================================
describe("parseAIResponse / Step 1: standard parse", () => {
  it("parses valid JSON and returns it as-is", () => {
    const result = parseAIResponse(VALID_AI_RESPONSE_JSON);
    expect(result.response_text).toBe("¡Hola! ¿Cómo estás?");
    expect(result.grammar_check!.has_error).toBe(false);
  });

  it("correctly parses JSON containing error info", () => {
    const result = parseAIResponse(VALID_AI_RESPONSE_WITH_ERROR_JSON);
    expect(result.grammar_check!.has_error).toBe(true);
    expect(result.grammar_check!.corrected).toBe("Tengo mucha hambre");
  });

  it("strips code fences (```json ... ```) in pre-processing and parses", () => {
    const fenced = "```json\n" + VALID_AI_RESPONSE_JSON + "\n```";
    const result = parseAIResponse(fenced);
    expect(result.response_text).toBe("¡Hola! ¿Cómo estás?");
  });

  it("strips code fences (``` ... ```) in pre-processing and parses", () => {
    const fenced = "```\n" + VALID_AI_RESPONSE_JSON + "\n```";
    const result = parseAIResponse(fenced);
    expect(result.response_text).toBe("¡Hola! ¿Cómo estás?");
  });
});

// ============================================================
// parseAIResponse — Step 2: regex rescue
// ============================================================
describe("parseAIResponse / Step 2: regex rescue", () => {
  it("rescues JSON prefixed by natural language", () => {
    const raw = "¡Me alegra que preguntes! " + VALID_AI_RESPONSE_JSON;
    const result = parseAIResponse(raw);
    expect(result.response_text).toBe("¡Hola! ¿Cómo estás?");
  });

  it("rescues JSON suffixed by natural language", () => {
    const raw = VALID_AI_RESPONSE_JSON + " ¡Espero que te ayude!";
    const result = parseAIResponse(raw);
    expect(result.response_text).toBe("¡Hola! ¿Cómo estás?");
  });

  it("rescues JSON embedded within natural language", () => {
    const raw = "Aquí está: " + VALID_AI_RESPONSE_JSON + " ¡Buena suerte!";
    const result = parseAIResponse(raw);
    expect(result.response_text).toBe("¡Hola! ¿Cómo estás?");
  });
});

// ============================================================
// parseAIResponse — Step 4: Auto-Wrap (@CRITICAL)
// ============================================================
describe("parseAIResponse / Step 4: Auto-Wrap (@CRITICAL)", () => {
  it("wraps pure natural language (no JSON) into response_text", () => {
    const plainText = "¡Hola! ¿Cómo estás? Me alegra que estés aprendiendo español.";
    const result = parseAIResponse(plainText);

    // @CRITICAL: ensure raw text is piped into response_text
    expect(result.response_text).toBe(plainText);
  });

  it("grammar_check after Auto-Wrap has no error and empty fields", () => {
    const plainText = "¡Muy bien! Sigue practicando.";
    const result = parseAIResponse(plainText);

    // @CRITICAL: ensure grammar_check is filled with default values
    expect(result.grammar_check!.has_error).toBe(false);
    expect(result.grammar_check!.original).toBe("");
    expect(result.grammar_check!.corrected).toBe("");
    expect(result.grammar_check!.explanation).toBe("");
  });

  it("trims surrounding whitespace before piping plain text into response_text", () => {
    const result = parseAIResponse("  ¡Hola!  ");
    expect(result.response_text).toBe("¡Hola!");
  });

  it("returns digit-only strings via Auto-Wrap (fails AIResponseSchema validation)", () => {
    // numeric literal "42" passes JSON.parse but fails AIResponseSchema validation
    const result = parseAIResponse("42");
    // Step 1 JSON.parse succeeds but Zod validation fails → falls through to Auto-Wrap
    expect(result.response_text).toBe("42");
    expect(result.grammar_check!.has_error).toBe(false);
  });

  it("returns an empty string as-is via Auto-Wrap", () => {
    const result = parseAIResponse("");
    expect(result.response_text).toBe("");
    expect(result.grammar_check!.has_error).toBe(false);
  });
});
