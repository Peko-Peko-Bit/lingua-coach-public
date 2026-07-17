import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { getUnits } from "@/lib/db/grammar";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const lang  = searchParams.get("lang");
  const level = searchParams.get("level");

  if (!lang || !level) {
    return NextResponse.json({ error: "lang and level are required" }, { status: 400 });
  }

  try {
    const units = await getUnits(lang, level);
    return NextResponse.json(units);
  } catch (err) {
    console.error("[grammar/units GET]", err);
    return NextResponse.json({ error: "Failed to fetch units" }, { status: 500 });
  }
}
