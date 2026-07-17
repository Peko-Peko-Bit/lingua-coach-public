import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

// GET /api/threads — return list of chat threads
export async function GET() {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("type", "chat")
    .eq("user_id", user.id)
    .order("last_updated_at", { ascending: false });
  if (error) {
    console.error("[api/threads GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// POST /api/threads — insert a thread (supports both chat and grammar modes)
export async function POST(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const supabase = createServerClient();
  // Whitelist columns — never spread the raw body into a service_role query
  const row = {
    id:                body.id,
    title:             body.title,
    last_updated_at:   body.last_updated_at,
    created_at:        body.created_at,
    type:              body.type ?? "chat",
    grammar_topic_id:  body.grammar_topic_id ?? null,
    grammar_level:     body.grammar_level ?? null,
    grammar_unit_name: body.grammar_unit_name ?? null,
    completed:         body.completed ?? false,
    score:             body.score ?? null,
    language:          body.language ?? "es",
    user_id:           user.id,
  };
  const { error } = await supabase.from("threads").insert(row);
  if (error) {
    console.error("[api/threads POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
