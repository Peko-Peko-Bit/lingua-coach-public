import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(user.id, "word-translate");
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  const { term, sourceLang, targetLang } = await req.json();
  if (!term || typeof term !== "string" || term.length > 200) {
    return NextResponse.json({ error: "term required (max 200 chars)" }, { status: 400 });
  }
  if (typeof sourceLang !== "string" || sourceLang.length > 10 ||
      typeof targetLang !== "string" || targetLang.length > 10) {
    return NextResponse.json({ error: "invalid sourceLang/targetLang" }, { status: 400 });
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY)
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Translate the given ${sourceLang} word to ${targetLang}. Return ONLY a JSON object with key "translation" (string). Keep it concise — dictionary-style, not a sentence.`,
          },
          { role: "user", content: term },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({ translation: parsed.translation ?? "" });
  } catch (err) {
    console.error("[word-translate]", err);
    return NextResponse.json({ translation: "" });
  }
}
