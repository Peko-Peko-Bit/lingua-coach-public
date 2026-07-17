import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const language    = searchParams.get("language")      ?? "es";
  const sort        = searchParams.get("sort")          ?? "recent";
  const limit       = parseInt(searchParams.get("limit") ?? "50");
  const type        = searchParams.get("type");         // "word" | "phrase" | null
  const partOfSpeech = searchParams.get("part_of_speech"); // noun/verb/... | null
  const search      = searchParams.get("search")?.trim() ?? "";

  const supabase = createServerClient();

  let query = supabase
    .from("vocabulary")
    .select("id, term, translation, part_of_speech, session_title, source_app, last_reviewed_at, created_at")
    .eq("source_lang", language)
    .eq("user_id", user.id)
    .limit(limit);

  if (type) query = query.eq("type", type);
  if (partOfSpeech) query = query.eq("part_of_speech", partOfSpeech);
  if (search) {
    query = query.or(`term.ilike.%${search}%,translation.ilike.%${search}%`);
  }

  if (sort === "review") {
    query = query.order("last_reviewed_at", { ascending: true, nullsFirst: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("[dashboard/vocabulary GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
