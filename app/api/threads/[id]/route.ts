import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/threads/[id] — update title / touch / mark complete
export async function PATCH(req: NextRequest, { params }: Params) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = createServerClient();

  const update: Record<string, unknown> = { last_updated_at: Date.now() };
  if (body.title     !== undefined) update.title     = body.title;
  if (body.completed !== undefined) update.completed = body.completed;
  if (body.score     !== undefined) update.score     = body.score;

  const { error } = await supabase.from("threads").update(update).eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("[api/threads/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/threads/[id] — delete thread (messages auto-deleted via CASCADE)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServerClient();
  const { error } = await supabase.from("threads").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("[api/threads/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
