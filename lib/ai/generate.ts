/**
 * lib/ai/generate.ts
 * Direct fetch approach. Supports both OpenRouter and Google AI Studio.
 */

import { PROVIDER_CONFIGS, GrammarCheckSchema, type AIResponse, type GrammarCheck, type ProviderType } from "./schemas";
import { parseAIResponse, extractJsonCandidate, sanitize } from "../parser";
import { LANGUAGES, DEFAULT_LANGUAGE, type LanguageCode, type LanguageMeta } from "../languages";

const DEFAULT_AI_NAME = "Roberta";

const DEFAULT_MAX_TOKENS = 1024;

// Plain-AI ("bare") mode: no persona, tutor framing, or JSON contract. A raw
// LLM with no system prompt is very verbose, so we send a single format-only
// line (conversational shape only — not a personality). It steers toward a
// natural one-paragraph reply and forbids markdown / long option lists, while
// leaving room for the model's own intelligence; "a few sentences" avoids the
// robotic terseness of a hard 1-3 sentence cap. response_format stays off; the
// prose reply is caught by parser Step 4. BARE_MODE_MAX_TOKENS is a safety
// ceiling — replies naturally land around ~80 tokens, well under it.
const BARE_MODE_SYSTEM = "Reply in a natural, conversational way: a few sentences, and ask a follow-up question when it fits. Keep it to one short paragraph. No markdown, bullet points, headings, or long lists of options.";
const BARE_MODE_MAX_TOKENS = 448;

function buildSystemPrompt(
  aiName: string,
  language: LanguageMeta,
  characterPrompt?: string
): string {
  const personalitySection = characterPrompt
    ? `\n== CHARACTER PERSONALITY ==\n${characterPrompt}\n`
    : "";

  return `You are ${aiName}, a ${language.nativeName} language tutor.
${personalitySection}
== INTERACTION RULES (apply always) ==
- Do NOT simply agree with or flatter everything the user says. If you see things differently, say so honestly.
- Ask probing, genuine follow-up questions to push the conversation deeper — go beyond surface-level exchanges.
- Challenge the user's ideas or assumptions when appropriate to foster critical thinking.
- Avoid hollow affirmations like "Great!" or "Perfect!" on every response. Praise only when truly warranted.
- If the user repeats the same point without adding new substance, redirect with a deeper question or a counterpoint.

== OUTPUT FORMAT ==
You MUST respond with ONLY a JSON object. No markdown, no code fences, no explanation outside the JSON.

{
  "response_text": "<your reply in ${language.nativeName}>"
}

- Do NOT wrap the response in markdown code blocks.`;
}

// ============================================================
// OpenRouter call
// ============================================================

// OpenRouter server-side fallback chain (models array): tried in order
// when the preceding model errors, is rate-limited, or gets retired.
const OPENROUTER_FALLBACK_MODELS = [
  "google/gemini-3.1-flash-lite",
  "~anthropic/claude-haiku-latest",
];

async function callOpenRouter(
  modelId: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
  aiName = DEFAULT_AI_NAME,
  language: LanguageMeta = LANGUAGES[DEFAULT_LANGUAGE],
  characterPrompt?: string,
  systemPromptOverride?: string,
  fallbackModels?: string[],
  bareMode = false
): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  // bareMode: no persona / tutor framing / JSON contract — just a minimal
  // format-only line (BARE_MODE_SYSTEM) to keep the raw LLM's replies short.
  const systemContent = bareMode
    ? BARE_MODE_SYSTEM
    : (systemPromptOverride ?? buildSystemPrompt(aiName, language, characterPrompt));

  // The models array shares one request body, so response_format must suit
  // every model in the chain — drop it if any of them is Gemini.
  const modelChain = [modelId, ...(fallbackModels ?? [])];

  const body = {
    model: modelId,
    ...(modelChain.length > 1 && { models: modelChain }),
    messages: [
      { role: "system", content: systemContent },
      ...history,
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: bareMode ? BARE_MODE_MAX_TOKENS : DEFAULT_MAX_TOKENS,
    // json_object mode requires the word "json" somewhere in the messages
    // (OpenAI-compatible constraint). Bare mode's minimal prompt doesn't mention
    // json, so drop response_format and let the model return prose — parser
    // Step 4 Auto-Wrap handles it. Also excluded for Gemini via OpenRouter,
    // which doesn't support json_object mode.
    ...(!bareMode && !modelChain.some((m) => m.includes("gemini")) && { response_format: { type: "json_object" } }),
  };

  console.log(
    `[AI] OpenRouter request: model=${modelId} systemPrompt=${bareMode ? "minimal (bare mode)" : "full"} max_tokens=${body.max_tokens}`
  );

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Language Coach",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty response from OpenRouter: ${JSON.stringify(json)}`);

  return parseAIResponse(text);
}

// ============================================================
// Google AI Studio call
// ============================================================
async function callGemini(
  modelId: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
  aiName = DEFAULT_AI_NAME,
  language: LanguageMeta = LANGUAGES[DEFAULT_LANGUAGE],
  characterPrompt?: string,
  systemPromptOverride?: string,
  bareMode = false
): Promise<AIResponse> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");

  // bareMode: minimal format-only system prompt (no persona / tutor framing /
  // JSON contract) plus a lower token cap to keep replies short.
  const systemContent = bareMode
    ? BARE_MODE_SYSTEM
    : (systemPromptOverride ?? buildSystemPrompt(aiName, language, characterPrompt));

  const geminiHistory = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemContent }] },
    contents: [
      ...geminiHistory,
      { role: "user", parts: [{ text: userMessage }] },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: bareMode ? BARE_MODE_MAX_TOKENS : DEFAULT_MAX_TOKENS },
  };

  console.log(
    `[AI] Gemini request: model=${modelId} systemInstruction=${bareMode ? "minimal (bare mode)" : "full"} maxOutputTokens=${body.generationConfig.maxOutputTokens}`
  );

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Empty response from Gemini: ${JSON.stringify(json)}`);

  return parseAIResponse(text);
}

// ============================================================
// Grammar check dedicated request
// ============================================================
const GRAMMAR_CHECK_MODEL = "google/gemini-2.5-flash-lite";

const EXPLANATION_LANG_NAMES: Record<string, string> = {
  ja: "Japanese",
  en: "English",
};

const TARGET_LANG_NAMES: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  en: "English",
};

function buildGrammarCheckSystemPrompt(contextText: string | null, explanationLang = "ja", targetLang = "es"): string {
  const langName = EXPLANATION_LANG_NAMES[explanationLang] ?? "Japanese";
  const targetLangName = TARGET_LANG_NAMES[targetLang] ?? "Spanish";
  const contextSection = contextText
    ? `Reference context (for comprehension only — do NOT evaluate or include in corrected output):\n"""\n${contextText}\n"""\n\n`
    : "";
  return `${contextSection}You are a ${targetLangName} grammar checker. Analyze the user's input and return ONLY a JSON object with no markdown.

{
  "has_error": <true | false>,
  "corrected": "<fully corrected version addressing ALL errors, or same as original if no error>",
  "explanation": "<explanation of errors in ${langName}. Empty string if no error.>",
  "error_categories": ["<category1>", "<category2>", ...]
}

Allowed values for error_categories (use the most specific subcategory that applies):
- "Articles - Missing" (missing article)
- "Articles - Incorrect" (wrong article used)
- "Verb Conjugation - Person/Number" (wrong person or number agreement)
- "Verb Conjugation - Tense" (wrong tense)
- "Verb Conjugation - Mood" (wrong mood, e.g. indicative vs subjunctive)
- "Word Order"
- "Prepositions"
- "Noun Gender"
- "Noun Number"
- "Vocabulary - Wrong Word" (incorrect word choice)
- "Vocabulary - False Friend" (false cognate misuse)
- "Spelling"
- "Accent Marks" (missing or incorrect accent marks, e.g. "esta" instead of "está")
- "Other"

Rules:
- explanation MUST be written in ${langName}. If has_error is true: format as a numbered list with one item per error, matching the order of error_categories (e.g. "1. <explanation for first error> 2. <explanation for second error>"). Keep each item to 1 short sentence. If has_error is false with a tip: write 1 plain sentence (no numbering).
- error_categories MUST list up to 3 of the most significant error types. Empty array [] if no error.
- If has_error is false: corrected = same as original, error_categories = []. explanation MUST be empty string UNLESS the phrasing is technically correct but noticeably unnatural or overly literal — in that case provide a brief tip in ${langName}. Keep the bar high: most correct messages should have explanation = "".
- If has_error is true: every entry in error_categories MUST be exactly one of the allowed values above.
- Prefer the subcategory (e.g. "Verb Conjugation - Tense") over a generic one when applicable.`;
}

export async function checkGrammar(
  userMessage: string,
  context: Array<{ role: "user" | "assistant"; content: string }> = [],
  explanationLang = "ja",
  targetLang = "es"
): Promise<GrammarCheck | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Language Coach",
      },
      body: JSON.stringify({
        model: GRAMMAR_CHECK_MODEL,
        models: [GRAMMAR_CHECK_MODEL, ...OPENROUTER_FALLBACK_MODELS],
        messages: [
          { role: "system", content: buildGrammarCheckSystemPrompt(context[0]?.content ?? null, explanationLang, targetLang) },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        // Gemini via OpenRouter does not support json_object response_format
        ...(![GRAMMAR_CHECK_MODEL, ...OPENROUTER_FALLBACK_MODELS].some((m) => m.includes("gemini")) && { response_format: { type: "json_object" } }),
      }),
    });

    if (!res.ok) {
      console.warn(`[Grammar Check] OpenRouter ${res.status}`);
      return null;
    }

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content;
    if (!text) return null;

    const cleaned = text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();
    const candidate = extractJsonCandidate(sanitize(cleaned)) ?? cleaned;
    const parsed = GrammarCheckSchema.safeParse(JSON.parse(candidate));

    if (parsed.success) {
      // Derive error_category from error_categories for backward compat
      if (parsed.data.error_categories?.length) {
        parsed.data.error_category = parsed.data.error_categories[0];
      }
      console.log(`[Grammar Check] ✓ has_error=${parsed.data.has_error} categories=${JSON.stringify(parsed.data.error_categories)}`);
      return parsed.data;
    }
    console.warn("[Grammar Check] Schema parse failed:", parsed.error.issues);
    return null;
  } catch (err) {
    console.warn("[Grammar Check] Failed:", err instanceof Error ? err.message.slice(0, 120) : err);
    return null;
  }
}

// ============================================================
// Complexity detection (for Auto mode)
// ============================================================
const IT_KEYWORDS = [
  "docker", "kubernetes", "microservices", "asynchronous", "async", "multithreading",
  "encryption", "database indexing", "recursion", "algorithm", "api", "rest", "graphql",
  "websocket", "oauth", "jwt", "ssl", "tls", "cdn", "cache", "redis", "sql", "nosql",
  "mongodb", "postgresql", "webpack", "cicd", "devops", "regex", "tcp", "http", "dns",
  "load balancer", "containerization", "virtualization", "cloud", "aws", "azure", "gcp",
  "machine learning", "neural network", "llm", "embedding", "vector database",
  "big o", "complexity", "binary tree", "linked list", "hash map", "concurrency",
  "deadlock", "race condition", "mutex", "semaphore", "socket", "firewall", "proxy",
];

const COMPLEXITY_CHAR_THRESHOLD = 600;

interface ComplexityResult {
  isComplex: boolean;
  reason: string;
}

/** Evaluated independently per request. Never reads external state. */
function detectComplexity(text: string, language: LanguageMeta): ComplexityResult {
  console.log(`[Auto Mode] detectComplexity input: "${text.slice(0, 80)}" (${text.length} chars)`);

  // 1. Character count check
  if (text.length > COMPLEXITY_CHAR_THRESHOLD) {
    return { isComplex: true, reason: `Length (${text.length} chars > ${COMPLEXITY_CHAR_THRESHOLD})` };
  }

  // 2. IT keyword check
  const lower = text.toLowerCase();
  const matchedKeyword = IT_KEYWORDS.find((kw) => lower.includes(kw));
  if (matchedKeyword) {
    return { isComplex: true, reason: `Keyword: "${matchedKeyword}"` };
  }

  // 3. Language-specific detail-request patterns
  const matchedPattern = language.complexPatterns.find((p) => p.test(text));
  if (matchedPattern) {
    return { isComplex: true, reason: `${language.nativeName} pattern: ${matchedPattern}` };
  }

  return { isComplex: false, reason: "Default (simple)" };
}

/** Kept for backward compatibility */
export function isComplexQuery(text: string): boolean {
  return detectComplexity(text, LANGUAGES[DEFAULT_LANGUAGE]).isComplex;
}

// ============================================================
// Auto mode: 3-stage model chain
// ============================================================
export type Stage = "primary" | "secondary" | "tertiary";

export const STAGE_MODELS: Record<Stage, string> = {
  primary:   "mistralai/mistral-small-3.2-24b-instruct",
  secondary: "meta-llama/llama-3.3-70b-instruct",
  tertiary:  "google/gemini-2.5-flash-lite",
};

// Auto-B: Gemma → Mistral → Gemini
const STAGE_MODELS_B: Record<Stage, string> = {
  primary:   "google/gemma-3-12b-it",
  secondary: "mistralai/mistral-small-3.2-24b-instruct",
  tertiary:  "google/gemini-2.5-flash-lite",
};

export const STAGE_LABELS: Record<Stage, string> = {
  primary:   "Primary",
  secondary: "Secondary",
  tertiary:  "Tertiary",
};

// ============================================================
// Main public function (with fallback)
// ============================================================
export interface GenerateResult {
  data: AIResponse;
  usedModel: string;
  usedFallback: boolean;
  provider: ProviderType;
  isComplex?: boolean;
  stage?: Stage;        // Auto mode only
}

export interface GenerateOptions {
  provider: ProviderType;
  userMessage: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  aiName?: string;
  language?: LanguageCode;
  characterPrompt?: string;
  systemPromptOverride?: string;   // pass buildGrammarSystemPrompt() output directly in grammar_mode
  grammarMode?: boolean;           // when true, fixes model to Gemma 4 26B A4B
  bareMode?: boolean;              // when true, send NO system prompt at all (raw LLM, persona-less)
}

// Dedicated model for grammar_mode (via OpenRouter)
const GRAMMAR_MODEL = "google/gemma-4-26b-a4b-it";

export async function generateAIResponse(options: GenerateOptions): Promise<GenerateResult> {
  const {
    provider,
    userMessage,
    conversationHistory = [],
    aiName = DEFAULT_AI_NAME,
    language: languageCode = DEFAULT_LANGUAGE,
    characterPrompt,
    systemPromptOverride,
    grammarMode,
    bareMode = false,
  } = options;
  const language = LANGUAGES[languageCode] ?? LANGUAGES[DEFAULT_LANGUAGE];

  // ---- grammar_mode: primary Gemma with OpenRouter server-side fallback chain ----
  if (grammarMode) {
    console.log(`[Grammar Mode] Using primary model: ${GRAMMAR_MODEL}`);
    const data = await callOpenRouter(
      GRAMMAR_MODEL,
      conversationHistory,
      userMessage,
      aiName,
      language,
      characterPrompt,
      systemPromptOverride,
      OPENROUTER_FALLBACK_MODELS
    );
    return { data, usedModel: GRAMMAR_MODEL, usedFallback: false, provider };
  }

  // ---- Auto mode routing (3-stage fallback) ----
  if (provider === "auto" || provider === "auto_2") {
    const stageModels = provider === "auto_2" ? STAGE_MODELS_B : STAGE_MODELS;
    // ★ Evaluated as a local variable each request; no state carries over from prior requests.
    const { isComplex, reason } = detectComplexity(userMessage, language);

    // Simple  → primary→secondary→tertiary
    // Complex → secondary→tertiary  (skip primary)
    const chain: Stage[] = isComplex
      ? ["secondary", "tertiary"]
      : ["primary", "secondary", "tertiary"];

    console.log(`[Auto Mode] isComplex: ${isComplex} | Reason: ${reason} | Chain: ${chain.join(" → ")}`);

    for (const stage of chain) {
      const modelId = stageModels[stage];
      const label   = STAGE_LABELS[stage];
      const isFirstStage = stage === chain[0];

      console.log(`[Auto Mode] Trying ${label} (${modelId.split("/").pop()})`);
      try {
        // Context diet: only Primary truncates history to 150 chars
        // Secondary / Tertiary receive the full history (do not change this)
        const effectiveHistory = stage === "primary"
          ? conversationHistory.map((m) => ({
              ...m,
              content: m.content.length > 150
                ? m.content.slice(0, 150) + "... [content truncated for primary model speed]"
                : m.content,
            }))
          : conversationHistory;

        if (stage === "primary") {
          const truncated = effectiveHistory.filter((m) => m.content.includes("[content truncated")).length;
          if (truncated > 0) {
            console.log(`[Auto Mode] Context Diet applied: ${truncated}/${effectiveHistory.length} messages truncated to 150 chars.`);
          }
        }

        const data = await callOpenRouter(modelId, effectiveHistory, userMessage, aiName, language, characterPrompt, systemPromptOverride, undefined, bareMode);
        console.log(`[Auto Mode] ✓ Resolved by ${label}: ${modelId.split("/").pop()}`);
        return {
          data,
          usedModel: modelId,
          usedFallback: !isFirstStage,
          provider,
          isComplex,
          stage,
        };
      } catch (err) {
        console.warn(
          `[Auto Mode] ✗ ${label} failed (${modelId.split("/").pop()}):`,
          err instanceof Error ? err.message.slice(0, 120) : err
        );
      }
    }

    throw new AIGenerationError(
      `Auto mode: all models in chain failed. [${chain.join(" → ")}]`,
      null, stageModels.primary, stageModels.tertiary
    );
  }

  // ---- Standard provider ----
  const config = PROVIDER_CONFIGS[provider];

  const callModel = (modelId: string) =>
    config.endpoint === "gemini_api"
      ? callGemini(modelId, conversationHistory, userMessage, aiName, language, characterPrompt, systemPromptOverride, bareMode)
      : callOpenRouter(modelId, conversationHistory, userMessage, aiName, language, characterPrompt, systemPromptOverride, OPENROUTER_FALLBACK_MODELS, bareMode);

  // Primary attempt
  try {
    const data = await callModel(config.primaryModel);
    return { data, usedModel: config.primaryModel, usedFallback: false, provider };
  } catch (primaryErr) {
    console.warn(`[AI] Primary model failed (${config.primaryModel}):`,
      primaryErr instanceof Error ? primaryErr.message : primaryErr);

    if (!config.fallbackModel) {
      throw new AIGenerationError(
        `Primary model (${config.primaryModel}) failed and no fallback is configured.`,
        primaryErr, config.primaryModel, null
      );
    }
  }

  // Fallback attempt
  try {
    console.info(`[AI] Trying fallback model: ${config.fallbackModel}`);
    const data = await callModel(config.fallbackModel!);
    return { data, usedModel: config.fallbackModel!, usedFallback: true, provider };
  } catch (fallbackErr) {
    throw new AIGenerationError(
      `Both primary (${config.primaryModel}) and fallback (${config.fallbackModel}) models failed.`,
      fallbackErr, config.primaryModel, config.fallbackModel!
    );
  }
}

export class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly primaryModel: string,
    public readonly fallbackModel: string | null
  ) {
    super(message);
    this.name = "AIGenerationError";
  }
}