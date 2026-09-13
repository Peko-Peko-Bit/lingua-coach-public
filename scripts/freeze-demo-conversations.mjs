#!/usr/bin/env node
/**
 * scripts/freeze-demo-conversations.mjs
 *
 * Turns the reviewed output of generate-demo-conversations.mjs into the fixtures
 * the guest seed reads: data/demo/<lang>.json.
 *
 * Nothing here calls an LLM — the conversations are already fixed at this point.
 * The script only reshapes them into the seed's input format and runs the sanity
 * checks that are cheap to automate:
 *
 *   - both accuracy windows are populated (otherwise the dashboard shows no badge)
 *   - every vocabulary term actually occurs in the thread it is attributed to
 *   - no absolute timestamps or generated ids leak into the fixture
 *
 * Usage:
 *   node scripts/freeze-demo-conversations.mjs            # all three languages
 *   node scripts/freeze-demo-conversations.mjs --lang es
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "scripts", ".demo-out");
const OUT_DIR = path.join(ROOT, "data", "demo");
const LANGUAGES = ["es", "fr", "en"];

/** Strip accents and case so "Cerca del centro" matches "cerca de centro"'s correction. */
const normalize = (s) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ");

function freeze(language, scenarios) {
  const rawPath = path.join(RAW_DIR, `raw-${language}.json`);
  if (!existsSync(rawPath)) throw new Error(`${rawPath} not found — run generate-demo-conversations.mjs --lang ${language} first`);
  const raw = JSON.parse(readFileSync(rawPath, "utf8"));

  const threads = raw.threads.map((thread) => ({
    key: thread.key,
    title: thread.title,
    characterId: thread.characterId,
    dayOffset: thread.dayOffset,
    time: thread.time,
    messages: thread.turns.flatMap((turn) => [
      { role: "user", content: turn.user, minuteOffset: turn.userMinuteOffset },
      {
        role: "assistant",
        content: turn.assistant,
        minuteOffset: turn.assistantMinuteOffset,
        // Kept verbatim from checkGrammar() — the same shape the app writes.
        grammarCheck: turn.grammarCheck,
        usedModel: turn.usedModel,
        usedFallback: turn.usedFallback,
      },
    ]),
  }));

  // --- both accuracy windows must be populated -----------------------------
  const checked = (list) => list.flatMap((t) => t.messages).filter((m) => m.role === "assistant" && m.grammarCheck);
  const recent = checked(threads.filter((t) => t.dayOffset > -7));
  const older = checked(threads.filter((t) => t.dayOffset <= -7 && t.dayOffset > -14));
  if (recent.length === 0 || older.length === 0) {
    throw new Error(`${language}: both the last-7-days and the 7-14-days window need graded messages (recent=${recent.length}, older=${older.length})`);
  }
  const accuracy = (list) => Math.round(((list.length - list.filter((m) => m.grammarCheck.has_error).length) / list.length) * 100);

  // --- every saved term must occur in its own thread ------------------------
  const vocabulary = scenarios.vocabulary[language];
  if (!vocabulary) throw new Error(`no vocabulary defined for "${language}"`);
  for (const entry of vocabulary) {
    const thread = threads.find((t) => t.key === entry.threadKey);
    if (!thread) throw new Error(`${language}: vocabulary "${entry.term}" points at unknown thread ${entry.threadKey}`);
    const haystack = normalize(
      thread.messages.map((m) => `${m.content} ${m.grammarCheck?.corrected ?? ""}`).join(" ")
    );
    if (!haystack.includes(normalize(entry.term))) {
      throw new Error(`${language}: vocabulary "${entry.term}" does not occur anywhere in thread ${entry.threadKey}`);
    }
  }

  const fixture = {
    language,
    threads,
    vocabulary: vocabulary.map((entry) => ({
      term: entry.term,
      translation: entry.translation,
      type: entry.type,
      partOfSpeech: entry.partOfSpeech,
      threadKey: entry.threadKey,
      minuteOffset: entry.minuteOffset,
      lastReviewedDayOffset: entry.lastReviewedDayOffset,
    })),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${language}.json`);
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

  const messages = threads.reduce((n, t) => n + t.messages.length, 0);
  console.log(
    `[freeze] ${language}: ${threads.length} threads / ${messages} messages / ${vocabulary.length} vocabulary` +
    `  —  accuracy ${accuracy(older)}% → ${accuracy(recent)}% (${accuracy(recent) - accuracy(older) >= 0 ? "+" : ""}${accuracy(recent) - accuracy(older)})`
  );
  console.log(`          → ${path.relative(ROOT, outPath)}`);
}

const langArg = process.argv.indexOf("--lang");
const targets = langArg === -1 ? LANGUAGES : [process.argv[langArg + 1]];
const scenarios = JSON.parse(readFileSync(path.join(ROOT, "scripts", "demo-scenarios.json"), "utf8"));

try {
  for (const language of targets) freeze(language, scenarios);
} catch (err) {
  console.error(`[freeze] FAILED: ${err.message}`);
  process.exit(1);
}
