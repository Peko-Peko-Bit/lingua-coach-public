"use client";

import { useState, useEffect } from "react";
import {
  LANGUAGE_THEME_MAP,
  DEFAULT_THEME,
  DEFAULT_COLOR_MODE,
  type ThemeId,
  type ColorMode,
} from "@/lib/themes";

const COLOR_MODE_KEY = "colorMode";
const VALID_MODES: ColorMode[] = ["light", "dark", "system"];

function applyTheme(theme: ThemeId, colorMode: ColorMode) {
  document.documentElement.setAttribute("data-theme", theme);
  if (colorMode === "system") {
    document.documentElement.removeAttribute("data-color-scheme");
  } else {
    document.documentElement.setAttribute("data-color-scheme", colorMode);
  }
}

export function useTheme(language: string) {
  const theme: ThemeId = LANGUAGE_THEME_MAP[language] ?? DEFAULT_THEME;
  const [colorMode, setColorModeState] = useState<ColorMode>(DEFAULT_COLOR_MODE);

  useEffect(() => {
    const stored = localStorage.getItem(COLOR_MODE_KEY) as ColorMode | null;
    const initial: ColorMode = stored && VALID_MODES.includes(stored) ? stored : DEFAULT_COLOR_MODE;
    setColorModeState(initial);
    applyTheme(theme, initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyTheme(theme, colorMode);
  }, [theme, colorMode]);

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem(COLOR_MODE_KEY, mode);
    applyTheme(theme, mode);
  };

  return { theme, colorMode, setColorMode };
}
