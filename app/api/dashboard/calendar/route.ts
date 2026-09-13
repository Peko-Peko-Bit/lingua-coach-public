import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

const INPUT_MODE_MAP: Record<string, string> = {
  text:      "gym_translation",
  listening: "gym_listening",
  dictation: "gym_dictation",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language") ?? "es";
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getUTCFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getUTCMonth() + 1));

  const startMs  = Date.UTC(year, month - 1, 1);
  const endMs    = Date.UTC(year, month, 1);
  const startISO = new Date(startMs).toISOString();
  const endISO   = new Date(endMs).toISOString();

  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();

  // LinguaCoach: threads for the language
  const { data: threadRows } = await supabase
    .from("threads")
    .select("type, created_at")
    .eq("language", language)
    .eq("user_id", user.id)
    .gte("created_at", startMs)
    .lt("created_at", endMs);

  // LinguaGym: sessions (no language filter per spec)
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("input_mode, created_at")
    .eq("user_id", user.id)
    .gte("created_at", startISO)
    .lt("created_at", endISO);

  const calendar: Record<string, string[]> = {};

  const addActivity = (dateKey: string, activity: string) => {
    if (!calendar[dateKey]) calendar[dateKey] = [];
    if (!calendar[dateKey].includes(activity)) calendar[dateKey].push(activity);
  };

  for (const row of threadRows ?? []) {
    const r = row as { type: string; created_at: number };
    const dateKey = new Date(r.created_at).toISOString().slice(0, 10);
    addActivity(dateKey, r.type); // "chat" or "grammar"
  }

  for (const row of sessionRows ?? []) {
    const r = row as { input_mode: string | null; created_at: string };
    const mapped = INPUT_MODE_MAP[r.input_mode ?? ""];
    if (!mapped) continue;
    const dateKey = r.created_at.slice(0, 10);
    addActivity(dateKey, mapped);
  }

  return NextResponse.json(calendar);
}
