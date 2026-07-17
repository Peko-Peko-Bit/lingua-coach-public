/**
 * lib/languages.ts
 *
 * Language definitions. To add a new language, just add one entry here.
 *
 * To add:
 *   1. Add language code to LanguageCode (e.g. "de")
 *   2. Add LanguageMeta to LANGUAGES
 *   3. Place flag SVG at public/flags/l/{CODE}.svg
 */

export type LanguageCode = "es" | "fr" | "en";

export interface LanguageMeta {
  code: LanguageCode;
  /** English display name */
  name: string;
  /** Native display name */
  nativeName: string;
  /** Path to flag SVG under public/ */
  flagSrc: string;
  /** Input form placeholder */
  placeholder: string;
  /** Header subtitle */
  tutorSubtitle: string;
  /** Welcome screen greeting */
  greeting: string;
  /** Complexity detection patterns for Auto mode */
  complexPatterns: RegExp[];
}

export const LANGUAGES: Record<LanguageCode, LanguageMeta> = {
  es: {
    code: "es",
    name: "Español",
    nativeName: "Español",
    flagSrc: "/flags/l/ES.svg",
    placeholder: "Escribe en español…",
    tutorSubtitle: "Spanish tutor",
    greeting: "¡Hola!",
    complexPatterns: [
      /expl[íi]came en detalle/i,
      /comparaci[oó]n entre/i,
      /pasos para implementar/i,
      /diferencias? entre/i,
      /c[oó]mo funciona/i,
      /en profundidad/i,
      /paso a paso/i,
      /gu[íi]a completa/i,
      /ventajas? y desventajas?/i,
      /anal[ií]za/i,
      /mejor práctica/i,
    ],
  },
  fr: {
    code: "fr",
    name: "Français",
    nativeName: "Français",
    flagSrc: "/flags/l/FR.svg",
    placeholder: "Écris en français…",
    tutorSubtitle: "French tutor",
    greeting: "Bonjour !",
    complexPatterns: [
      /expliquez en détail/i,
      /comparaison entre/i,
      /étapes pour implémenter/i,
      /différences? entre/i,
      /comment fonctionne/i,
      /en profondeur/i,
      /étape par étape/i,
      /guide complet/i,
      /avantages? et inconvénients?/i,
      /analysez/i,
      /meilleures? pratiques?/i,
    ],
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flagSrc: "/flags/l/GB.svg",
    placeholder: "Type in English…",
    tutorSubtitle: "English tutor",
    greeting: "Hello!",
    complexPatterns: [
      /explain in detail/i,
      /comparison between/i,
      /steps to implement/i,
      /differences? between/i,
      /how (does|do|did) .* work/i,
      /in depth/i,
      /step by step/i,
      /complete guide/i,
      /advantages? and disadvantages?/i,
      /analyze/i,
      /best practices?/i,
    ],
  },
};

export const DEFAULT_LANGUAGE: LanguageCode = "es";
export const LANGUAGE_LIST: LanguageMeta[] = Object.values(LANGUAGES);
