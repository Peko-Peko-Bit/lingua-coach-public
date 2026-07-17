import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { getSession } from "@/lib/db/grammar";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const lang     = searchParams.get("lang");
  const topic_id = searchParams.get("topic_id");
  const level    = searchParams.get("level");

  if (!lang || !topic_id || !level) {
    return NextResponse.json({ error: "lang, topic_id and level are required" }, { status: 400 });
  }

  try {
    const session = await getSession(lang, topic_id, level);
    if (!session) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (err) {
    console.error("[grammar/session GET]", err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
