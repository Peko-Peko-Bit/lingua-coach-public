import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { getNextTopic } from "@/lib/db/grammar";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const topic_id = searchParams.get("topic_id");
  const level    = searchParams.get("level");
  const lang     = searchParams.get("lang") ?? "es";

  if (!topic_id || !level) {
    return NextResponse.json(
      { error: "topic_id and level are required" },
      { status: 400 }
    );
  }

  try {
    const topic = await getNextTopic(user.id, lang, topic_id, level);
    return NextResponse.json({ topic });
  } catch (err) {
    console.error("[grammar/next-topic GET]", err);
    return NextResponse.json({ error: "Failed to fetch next topic" }, { status: 500 });
  }
}
