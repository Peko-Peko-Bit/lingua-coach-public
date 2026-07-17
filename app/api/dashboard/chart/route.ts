import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language") ?? "es";
  const period   = searchParams.get("period") ?? "30";

  const supabase = createServerClient();

  const nowMs = Date.now();
  const startMs = period === "7"   ? nowMs - 7  * 86_400_000
                : period === "30"  ? nowMs - 30 * 86_400_000
                : 0;
  const startIso = startMs > 0 ? new Date(startMs).toISOString() : null;

  // -----------------------------------------------------------------------
  // LinguaGym: scored segments (status != 'neutral')
  // Use COALESCE(checked_at, sessions.created_at) as the date
  // -----------------------------------------------------------------------
  type SegRow = {
    checked_at: string | null;
    sessions: { created_at: string } | { created_at: string }[];
  };

  const { data: segData } = await supabase
    .from("segments")
    .select("checked_at, sessions!inner(created_at)")
    .eq("sessions.user_id", user.id)
    .neq("status", "neutral");

  const tmByDate = new Map<string, number>();
  for (const row of (segData ?? []) as unknown as SegRow[]) {
    const sess = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
    const rawDate = row.checked_at ?? sess?.created_at;
    if (!rawDate) continue;
    if (startIso && rawDate < startIso) continue;
    const date = rawDate.slice(0, 10);
    tmByDate.set(date, (tmByDate.get(date) ?? 0) + 1);
  }

  // -----------------------------------------------------------------------
  // Chat: assistant messages (with grammar_check, excluding greetings)
  // -----------------------------------------------------------------------
  const { data: threadRows } = await supabase
    .from("threads")
    .select("id")
    .eq("language", language)
    .eq("user_id", user.id);

  const threadIds = (threadRows ?? []).map((r: { id: string }) => r.id);

  type MsgRow = { grammar_check: { has_error: boolean } | null; created_at: number };
  const chatByDate = new Map<string, { total: number; errors: number }>();

  if (threadIds.length > 0) {
    const msgQuery = supabase
      .from("messages")
      .select("grammar_check, created_at")
      .in("thread_id", threadIds)
      .eq("role", "assistant")
      .not("grammar_check", "is", null)
      .or("is_greeting.is.null,is_greeting.eq.false");

    if (startMs > 0) {
      msgQuery.gte("created_at", startMs);
    }

    const { data: msgData } = await msgQuery;
    for (const msg of (msgData ?? []) as MsgRow[]) {
      const date = new Date(msg.created_at).toISOString().slice(0, 10);
      const entry = chatByDate.get(date) ?? { total: 0, errors: 0 };
      entry.total++;
      if (msg.grammar_check?.has_error) entry.errors++;
      chatByDate.set(date, entry);
    }
  }

  // -----------------------------------------------------------------------
  // Generate date axis (fill all dates when a period is specified)
  // -----------------------------------------------------------------------
  const dateSet = new Set([...tmByDate.keys(), ...chatByDate.keys()]);

  if (startMs > 0) {
    const d = new Date(startMs);
    const today = new Date(nowMs);
    while (d <= today) {
      dateSet.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  const dates = Array.from(dateSet).sort();

  const transmaster_counts = dates.map(d => tmByDate.get(d) ?? 0);
  const chat_counts        = dates.map(d => chatByDate.get(d)?.total ?? 0);
  const error_rate         = dates.map(d => {
    const c = chatByDate.get(d);
    if (!c || c.total === 0) return 0;
    return Math.round((c.errors / c.total) * 100) / 100;
  });

  return NextResponse.json({ dates, transmaster_counts, chat_counts, error_rate });
}
