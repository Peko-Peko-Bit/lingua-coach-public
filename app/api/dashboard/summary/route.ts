import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language") ?? "es";
  const supabase = createServerClient();

  const now            = Date.now();
  const sevenDaysAgo   = now - 7  * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo  = now - 30 * 24 * 60 * 60 * 1000;

  // --- Accuracy (messages joined via thread language) ---
  const { data: threadRows, error: threadErr } = await supabase
    .from("threads")
    .select("id")
    .eq("language", language)
    .eq("user_id", user.id);

  if (threadErr) {
    console.error("[dashboard/summary] threads:", threadErr.message);
    return NextResponse.json({ error: threadErr.message }, { status: 500 });
  }

  const threadIds = (threadRows ?? []).map((r: { id: string }) => r.id);

  // null = no data to compute accuracy from (distinct from a genuine 0%)
  let currentAccuracy: number | null = null;
  let previousAccuracy: number | null = null;

  if (threadIds.length > 0) {
    // DB-side date filter has type mismatch risk (BIGINT vs number),
    // so filtering on the JS side. toMs() handles string-typed created_at.
    const { data: msgRows, error: msgErr } = await supabase
      .from("messages")
      .select("grammar_check, created_at")
      .in("thread_id", threadIds)
      .eq("role", "assistant")
      .not("grammar_check", "is", null)
      .or("is_greeting.is.null,is_greeting.eq.false");

    if (msgErr) {
      console.error("[dashboard/summary] messages:", msgErr.message);
    }

    // Normalize created_at — accepts either BIGINT (number) or TIMESTAMPTZ (string)
    const toMs = (v: unknown): number => {
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = Number(v);
        if (!isNaN(n)) return n;           // numeric string e.g. "1746000000000"
        const d = Date.parse(v);
        return isNaN(d) ? 0 : d;           // ISO string e.g. "2026-04-28T..."
      }
      return 0;
    };

    type RawRow = { grammar_check: unknown; created_at: unknown };
    const rawRows = (msgRows ?? []) as RawRow[];

    console.log(`[dashboard/summary] rows fetched: ${rawRows.length}`);
    if (rawRows.length > 0) {
      const sample = rawRows[0];
      console.log(`[dashboard/summary] sample created_at:`, sample.created_at, typeof sample.created_at);
      console.log(`[dashboard/summary] sample grammar_check:`, JSON.stringify(sample.grammar_check));
    }

    const isError = (r: RawRow) =>
      (r.grammar_check as Record<string, unknown>)?.has_error === true;

    const inRange      = rawRows.filter((r) => toMs(r.created_at) >= thirtyDaysAgo);
    const currentMsgs  = inRange.filter((r) => toMs(r.created_at) >= sevenDaysAgo);
    const previousMsgs = inRange.filter((r) => {
      const ts = toMs(r.created_at);
      return ts >= fourteenDaysAgo && ts < sevenDaysAgo;
    });

    const currentErrors  = currentMsgs.filter(isError).length;
    const prevErrors     = previousMsgs.filter(isError).length;

    console.log(
      `[dashboard/summary] inRange=${inRange.length}` +
      ` current=${currentMsgs.length} previous=${previousMsgs.length}` +
      ` currentErrors=${currentErrors} prevErrors=${prevErrors}`
    );

    const calcAccuracy = (msgs: RawRow[]): number | null => {
      if (msgs.length === 0) return null; // no data — caller shows an empty state, not 0%
      const errors  = msgs.filter(isError).length;
      const correct = msgs.length - errors;
      return Math.round((correct / msgs.length) * 100);
    };

    currentAccuracy  = calcAccuracy(currentMsgs);
    previousAccuracy = calcAccuracy(previousMsgs);

    console.log(`[dashboard/summary] accuracy current=${currentAccuracy} previous=${previousAccuracy}`);

  }

  // --- Grammar Progress (language filter not applied per spec) ---
  const [progressRes, topicsRes] = await Promise.all([
    supabase.from("grammar_progress").select("topic_id").eq("user_id", user.id),
    supabase.from("grammar_topics").select("*", { count: "exact", head: true }),
  ]);

  const completedTopics = new Set(
    (progressRes.data ?? []).map((r: { topic_id: string }) => r.topic_id)
  ).size;
  const totalTopics = topicsRes.count ?? 0;

  // --- Segments (LinguaGym, grouped by input_mode) ---
  type SegModeRow = {
    status: string;
    sessions: { input_mode: string | null } | { input_mode: string | null }[];
  };

  const { data: segModeRows } = await supabase
    .from("segments")
    .select("status, sessions!inner(input_mode)")
    .eq("sessions.user_id", user.id)
    .neq("status", "neutral");

  type ModeStats = { total: number; green: number; yellow: number; red: number };
  const emptyMode = (): ModeStats => ({ total: 0, green: 0, yellow: 0, red: 0 });
  const linguagym = {
    translation: emptyMode(),
    listening:   emptyMode(),
    dictation:   emptyMode(),
  };

  for (const row of (segModeRows ?? []) as unknown as SegModeRow[]) {
    const sess = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
    const mode = sess?.input_mode ?? "text";
    const key =
      mode === "listening" ? "listening" :
      mode === "dictation" ? "dictation" :
      mode === "text"      ? "translation" : null;
    if (!key) continue;
    const bucket = linguagym[key];
    bucket.total++;
    if (row.status === "green")        bucket.green++;
    else if (row.status === "yellow")  bucket.yellow++;
    else if (row.status === "red")     bucket.red++;
  }

  return NextResponse.json({
    accuracy: {
      current: currentAccuracy,
      previous: previousAccuracy,
      // diff only meaningful when both periods have data
      diff: currentAccuracy !== null && previousAccuracy !== null
        ? currentAccuracy - previousAccuracy
        : null,
    },
    grammar: {
      completed: completedTopics,
      total: totalTopics,
    },
    linguagym,
  });
}
