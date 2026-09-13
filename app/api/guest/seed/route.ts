import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { createServerClient } from "@/lib/supabase-server";
import esDemo from "@/data/demo/es.json";
import frDemo from "@/data/demo/fr.json";
import enDemo from "@/data/demo/en.json";

/**
 * Guest demo data.
 *
 * A brand-new guest lands on an empty dashboard, which makes the app look
 * unused. On first anonymous sign-in we insert a frozen set of conversations
 * (data/demo/*.json) so every panel has something to show.
 *
 * The fixtures were produced once by driving the real /api/chat pipeline
 * (scripts/generate-demo-conversations.mjs) — the tutor replies and the
 * corrections are genuine model output, not hand-written. Seeding therefore
 * costs no LLM call: it is a plain insert.
 *
 * Dates are stored as offsets, not timestamps, and are materialised against
 * "now" on every seed, so the history still reads as "the last two weeks"
 * however long ago the fixtures were recorded. Threads t1-t3 land in the
 * 7-14 day window and t4-t6 in the last 7 days, which is what lets
 * /api/dashboard/summary compute both accuracy periods and the
 * "vs last week" badge.
 */

interface DemoGrammarCheck {
  has_error: boolean;
  original?: string;
  corrected?: string;
  explanation?: string;
  error_categories?: string[];
  error_category?: string | null;
}

interface DemoMessage {
  role: string;
  content: string;
  minuteOffset: number;
  grammarCheck?: DemoGrammarCheck;
  usedModel?: string;
  usedFallback?: boolean;
}

interface DemoThread {
  key: string;
  title: string;
  characterId: string;
  dayOffset: number;
  time: string;
  messages: DemoMessage[];
}

interface DemoVocabulary {
  term: string;
  translation: string;
  type: string;
  partOfSpeech: string | null;
  threadKey: string;
  minuteOffset: number;
  lastReviewedDayOffset: number | null;
}

interface DemoFixture {
  language: string;
  threads: DemoThread[];
  vocabulary: DemoVocabulary[];
}

const DEMO_FIXTURES: DemoFixture[] = [esDemo, frDemo, enDemo];

/** Vocabulary is always saved with an English gloss (see VocabularyPopup in app/page.tsx). */
const VOCABULARY_TARGET_LANG = "en";
/** Hour of day used for the "last reviewed" stamps — an evening review session. */
const REVIEW_HOUR = 20;

/**
 * Resolve a fixture offset against `now`.
 *
 * threads.created_at and messages.created_at are BIGINT epoch milliseconds
 * (vocabulary uses timestamptz instead — see toIso below); mixing the two up
 * silently breaks every dashboard aggregate.
 */
function toEpochMs(now: Date, dayOffset: number, time: string, minuteOffset: number): number {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes + minuteOffset, 0, 0);
  return date.getTime();
}

const toIso = (epochMs: number) => new Date(epochMs).toISOString();

/**
 * Ids are derived from the user id rather than minted randomly.
 *
 * They still cannot collide between two guests (the user id is in them), but
 * they ARE stable across repeated seeds of the same guest — which is what lets
 * the inserts below be conflict-ignoring upserts. Without that, two requests
 * arriving together both pass the "already seeded?" check, both mint fresh
 * uuids, and the guest ends up with two of everything.
 *
 * The language has to be part of the key: thread keys are t1-t6 in every
 * fixture, so leaving it out maps all three languages onto six ids and
 * ON CONFLICT DO NOTHING silently drops twelve of the eighteen threads.
 */
const threadId = (userId: string, language: string, key: string) =>
  `thread-demo-${userId}-${language}-${key}`;
const messageId = (userId: string, language: string, key: string, index: number) =>
  `msg-demo-${userId}-${language}-${key}-${index}`;
const vocabularyId = (userId: string, language: string, index: number) =>
  `vocab-demo-${userId}-${language}-${index}`;

function buildRows(userId: string, now: Date) {
  const threads: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  const vocabulary: Record<string, unknown>[] = [];

  for (const fixture of DEMO_FIXTURES) {
    const threadIdByKey = new Map<string, string>();

    for (const thread of fixture.threads) {
      const id = threadId(userId, fixture.language, thread.key);
      threadIdByKey.set(thread.key, id);

      const lastMinuteOffset = thread.messages.reduce((max, m) => Math.max(max, m.minuteOffset), 0);

      threads.push({
        id:                id,
        title:             thread.title,
        created_at:        toEpochMs(now, thread.dayOffset, thread.time, 0),
        // Keeps the sidebar ordered by real recency instead of all-at-once.
        last_updated_at:   toEpochMs(now, thread.dayOffset, thread.time, lastMinuteOffset),
        type:              "chat",
        grammar_topic_id:  null,
        grammar_level:     null,
        grammar_unit_name: null,
        completed:         false,
        score:             null,
        language:          fixture.language,
        character_id:      thread.characterId,
        user_id:           userId,
      });

      thread.messages.forEach((message, index) => {
        // The grammar check of a learner turn is attached to the tutor reply
        // that follows it — same shape hooks/useAIChat.ts writes.
        const check = message.grammarCheck;
        messages.push({
          id:               messageId(userId, fixture.language, thread.key, index),
          role:             message.role,
          content:          message.content,
          grammar_check:    check ?? null,
          error_category:   check?.error_category ?? null,
          error_categories: check?.error_categories ?? [],
          is_greeting:      false,
          used_model:       message.usedModel ?? null,
          used_fallback:    message.usedFallback ?? null,
          stage:            null,
          created_at:       toEpochMs(now, thread.dayOffset, thread.time, message.minuteOffset),
          thread_id:        id,
        });
      });
    }

    fixture.vocabulary.forEach((entry, index) => {
      const thread = fixture.threads.find((t) => t.key === entry.threadKey);
      if (!thread) return;

      vocabulary.push({
        id:              vocabularyId(userId, fixture.language, index),
        term:            entry.term,
        translation:     entry.translation,
        source_lang:     fixture.language,
        target_lang:     VOCABULARY_TARGET_LANG,
        type:            entry.type,
        part_of_speech:  entry.partOfSpeech,
        session_id:      threadIdByKey.get(entry.threadKey) ?? null,
        session_title:   thread.title,
        source_app:      "lingua_coach",
        created_at:      toIso(toEpochMs(now, thread.dayOffset, thread.time, entry.minuteOffset)),
        last_reviewed_at: entry.lastReviewedDayOffset === null
          ? null
          : toIso(toEpochMs(now, entry.lastReviewedDayOffset, `${REVIEW_HOUR}:00`, 0)),
        user_id:         userId,
      });
    });
  }

  return { threads, messages, vocabulary };
}

export async function POST() {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Anonymous users have an empty app_metadata (no provider key) — is_anonymous
  // is the only reliable flag. Checking provider here silently skipped every guest.
  // Every 200 carries `seeded`, including the no-op paths: components/GuestSeedOnEntry.tsx
  // reloads the page on `seeded: true`, so leaving it undefined here would make
  // "did we insert anything?" depend on a missing field being falsy.
  if (user.is_anonymous !== true) {
    return NextResponse.json({ message: "Not a guest user", seeded: false }, { status: 200 });
  }

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("threads")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: "Already seeded", seeded: false }, { status: 200 });
  }

  const { threads, messages, vocabulary } = buildRows(user.id, new Date());

  // Seeding is a nice-to-have: the login flow waits on this response, so a
  // failure here must degrade to an empty (but working) account rather than
  // block sign-in. The caller only distinguishes on `seeded`.
  try {
    // Conflict-ignoring upserts, not inserts: the check above is not atomic, so
    // two requests can both reach this point. Deterministic ids turn the loser
    // of that race into a no-op instead of a second copy of the whole demo.
    const { error: threadError } = await supabase
      .from("threads")
      .upsert(threads, { ignoreDuplicates: true });
    if (threadError) throw new Error(`threads: ${threadError.message}`);

    // Both reference the threads above, so they cannot go first — but they are
    // independent of each other, which saves one round trip on a slow link.
    const [messageResult, vocabularyResult] = await Promise.all([
      supabase.from("messages").upsert(messages, { ignoreDuplicates: true }),
      supabase.from("vocabulary").upsert(vocabulary, { ignoreDuplicates: true }),
    ]);
    if (messageResult.error) throw new Error(`messages: ${messageResult.error.message}`);
    if (vocabularyResult.error) throw new Error(`vocabulary: ${vocabularyResult.error.message}`);
  } catch (err) {
    console.error("[guest/seed] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ message: "Seed failed", seeded: false }, { status: 200 });
  }

  return NextResponse.json({ message: "Seeded", seeded: true }, { status: 200 });
}
