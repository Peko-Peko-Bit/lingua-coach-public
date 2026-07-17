import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { saveProgress } from "@/lib/db/grammar";

export async function POST(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lang, unit_id, topic_id, level } = body as Record<string, string>;
  if (!lang || !unit_id || !topic_id || !level) {
    return NextResponse.json(
      { error: "lang, unit_id, topic_id and level are required" },
      { status: 400 }
    );
  }

  try {
    await saveProgress(user.id, lang, unit_id, topic_id, level);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[grammar/progress POST]", err);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
