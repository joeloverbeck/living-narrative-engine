/**
 * @module placeholderParsing
 * @description Utilities for parsing placeholder syntax.
 */

/**
 * Parses a placeholder key and determines whether it is optional.
 *
 * @param {string} key - Raw placeholder key.
 * @returns {{ key: string, optional: boolean }} Parsed key and optional flag.
 */
export function parsePlaceholderKey(key) {
  const trimmed = key.trim();
  const optional = trimmed.endsWith('?');
  return { key: optional ? trimmed.slice(0, -1) : trimmed, optional };
}
