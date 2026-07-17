import { NextRequest, NextResponse } from "next/server";
import { updateVocabularyNormalized, deleteVocabularyEntry } from "@/lib/db/vocabulary";
import { createAuthServerClient } from "@/lib/supabase-auth-server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { baseTerm, partOfSpeech, translation, type } = await req.json();
    await updateVocabularyNormalized(id, baseTerm, partOfSpeech ?? null, translation, type ?? "word", user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[vocabulary PATCH]", err);
    return NextResponse.json({ error: "Failed to update vocabulary" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await deleteVocabularyEntry(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[vocabulary DELETE]", err);
    return NextResponse.json({ error: "Failed to delete vocabulary" }, { status: 500 });
  }
}
