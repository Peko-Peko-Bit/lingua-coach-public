/**
 * app/api/chat/route.ts
 *
 * Chat API endpoint.
 * POST /api/chat
 *
 * Request body:
 * {
 *   provider: "default" | "openrouter",
 *   message: string,
 *   history: Array<{ role: "user" | "assistant", content: string }>
 * }
 *
 * Response:
 * {
 *   data: AIResponse,
 *   usedModel: string,
 *   usedFallback: boolean,
 *   provider: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { generateAIResponse, checkGrammar, AIGenerationError } from "@/lib/ai";
import type { ProviderType } from "@/lib/ai";
import type { LanguageCode } from "@/lib/languages";
import { CHARACTERS } from "@/lib/characters";
import { buildGrammarSystemPrompt } from "@/lib/ai/grammar-prompt";

// Request body validation schema
const RequestSchema = z.object({
  provider: z.enum(["default", "manual_1", "manual_2", "manual_3", "auto", "auto_2", "gemini-flash-lite"]),
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(50) // max 50 to keep context window manageable
    .default([]),
  aiName: z.string().max(50).optional(),
  language: z.string().optional().default("es"),
  characterId: z.string().max(50).optional(),
  // Phase 2: grammar learning mode fields (connected to buildGrammarSystemPrompt() in Phase 3)
  grammar_mode: z.boolean().optional().default(false),
  grammar_topic: z.object({
    lang:             z.string(),
    topic_id:         z.string(),
    topic_name:       z.string().nullable().default(null),
    level:            z.string(),
    content:          z.string(),
    examples:         z.array(z.string()),
    explanation_lang: z.enum(["ja", "es"]).default("ja"),
  }).optional(),
  topic_focus: z.string().max(100).optional(),
  explanation_lang: z.enum(["ja", "en", "es"]).optional().default("ja"),
  practice_examples: z.array(z.object({
    id:          z.string(),
    original:    z.string(),
    corrected:   z.string(),
    explanation: z.string(),
    created_at:  z.number(),
  })).optional(),
});

export async function POST(req: NextRequest) {
  // --- Auth (do not rely on middleware alone for cost-bearing endpoints) ---
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(user.id, "chat");
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  // --- Parse request ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  // --- Validation ---
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { provider, message, history, aiName, language, characterId, grammar_mode, grammar_topic, topic_focus, practice_examples, explanation_lang } = parsed.data;

  // In grammar_mode, override the system prompt with buildGrammarSystemPrompt()
  const systemPromptOverride = grammar_mode && grammar_topic
    ? buildGrammarSystemPrompt(grammar_topic)
    : undefined;

  const character = characterId ? CHARACTERS.find((c) => c.id === characterId) : undefined;
  // Bare mode: a character with no `prompt` field runs the raw LLM with no
  // system prompt at all. grammar_mode is left untouched — it always wins.
  const bareMode = !grammar_mode && !!character && character.prompt === undefined;
  const basePrompt = character?.prompt ?? "";
  const topicSuffix = topic_focus
    ? `\n\n== PRACTICE FOCUS ==\nThe user came here specifically to practice: "${topic_focus}". On your FIRST reply, greet them briefly and immediately invite them to practice this grammar point — for example, ask them to form a sentence using "${topic_focus}" or offer a simple exercise. Keep the entire conversation focused on improving "${topic_focus}" until the user changes the subject.`
    : "";
  const examplesSuffix = practice_examples && practice_examples.length > 0
    ? `\n\n== PRACTICE EXAMPLES ==\nThe user has made the following errors in the past. Use these as the basis for practice:\n\n${
        practice_examples.map((ex, i) =>
          `${i + 1}. ✗ "${ex.original}"\n   ✓ "${ex.corrected}"\n   → ${ex.explanation}`
        ).join("\n\n")
      }\n\nFocus your practice session specifically on the pattern shown above.\nOn your FIRST reply, briefly reference one of these errors and invite the user to practice.`
    : "";
  const characterPrompt = (basePrompt + topicSuffix + examplesSuffix) || undefined;

  // ── Trace log (visible in Next.js terminal) ──
  console.log(
    `[API] Received: provider="${provider}" message="${message.slice(0, 80)}" historyLen=${history.length}`
  );

  // --- AI generation (with fallback) ---
  try {
    const chatOptions = {
      provider: provider as ProviderType,
      userMessage: message,
      conversationHistory: history,
      aiName,
      language: language as LanguageCode,
      characterPrompt,
      systemPromptOverride,
      grammarMode: grammar_mode,
      bareMode,
    };

    // grammar_mode: Gemini returns grammar_check too, so single request
    // Normal mode: run response generation and grammar check in parallel
    const lastAssistant = history.findLast((m) => m.role === "assistant");
    const grammarContext = lastAssistant ? [lastAssistant] : [];

    const [result, grammarResult] = grammar_mode
      ? [await generateAIResponse(chatOptions), null]
      : await Promise.all([
          generateAIResponse(chatOptions),
          checkGrammar(message, grammarContext, explanation_lang, language),
        ]);

    const merged = {
      ...result,
      data: {
        ...result.data,
        grammar_check: grammarResult ?? result.data.grammar_check,
      },
    };

    return NextResponse.json(merged, { status: 200 });
  } catch (err) {
    if (err instanceof AIGenerationError) {
      console.error("[API] AIGenerationError:", err.message);
      return NextResponse.json(
        {
          error: "AI generation failed",
          message: err.message,
          primaryModel: err.primaryModel,
          fallbackModel: err.fallbackModel,
        },
        { status: 503 }
      );
    }

    console.error("[API] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
