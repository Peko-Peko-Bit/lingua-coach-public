import { NextResponse } from "next/server";
import { getGrammarThreads } from "@/lib/db";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function GET() {
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const threads = await getGrammarThreads(user.id);
    return NextResponse.json(threads);
  } catch (err) {
    console.error("[grammar/threads GET]", err);
    return NextResponse.json({ error: "Failed to fetch grammar threads" }, { status: 500 });
  }
}
