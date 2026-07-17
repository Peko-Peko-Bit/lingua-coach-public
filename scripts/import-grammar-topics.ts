/**
 * scripts/import-grammar-topics.ts
 *
 * Import data/grammar/es_grammar.json into the grammar_topics table.
 * Processes in batches of 50 (total ~400 entries).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-grammar-topics.ts
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Read at runtime (not a static import): data/grammar/ is excluded from the
// public mirror, and a static JSON import would break type-checking there.
type GrammarTopic = Record<string, unknown>;
const topics: GrammarTopic[] = JSON.parse(
  readFileSync(new URL("../data/grammar/es_grammar.json", import.meta.url), "utf8")
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BATCH_SIZE = 50;

async function main() {
  console.log(`Starting import to grammar_topics: ${topics.length} entries`);

  for (let i = 0; i < topics.length; i += BATCH_SIZE) {
    const batch = topics.slice(i, i + BATCH_SIZE).map((t) => ({
      ...t,
      target_lang: "es",
    }));

    const { error } = await supabase.from("grammar_topics").upsert(batch);

    if (error) {
      console.error(`✗ batch ${i}–${i + batch.length - 1}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ ${i + 1}–${i + batch.length} done`);
  }

  console.log("\ngrammar_topics import complete");
}

main();
