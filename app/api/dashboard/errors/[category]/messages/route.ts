import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language") ?? "es";
  const limit    = parseInt(searchParams.get("limit") ?? "5");
  const category = decodeURIComponent((await params).category);

  const supabase = createServerClient();

  const { data: threadRows, error: threadErr } = await supabase
    .from("threads")
    .select("id")
    .eq("language", language)
    .eq("user_id", user.id);

  if (threadErr) {
    console.error("[dashboard/errors/messages] threads:", threadErr.message);
    return NextResponse.json({ error: threadErr.message }, { status: 500 });
  }

  const threadIds = (threadRows ?? []).map((r: { id: string }) => r.id);
  if (threadIds.length === 0) return NextResponse.json({ examples: [] });

  const { data: msgRows, error: msgErr } = await supabase
    .from("messages")
    .select("id, grammar_check, created_at")
    .in("thread_id", threadIds)
    .or(`error_categories.cs.{"${category}"},error_category.eq.${category}`)
    .eq("role", "assistant")
    .not("grammar_check", "is", null)
    .or("is_greeting.is.null,is_greeting.eq.false")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (msgErr) {
    console.error("[dashboard/errors/messages] messages:", msgErr.message);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  type MsgRow = {
    id: string;
    grammar_check: Record<string, string> | null;
    created_at: number;
  };

  const examples = (msgRows ?? []).map((row) => {
    const r = row as MsgRow;
    return {
      id:          r.id,
      original:    r.grammar_check?.original    ?? "",
      corrected:   r.grammar_check?.corrected   ?? "",
      explanation: r.grammar_check?.explanation ?? "",
      created_at:  r.created_at,
    };
  });

  return NextResponse.json({ examples });
}
