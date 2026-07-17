import { z } from "zod";

export const ERROR_CATEGORIES = [
  // article
  "Articles - Missing",
  "Articles - Incorrect",
  // verb
  "Verb Conjugation - Person/Number",
  "Verb Conjugation - Tense",
  "Verb Conjugation - Mood",
  // word order
  "Word Order",
  // preposition
  "Prepositions",
  // noun
  "Noun Gender",
  "Noun Number",
  // vocabulary
  "Vocabulary - Wrong Word",
  "Vocabulary - False Friend",
  // spelling
  "Spelling",
  // accent marks
  "Accent Marks",
  // other
  "Other",
] as const;

export type ErrorCategory = typeof ERROR_CATEGORIES[number];

export const GrammarCheckSchema = z.object({
  has_error: z.boolean().describe("Whether the input contains a grammar or spelling error"),
  // In grammar_mode the AI may omit "original"; optional + default absorbs that
  original: z.string().optional().default("").describe("The original user input, unchanged"),
  corrected: z.string().optional().default("").describe("The grammatically corrected version. Same as original if no error."),
  explanation: z.string().optional().default("").describe("Clear explanation of what was wrong and why. Empty string if no error."),
  error_category: z.string().nullable().optional().describe(
    "Backward compat: primary error category. Derived from error_categories[0] in new responses."
  ),
  error_categories: z.array(z.string()).optional().default([]).describe(
    "ALL detected error categories. Empty array when has_error=false. Values: Articles - Missing, Articles - Incorrect, Verb Conjugation - Person/Number, Verb Conjugation - Tense, Verb Conjugation - Mood, Word Order, Prepositions, Noun Gender, Noun Number, Vocabulary - Wrong Word, Vocabulary - False Friend, Spelling, Accent Marks, Other."
  ),
});

export const AIResponseSchema = z.object({
  response_text: z.string().describe("The AI tutor's conversational reply in Spanish"),
  grammar_check: GrammarCheckSchema.nullable().optional().default(null),
});

export type GrammarCheck = z.infer<typeof GrammarCheckSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;

// ============================================================
// Provider identifiers
// default    : used automatically on startup (no user action needed)
// manual_1~3 : manually selected via UI dropdown
// auto       : automatically selects model based on input complexity
// ============================================================
export type ProviderType = "default" | "manual_1" | "manual_2" | "manual_3" | "auto" | "auto_2" | "gemini-flash-lite";

export interface ProviderConfig {
  id: ProviderType;
  label: string;
  description: string;
  primaryModel: string;
  fallbackModel?: string;
  endpoint: "openrouter" | "gemini_api";
}

export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  // Default: OpenRouter Mistral → Llama fallback
  default: {
    id: "default",
    label: "OpenRouter (Mistral / Llama)",
    description: "Mistral Small 3.2 24B → Llama 3.3 70B fallback",
    primaryModel: "mistralai/mistral-small-3.2-24b-instruct",
    fallbackModel: "meta-llama/llama-3.3-70b-instruct",
    endpoint: "openrouter",
  },
  // Manual 1: Gemini 2.5 Flash Lite via OpenRouter (Reasoning capable)
  manual_1: {
    id: "manual_1",
    label: "Gemini 2.5 Flash Lite (OpenRouter)",
    description: "Gemini 2.5 Flash Lite — Reasoning capable, best cost-performance",
    primaryModel: "google/gemini-2.5-flash-lite",
    endpoint: "openrouter",
  },
  // Manual 2: OpenRouter Llama → Mistral fallback
  manual_2: {
    id: "manual_2",
    label: "OpenRouter (Llama / Mistral)",
    description: "Llama 3.3 70B → Mistral Small 3.2 fallback",
    primaryModel: "meta-llama/llama-3.3-70b-instruct",
    fallbackModel: "mistralai/mistral-small-3.2-24b-instruct",
    endpoint: "openrouter",
  },
  // Manual 3: Gemma 3 12B
  manual_3: {
    id: "manual_3",
    label: "Gemma 3 12B (OpenRouter)",
    description: "Google Gemma 3 12B — lightweight, fast",
    primaryModel: "google/gemma-3-12b-it",
    endpoint: "openrouter",
  },
  // Auto 1: Mistral → Llama → Gemini
  auto: {
    id: "auto",
    label: "Auto-A: Mistral→Llama→Gemini",
    description: "Simple: Mistral / Complex: Llama → Gemini fallback",
    primaryModel: "mistralai/mistral-small-3.2-24b-instruct", // overwritten after complexity check
    fallbackModel: "google/gemini-2.5-flash-lite",
    endpoint: "openrouter",
  },
  // Auto 2: Gemma → Mistral → Gemini
  auto_2: {
    id: "auto_2",
    label: "Auto-B: Gemma→Mistral→Gemini",
    description: "Simple: Gemma 3 12B / Complex: Mistral → Gemini fallback",
    primaryModel: "google/gemma-3-12b-it", // overwritten after complexity check
    fallbackModel: "google/gemini-2.5-flash-lite",
    endpoint: "openrouter",
  },
  // Default: Gemini 2.5 Flash Lite (fixed)
  "gemini-flash-lite": {
    id: "gemini-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    description: "Gemini 2.5 Flash Lite — default model",
    primaryModel: "google/gemini-2.5-flash-lite",
    endpoint: "openrouter",
  },
};

export const DEFAULT_PROVIDER: ProviderType = "gemini-flash-lite";