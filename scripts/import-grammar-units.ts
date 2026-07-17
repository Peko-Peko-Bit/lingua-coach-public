/**
 * scripts/import-grammar-units.ts
 *
 * Import data/grammar/es_units.json into the grammar_units table.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-grammar-units.ts
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Read at runtime (not a static import): data/grammar/ is excluded from the
// public mirror, and a static JSON import would break type-checking there.
type GrammarUnit = {
  unit_id: string;
  order: number;
  advanced: boolean;
  levels: string[];
  name: { es: string; en: string; ja: string };
  dele_chapters: string[];
  dele_sections: string[];
};
const units: GrammarUnit[] = JSON.parse(
  readFileSync(new URL("../data/grammar/es_units.json", import.meta.url), "utf8")
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  console.log(`Starting import to grammar_units: ${units.length} entries`);

  for (const unit of units) {
    const { error } = await supabase.from("grammar_units").upsert({
      unit_id:       unit.unit_id,
      target_lang:   "es",
      order:         unit.order,
      advanced:      unit.advanced,
      levels:        unit.levels,
      name_es:       unit.name.es,
      name_en:       unit.name.en,
      name_ja:       unit.name.ja,
      dele_chapters: unit.dele_chapters,
      dele_sections: unit.dele_sections,
    });

    if (error) {
      console.error(`✗ ${unit.unit_id}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ ${unit.unit_id}: ${unit.name.ja}`);
  }

  console.log("\ngrammar_units import complete");
}

main();
