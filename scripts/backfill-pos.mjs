// Backfill part_of_speech for vocabulary records where type='word' and part_of_speech IS NULL
// Usage: node scripts/backfill-pos.mjs

import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL  = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const OR_KEY        = env.OPENROUTER_API_KEY;
const MODEL         = "mistralai/mistral-small-3.2-24b-instruct";
const VALID_POS     = ["noun", "verb", "adjective", "adverb", "other"];

// --- Fetch records ---
console.log("Fetching vocabulary records...");
const fetchRes = await fetch(
  `${SUPABASE_URL}/rest/v1/vocabulary?select=id,term,source_lang&type=eq.word&part_of_speech=is.null`,
  { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
);
const rows = await fetchRes.json();
console.log(`Found ${rows.length} records to process.\n`);
if (rows.length === 0) process.exit(0);

// --- Ask model to classify all terms in one call ---
const itemList = rows.map((r, i) => `${i + 1}. "${r.term}" (${r.source_lang})`).join("\n");

const prompt = `Classify each word's part of speech. Reply ONLY with a JSON array, no other text.
Format: [{"index": 1, "pos": "noun"}, ...]
Allowed values: noun, verb, adjective, adverb, other

Words:
${itemList}`;

console.log("Calling OpenRouter (Mistral Small 3.2)...");
const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OR_KEY}`,
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  }),
});

const aiData = await aiRes.json();
if (!aiRes.ok) {
  console.error("OpenRouter error:", JSON.stringify(aiData));
  process.exit(1);
}

const rawText = aiData?.choices?.[0]?.message?.content ?? "[]";

// Extract JSON array from response (handles both bare array and {results:[...]} wrapper)
let classifications;
try {
  const parsed = JSON.parse(rawText);
  classifications = Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.words ?? Object.values(parsed)[0] ?? []);
} catch {
  // Try to extract array with regex fallback
  const match = rawText.match(/\[[\s\S]*\]/);
  if (!match) { console.error("Cannot parse response:", rawText); process.exit(1); }
  classifications = JSON.parse(match[0]);
}

console.log(`Received ${classifications.length} classifications.\n`);

// --- Update each record ---
let updated = 0, skipped = 0;
for (const item of classifications) {
  const row = rows[item.index - 1];
  if (!row) { skipped++; continue; }

  const pos = VALID_POS.includes(item.pos) ? item.pos : "other";

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/vocabulary?id=eq.${row.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ part_of_speech: pos }),
    }
  );

  if (patchRes.ok) {
    console.log(`  ✓ "${row.term}" (${row.source_lang}) → ${pos}`);
    updated++;
  } else {
    const errText = await patchRes.text();
    console.error(`  ✗ "${row.term}" PATCH failed ${patchRes.status}: ${errText}`);
    skipped++;
  }
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
