import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language") ?? "es";
  const limit    = parseInt(searchParams.get("limit") ?? "10");

  const supabase = createServerClient();

  // Get thread IDs for the language
  const { data: threadRows, error: threadErr } = await supabase
    .from("threads")
    .select("id")
    .eq("language", language)
    .eq("user_id", user.id);

  if (threadErr) {
    console.error("[dashboard/errors] threads:", threadErr.message);
    return NextResponse.json({ error: threadErr.message }, { status: 500 });
  }

  const threadIds = (threadRows ?? []).map((r: { id: string }) => r.id);
  if (threadIds.length === 0) return NextResponse.json([]);

  // Fetch messages with grammar errors (error_categories array or legacy error_category)
  const { data: msgRows, error: msgErr } = await supabase
    .from("messages")
    .select("error_category, error_categories")
    .in("thread_id", threadIds)
    .not("error_category", "is", null);

  if (msgErr) {
    console.error("[dashboard/errors] messages:", msgErr.message);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // Count by category — use error_categories array when available, fall back to error_category
  const counts: Record<string, number> = {};
  for (const row of msgRows ?? []) {
    const r = row as { error_category: string | null; error_categories: string[] | null };
    const cats = r.error_categories?.length
      ? r.error_categories
      : r.error_category ? [r.error_category] : [];
    for (const cat of cats) {
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
  }

  const result = Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return NextResponse.json(result);
}
