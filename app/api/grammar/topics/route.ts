import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { getTopics } from "@/lib/db/grammar";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const lang    = searchParams.get("lang");
  const unit_id = searchParams.get("unit_id");
  const level   = searchParams.get("level");

  if (!lang || !unit_id || !level) {
    return NextResponse.json({ error: "lang, unit_id and level are required" }, { status: 400 });
  }

  try {
    const topics = await getTopics(lang, unit_id, level);
    return NextResponse.json(topics);
  } catch (err) {
    console.error("[grammar/topics GET]", err);
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 });
  }
}
