"use client";

import { useEffect } from "react";

/**
 * Uses Visual Viewport API to keep the CSS custom property --app-height in sync
 * with the actual visible area height (excluding the soft keyboard).
 *
 * Using interactive-widget=resizes-content (Android Chrome) alone does not work on
 * iOS Safari, so both approaches are combined.
 */
export function ViewportHeightProvider() {
  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
    };

    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return null;
}
