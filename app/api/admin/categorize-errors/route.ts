import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { ERROR_CATEGORIES } from "@/lib/ai/schemas";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

const CATEGORIZE_PROMPT = `You are a language error classifier.

Given a grammar error explanation (in Japanese) and the original/corrected pair, classify the error into exactly one of these categories:
Articles, Verb Conjugation, Word Order, Prepositions, Noun Gender, Tense, Conjunctions, Vocabulary, Spelling, Other

Respond with ONLY the category name, nothing else.

Categories:
- Articles: missing, wrong, or extra article (el/la/un/una/los/las)
- Verb Conjugation: wrong verb ending or conjugation form
- Word Order: incorrect order of words in the sentence
- Prepositions: wrong or missing preposition (a, en, de, con, por, para...)
- Noun Gender: wrong gender agreement for nouns/adjectives
- Tense: wrong tense used (present/past/future/subjunctive etc.)
- Conjunctions: wrong or missing conjunction (y, pero, porque, si...)
- Vocabulary: wrong word choice or incorrect lexical item
- Spelling: typo or misspelling
- Other: errors that don't fit the above categories`;

async function classifyWithAI(original: string, corrected: string, explanation: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const userMsg = `Original: "${original}"\nCorrected: "${corrected}"\nExplanation: "${explanation}"`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistralai/mistral-small-3.1-24b-instruct",
      messages: [
        { role: "system", content: CATEGORIZE_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0,
      max_tokens: 20,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const json = await res.json();
  const text: string = (json.choices?.[0]?.message?.content ?? "").trim();

  // Validate the response is a known category
  const matched = ERROR_CATEGORIES.find((c) => c.toLowerCase() === text.toLowerCase());
  return matched ?? "Other";
}

// POST /api/admin/categorize-errors
// Body: { secret?: string, limit?: number }
export async function POST(req: Request) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Fail closed: with ADMIN_SECRET unset, nobody can run this
  // (it fires one OpenRouter call per message).
  if (!ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (body.secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedLimit = typeof body.limit === "number" ? body.limit : 50;
  const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 200);

  const supabase = createServerClient();

  // Fetch own threads to scope messages
  const { data: myThreads } = await supabase
    .from("threads")
    .select("id")
    .eq("user_id", user.id);
  const myThreadIds = (myThreads ?? []).map((t: { id: string }) => t.id);

  // Fetch messages that have grammar errors but no error_category yet
  const { data, error } = await supabase
    .from("messages")
    .select("id, grammar_check")
    .in("thread_id", myThreadIds)
    .not("grammar_check", "is", null)
    .is("error_category", null)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    grammar_check: {
      has_error: boolean;
      original: string;
      corrected: string;
      explanation: string;
    } | null;
  }>;

  // Filter to only messages with actual errors
  const errorRows = rows.filter((r) => r.grammar_check?.has_error === true);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of errorRows) {
    const gc = row.grammar_check!;
    try {
      const category = await classifyWithAI(gc.original, gc.corrected, gc.explanation);
      const { error: updateError } = await supabase
        .from("messages")
        .update({ error_category: category })
        .eq("id", row.id);

      if (updateError) throw updateError;
      processed++;
    } catch (err) {
      failed++;
      errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    total: errorRows.length,
    processed,
    failed,
    errors: errors.slice(0, 10),
  });
}
