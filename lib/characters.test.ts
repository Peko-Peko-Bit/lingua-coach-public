/**
 * lib/characters.test.ts
 *
 * Tests for character resolution.
 *
 * A thread stores its character as a raw ID (threads.character_id), which can
 * be null for threads created before the per-thread character feature and for
 * grammar threads. Every renderer resolves through these helpers, so a missing
 * fallback here shows up as a crash on old conversations.
 */

import { describe, it, expect } from "vitest";
import {
  CHARACTERS,
  DEFAULT_CHARACTER_ID,
  resolveCharacter,
  charactersForLanguage,
  resolveCharacterIdForLanguage,
} from "./characters";
import { LANGUAGES, type LanguageCode } from "./languages";

const ALL_LANGUAGES = Object.keys(LANGUAGES) as LanguageCode[];

describe("DEFAULT_CHARACTER_ID", () => {
  it("is roberta, not the bare 'ai' character that sits first in the list", () => {
    expect(DEFAULT_CHARACTER_ID).toBe("roberta");
    expect(CHARACTERS[0].id).toBe("ai");
  });
});

describe("resolveCharacter", () => {
  it("resolves a known ID", () => {
    expect(resolveCharacter("clara").name).toBe("Clara");
  });

  it("falls back to the default for a legacy thread (null)", () => {
    expect(resolveCharacter(null).id).toBe(DEFAULT_CHARACTER_ID);
  });

  it("falls back to the default for undefined and empty string", () => {
    expect(resolveCharacter(undefined).id).toBe(DEFAULT_CHARACTER_ID);
    expect(resolveCharacter("").id).toBe(DEFAULT_CHARACTER_ID);
  });

  it("falls back to the default for an unknown ID (removed/renamed character)", () => {
    expect(resolveCharacter("no-such-character").id).toBe(DEFAULT_CHARACTER_ID);
  });
});

describe("charactersForLanguage", () => {
  it("includes characters with no language restriction", () => {
    const unrestricted = CHARACTERS.filter((c) => !c.compatibleLanguages);
    for (const lang of ALL_LANGUAGES) {
      const ids = charactersForLanguage(lang).map((c) => c.id);
      for (const c of unrestricted) expect(ids).toContain(c.id);
    }
  });

  it("only returns characters compatible with the language", () => {
    for (const lang of ALL_LANGUAGES) {
      for (const c of charactersForLanguage(lang)) {
        if (c.compatibleLanguages) expect(c.compatibleLanguages).toContain(lang);
      }
    }
  });

  it("never returns an empty list (the picker must always have options)", () => {
    for (const lang of ALL_LANGUAGES) {
      expect(charactersForLanguage(lang).length).toBeGreaterThan(0);
    }
  });
});

describe("resolveCharacterIdForLanguage", () => {
  it("keeps a character that is valid for the language", () => {
    expect(resolveCharacterIdForLanguage("clara", "es")).toBe("clara");
  });

  it("falls back to the default for an unknown ID", () => {
    expect(resolveCharacterIdForLanguage("no-such-character", "es")).toBe(DEFAULT_CHARACTER_ID);
  });

  it("always returns a character selectable in that language", () => {
    for (const lang of ALL_LANGUAGES) {
      const selectable = charactersForLanguage(lang).map((c) => c.id);
      for (const c of CHARACTERS) {
        expect(selectable).toContain(resolveCharacterIdForLanguage(c.id, lang));
      }
      expect(selectable).toContain(resolveCharacterIdForLanguage(null, lang));
    }
  });
});
