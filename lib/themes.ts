export type ThemeId = "olive" | "espanol";

export type ColorMode = "light" | "dark" | "system";

export const LANGUAGE_THEME_MAP: Record<string, ThemeId> = {
  es: "espanol",
  // Future: fr: "francais", etc.
};

export const DEFAULT_THEME: ThemeId = "olive";
export const DEFAULT_COLOR_MODE: ColorMode = "system";
