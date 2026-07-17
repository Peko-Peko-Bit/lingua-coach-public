import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { getSettings, saveSettings } from "@/lib/db/grammar";

export async function GET(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const lang = searchParams.get("lang");

  if (!lang) {
    return NextResponse.json({ error: "lang is required" }, { status: 400 });
  }

  try {
    const settings = await getSettings(user.id, lang);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[grammar/settings GET]", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

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

  const { lang, level, last_topic_id, last_unit_id } = body as Record<string, string | null>;
  if (!lang || !level) {
    return NextResponse.json(
      { error: "lang and level are required" },
      { status: 400 }
    );
  }

  try {
    await saveSettings(user.id, lang, level, last_topic_id ?? null, last_unit_id ?? null);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[grammar/settings POST]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
