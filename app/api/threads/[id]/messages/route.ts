import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

type Params = { params: Promise<{ id: string }> };

// GET /api/threads/[id]/messages — return messages for a thread
export async function GET(_req: NextRequest, { params }: Params) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServerClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[api/threads/[id]/messages GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// POST /api/threads/[id]/messages — upsert a message
export async function POST(req: NextRequest, { params }: Params) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: threadId } = await params;
  const supabase = createServerClient();

  const { data: thread } = await supabase
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .single();
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  // Whitelist columns — never spread the raw body into a service_role query
  const row = {
    id:               body.id,
    role:             body.role,
    content:          body.content,
    grammar_check:    body.grammar_check ?? null,
    error_category:   body.error_category ?? null,
    error_categories: body.error_categories ?? [],
    is_greeting:      body.is_greeting ?? false,
    used_model:       body.used_model ?? null,
    used_fallback:    body.used_fallback ?? null,
    stage:            body.stage ?? null,
    created_at:       body.created_at,
    thread_id:        threadId,
  };

  const { error } = await supabase.from("messages").insert(row);
  if (error) {
    // Duplicate id: allow update only if the existing row already belongs to
    // this (ownership-verified) thread — prevents overwriting other users' messages
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("messages")
        .select("thread_id")
        .eq("id", row.id)
        .single();
      if (!existing || existing.thread_id !== threadId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { error: updateError } = await supabase
        .from("messages")
        .update(row)
        .eq("id", row.id)
        .eq("thread_id", threadId);
      if (updateError) {
        console.error("[api/threads/[id]/messages POST]", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    console.error("[api/threads/[id]/messages POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
