import { createServerClient } from "@/lib/supabase-server";

export interface VocabularyEntry {
  id: string;
  term: string;
  translation: string;
  sourceLang: string;
  targetLang: string;
  type?: "word" | "phrase";
  partOfSpeech?: string;
  threadId?: string;    // DB column: session_id
  threadTitle: string;  // DB column: session_title
  sourceApp?: string;   // DB column: source_app
  createdAt: string;    // ISO string
}

export async function getAllVocabulary(userId: string): Promise<VocabularyEntry[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("vocabulary")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

export async function addVocabularyEntry(
  entry: Omit<VocabularyEntry, "id" | "createdAt"> & { userId: string }
): Promise<VocabularyEntry> {
  const supabase = createServerClient();
  const id = `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { userId, ...rest } = entry;
  const row = { ...fromEntry({ ...rest, id, createdAt: new Date().toISOString() }), user_id: userId };
  const { data, error } = await supabase
    .from("vocabulary")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return toEntry(data);
}

export async function updateVocabularyNormalized(
  id: string,
  baseTerm: string,
  partOfSpeech: string | null,
  translation: string,
  type: "word" | "phrase" = "word",
  userId: string
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("vocabulary")
    .update({ term: baseTerm, part_of_speech: partOfSpeech, translation, type })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteVocabularyEntry(id: string, userId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("vocabulary").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// snake_case ↔ camelCase conversion
function toEntry(row: Record<string, unknown>): VocabularyEntry {
  return {
    id:           row.id as string,
    term:         row.term as string,
    translation:  row.translation as string,
    sourceLang:   row.source_lang as string,
    targetLang:   row.target_lang as string,
    type:         (row.type as "word" | "phrase" | undefined) ?? "word",
    partOfSpeech: row.part_of_speech as string | undefined,
    threadId:     row.session_id as string | undefined,
    threadTitle:  row.session_title as string,
    sourceApp:    row.source_app as string | undefined,
    createdAt:    row.created_at as string,
  };
}

function fromEntry(e: VocabularyEntry) {
  return {
    id:             e.id,
    term:           e.term,
    translation:    e.translation,
    source_lang:    e.sourceLang,
    target_lang:    e.targetLang,
    type:           e.type ?? "word",
    part_of_speech: e.partOfSpeech ?? null,
    session_id:     e.threadId ?? null,
    session_title:  e.threadTitle,
    source_app:     "lingua_coach",
    created_at:     e.createdAt,
  };
}
