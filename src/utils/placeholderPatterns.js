/**
 * @module placeholderPatterns
 * @description Regular expressions and helper functions for placeholder parsing.
 */

/**
 * Regex to find placeholders like {path.to.value} within a string.
 * Group 1 captures the path without braces.
 * The global flag ensures all occurrences are matched.
 *
 * @type {RegExp}
 */
export const PLACEHOLDER_FIND_REGEX = /{\s*([^}\s]+)\s*}/g;

/**
 * Regex to check if an entire string is only a placeholder.
 * Group 1 captures the path within the braces.
 *
 * @type {RegExp}
 */
export const FULL_STRING_PLACEHOLDER_REGEX = /^{\s*([^}\s]+)\s*}$/;

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
