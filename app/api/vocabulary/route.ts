import { NextRequest, NextResponse } from "next/server";
import { getAllVocabulary, addVocabularyEntry } from "@/lib/db/vocabulary";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function GET() {
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const entries = await getAllVocabulary(user.id);
    return NextResponse.json(entries);
  } catch (err) {
    console.error("[vocabulary GET]", err);
    return NextResponse.json({ error: "Failed to fetch vocabulary" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { term, translation, sourceLang, targetLang, threadId, threadTitle } = body;
    if (!term || !translation || !sourceLang || !targetLang || !threadTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const entry = await addVocabularyEntry({ term, translation, sourceLang, targetLang, threadId, threadTitle, userId: user.id });
    return NextResponse.json(entry);
  } catch (err) {
    console.error("[vocabulary POST]", err);
    return NextResponse.json({ error: "Failed to add vocabulary" }, { status: 500 });
  }
}
