/**
 * lib/grammar-config.ts
 * Configuration constants for grammar mode progress calculation etc.
 */

/**
 * Defines unit IDs to exclude from progress calculation, per level.
 * To add a new level, simply add a new key.
 */
export const PROGRESS_EXCLUDED_UNITS: Record<string, string[]> = {
  B1: ["U15"],
  B2: [],
};
