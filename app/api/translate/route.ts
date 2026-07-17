import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

interface TranslateRequestBody {
  text: string;
  target?: string; // default: "ja"
}

export async function POST(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(user.id, "translate");
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter);

  try {
    const body: TranslateRequestBody = await req.json();
    const { text, target = "ja" } = body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Text too long (max 5000 chars)." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error: Translate API key is missing." },
        { status: 500 }
      );
    }

    const userIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("x-real-ip")
      ?? "anonymous";
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}&quotaUser=${encodeURIComponent(userIp)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target, format: "text" }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Google Translate API error:", err);
      return NextResponse.json(
        { error: `Translation failed: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const translated = data?.data?.translations?.[0]?.translatedText ?? "";

    return NextResponse.json({ translated });
  } catch (err: unknown) {
    console.error("=== /api/translate error ===");
    console.error(err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: `Translation error: ${message}` },
      { status: 500 }
    );
  }
}
