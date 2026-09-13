#!/usr/bin/env node
/**
 * scripts/generate-demo-conversations.mjs
 *
 * Generates the guest demo conversations by driving the REAL /api/chat pipeline,
 * so the tutor replies come from the actual persona prompts and the corrections
 * from the actual checkGrammar() call. The output is reviewed by hand and then
 * frozen into data/demo/<lang>.json by scripts/freeze-demo-conversations.mjs.
 *
 * This is a one-off authoring tool — it is not part of the app runtime.
 *
 * Prerequisites:
 *   1. npm run dev   (LinguaCoach listens on :3789)
 *   2. .env.local with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Usage:
 *   node scripts/generate-demo-conversations.mjs --lang es
 *   node scripts/generate-demo-conversations.mjs --lang fr --threads t1,t2
 *
 * One anonymous account is created per run. /api/chat allows 60 requests per
 * hour per user (lib/rate-limit.ts) and a full language is 22 turns, so run the
 * three languages as three separate invocations rather than all at once.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ssr from "@supabase/ssr";

const { createServerClient } = ssr;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCENARIOS = path.join(ROOT, "scripts", "demo-scenarios.json");
const DEFAULT_OUT = path.join(ROOT, "scripts", ".demo-out");

const CHARACTERS = JSON.parse(readFileSync(path.join(ROOT, "lib", "characters.json"), "utf8"));

/** Same request shape the UI sends (app/page.tsx → hooks/useAIChat.ts). */
const PROVIDER = "gemini-flash-lite";
const EXPLANATION_LANG = "ja";
const HISTORY_WINDOW = 20;
/** Minutes between consecutive learner turns inside one thread. */
const TURN_GAP_MIN = 3;
/** What the scenario budget in demo-scenarios.json is aiming for, per window. */
const TARGET_ACCURACY = { older: 55, recent: 75 };

// ============================================================
// CLI / env
// ============================================================
function parseArgs(argv) {
  const args = { lang: null, threads: null, out: DEFAULT_OUT, baseUrl: "http://localhost:3789" };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split("=");
    const value = inline ?? argv[i + 1];
    const consume = () => { if (inline === undefined) i += 1; };
    if (flag === "--lang")           { args.lang = value; consume(); }
    else if (flag === "--threads")   { args.threads = value.split(",").map((s) => s.trim()); consume(); }
    else if (flag === "--out")       { args.out = path.resolve(value); consume(); }
    else if (flag === "--base-url")  { args.baseUrl = value.replace(/\/$/, ""); consume(); }
    else { throw new Error(`Unknown argument: ${argv[i]}`); }
  }
  if (!args.lang) throw new Error("--lang is required (es | fr | en)");
  return args;
}

/** Minimal .env.local reader — no dependency, and it never overrides a real env var. */
function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) throw new Error(".env.local not found");
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

// ============================================================
// Auth: build the exact cookie the app expects
// ============================================================
/**
 * Rather than hand-rolling the `sb-<ref>-auth-token` cookie format (base64url,
 * sometimes split into chunks), we let @supabase/ssr write it into an in-memory
 * jar — the same code path the browser client uses — and replay it as a Cookie
 * header. Any future change to that format is picked up for free.
 */
async function signInAsGuest() {
  const jar = new Map();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (list) => {
          for (const { name, value } of list) {
            if (value === "") jar.delete(name);
            else jar.set(name, value);
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`signInAnonymously failed: ${error.message}`);
  if (jar.size === 0) throw new Error("no auth cookie was written — cannot authenticate against /api/chat");

  const header = [...jar.entries()]
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");

  return { userId: data.user.id, cookieHeader: header };
}

// ============================================================
// Generation
// ============================================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callChat({ baseUrl, cookieHeader, message, history, language, character }) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({
      provider: PROVIDER,
      message,
      history: history.slice(-HISTORY_WINDOW),
      aiName: character.name,
      language,
      characterId: character.id,
      explanation_lang: EXPLANATION_LANG,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/api/chat ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function generateThread({ baseUrl, cookieHeader, thread, language }) {
  const character = CHARACTERS.find((c) => c.id === thread.characterId);
  if (!character) throw new Error(`unknown characterId "${thread.characterId}" in thread ${thread.key}`);

  const utterances = thread.utterances[language];
  if (!utterances) throw new Error(`thread ${thread.key} has no "${language}" utterances`);

  const history = [];
  const turns = [];

  for (let i = 0; i < utterances.length; i += 1) {
    const message = utterances[i];
    process.stdout.write(`    turn ${i + 1}/${utterances.length} … `);

    const result = await callChat({ baseUrl, cookieHeader, message, history, language, character });
    const reply = result.data.response_text;
    const grammarCheck = result.data.grammar_check ?? null;

    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });

    turns.push({
      turn: i + 1,
      // Both messages of a turn share a slot; the reply lands a minute later.
      userMinuteOffset: i * TURN_GAP_MIN,
      assistantMinuteOffset: i * TURN_GAP_MIN + 1,
      user: message,
      assistant: reply,
      grammarCheck,
      usedModel: result.usedModel,
      usedFallback: result.usedFallback === true,
      intendedError: (thread.intendedErrorTurns ?? []).includes(i + 1),
    });

    console.log(grammarCheck?.has_error ? "error" : "clean");
    await sleep(400);
  }

  return {
    key: thread.key,
    topic: thread.topic,
    characterId: thread.characterId,
    dayOffset: thread.dayOffset,
    time: thread.time,
    // Matches the app's auto-title rule (app/page.tsx handleFirstMessage).
    title: utterances[0].length > 20 ? `${utterances[0].slice(0, 20)}…` : utterances[0],
    turns,
  };
}

// ============================================================
// Review report
// ============================================================
const isRecent = (thread) => thread.dayOffset > -7;

function accuracyOf(threads) {
  const turns = threads.flatMap((t) => t.turns).filter((t) => t.grammarCheck);
  if (turns.length === 0) return { total: 0, errors: 0, accuracy: null };
  const errors = turns.filter((t) => t.grammarCheck.has_error).length;
  return { total: turns.length, errors, accuracy: Math.round(((turns.length - errors) / turns.length) * 100) };
}

function buildReview({ language, threads, userId }) {
  const recent = threads.filter(isRecent);
  const older = threads.filter((t) => !isRecent(t));
  const recentStats = accuracyOf(recent);
  const olderStats = accuracyOf(older);

  const categories = new Map();
  for (const turn of threads.flatMap((t) => t.turns)) {
    for (const cat of turn.grammarCheck?.error_categories ?? []) {
      categories.set(cat, (categories.get(cat) ?? 0) + 1);
    }
  }

  const mismatches = threads.flatMap((thread) =>
    thread.turns
      .filter((turn) => turn.intendedError !== (turn.grammarCheck?.has_error === true))
      .map((turn) => `- \`${thread.key}\` ターン${turn.turn}: 意図=${turn.intendedError ? "誤りあり" : "誤りなし"} / 実測=${turn.grammarCheck?.has_error ? "誤りあり" : "誤りなし"} — \`${turn.user}\``)
  );

  const diff = recentStats.accuracy !== null && olderStats.accuracy !== null
    ? recentStats.accuracy - olderStats.accuracy
    : null;

  const lines = [
    `# デモ会話レビュー — ${language}`,
    "",
    `生成日時: ${new Date().toISOString()}`,
    `生成アカウント(匿名): \`${userId}\``,
    "",
    "## サマリー",
    "",
    "| 区間 | 添削対象ターン | 誤り | accuracy | 目標 |",
    "|---|---|---|---|---|",
    `| 7〜14日前 | ${olderStats.total} | ${olderStats.errors} | ${olderStats.accuracy ?? "—"}% | ${TARGET_ACCURACY.older}% |`,
    `| 直近7日 | ${recentStats.total} | ${recentStats.errors} | ${recentStats.accuracy ?? "—"}% | ${TARGET_ACCURACY.recent}% |`,
    "",
    `**ダッシュボードに出る値**: Accuracy ${recentStats.accuracy ?? "—"}% / vs last week ${diff === null ? "—" : (diff >= 0 ? `+${diff}` : diff)}`,
    "",
    "### エラーカテゴリ集計（Error Insights に出る内訳）",
    "",
    "| カテゴリ | 件数 |",
    "|---|---|",
    ...[...categories.entries()].sort((a, b) => b[1] - a[1]).map(([cat, n]) => `| ${cat} | ${n} |`),
    "",
    "### 意図とのズレ",
    "",
    ...(mismatches.length > 0
      ? [...mismatches, "", "→ ズレたターンの学習者文を `scripts/demo-scenarios.json` で調整し、**そのスレッドを頭から**再生成する。"]
      : ["なし（意図した位置でだけ誤りが検出された）"]),
    "",
    "---",
    "",
  ];

  for (const thread of threads) {
    const character = CHARACTERS.find((c) => c.id === thread.characterId);
    lines.push(
      `## \`${thread.key}\` ${thread.topic}`,
      "",
      `${Math.abs(thread.dayOffset)}日前 ${thread.time} / キャラ: **${character.name}** / タイトル: 「${thread.title}」`,
      ""
    );

    for (const turn of thread.turns) {
      const gc = turn.grammarCheck;
      const mark = gc?.has_error ? "❌ 誤りあり" : gc ? "✅ 誤りなし" : "⚠️ 添削なし(null)";
      const flag = turn.intendedError !== (gc?.has_error === true) ? "  ← **意図とズレ**" : "";
      lines.push(
        `### ターン${turn.turn} — ${mark}${flag}`,
        "",
        `**学習者**: ${turn.user}`,
        ""
      );
      if (gc) {
        lines.push(
          `**添削**: ${gc.corrected}`,
          "",
          `**説明**: ${gc.explanation || "（なし）"}`,
          "",
          `**カテゴリ**: ${(gc.error_categories ?? []).join(" / ") || "（なし）"}`,
          ""
        );
      }
      lines.push(`**${character.name}**: ${turn.assistant}`, "");
    }
    lines.push("---", "");
  }

  return lines.join("\n");
}

// ============================================================
// Main
// ============================================================
async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnvLocal();

  const scenarios = JSON.parse(readFileSync(SCENARIOS, "utf8"));
  const selected = args.threads
    ? scenarios.threads.filter((t) => args.threads.includes(t.key))
    : scenarios.threads;
  if (selected.length === 0) throw new Error("no threads matched --threads");

  mkdirSync(args.out, { recursive: true });

  console.log(`[demo] language=${args.lang} threads=${selected.map((t) => t.key).join(",")}`);
  console.log(`[demo] target=${args.baseUrl}`);

  const { userId, cookieHeader } = await signInAsGuest();
  console.log(`[demo] signed in as anonymous user ${userId}`);

  const threads = [];
  for (const scenario of selected) {
    console.log(`  ${scenario.key} (${scenario.topic}, ${scenario.characterId})`);
    threads.push(await generateThread({
      baseUrl: args.baseUrl,
      cookieHeader,
      thread: scenario,
      language: args.lang,
    }));
  }

  const raw = { language: args.lang, generatedAt: new Date().toISOString(), userId, threads };
  const rawPath = path.join(args.out, `raw-${args.lang}.json`);
  const reviewPath = path.join(args.out, `demo-review-${args.lang}.md`);

  // A partial run (--threads) must not clobber the threads already generated.
  if (args.threads && existsSync(rawPath)) {
    const previous = JSON.parse(readFileSync(rawPath, "utf8"));
    const merged = previous.threads.map((t) => threads.find((n) => n.key === t.key) ?? t);
    for (const t of threads) if (!merged.some((m) => m.key === t.key)) merged.push(t);
    raw.threads = merged.sort((a, b) => a.dayOffset - b.dayOffset);
  }

  writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  writeFileSync(reviewPath, buildReview({ language: args.lang, threads: raw.threads, userId }), "utf8");

  console.log(`\n[demo] raw    → ${rawPath}`);
  console.log(`[demo] review → ${reviewPath}`);
}

main().catch((err) => {
  console.error(`\n[demo] FAILED: ${err.message}`);
  process.exit(1);
});
