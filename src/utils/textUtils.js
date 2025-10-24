// src/utils/textUtils.js
// --- FILE START ---

/**
 * @file Utility functions for text manipulation.
 */

/**
 * Ensures that a given string ends with a terminal punctuation mark ('.', '!', '?').
 * If the string is null, undefined, or empty (after trimming), it returns an empty string.
 * If the string already ends with one of the specified punctuation marks, it's returned as is (after trimming).
 * Otherwise, a period ('.') is appended to the trimmed string.
 *
 * @param {string | null | undefined} text - The input string to process.
 * @returns {string} The processed string, ensuring terminal punctuation or an empty string.
 */
export function ensureTerminalPunctuation(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const trimmedText = text.trim();
  if (trimmedText === '') {
    return '';
  }
  // Regex to check if the string ends with '.', '!', or '?'
  if (/[.!?]$/.test(trimmedText)) {
    return trimmedText;
  }
  return trimmedText + '.';
}

/**
 * Converts a snake_case string to camelCase.
 * Example: "system_prompt" -> "systemPrompt"
 * Handles empty, null, or undefined input by returning an empty string.
 * Does not transform already camelCased strings if they don't contain underscores.
 *
 * @param {string} str - The string to convert.
 * @returns {string} The camelCased string. Returns an empty string if the input is falsy.
 */
export function snakeToCamel(str) {
  if (!str) {
    return '';
  }
  // Ensure str is a string before calling replace
  if (typeof str !== 'string') {
    // Optionally, log a warning or throw an error if the input type is unexpected
    // console.warn(`snakeToCamel: Expected a string, but received type ${typeof str}. Returning empty string.`);
    return '';
  }
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Checks that a string is non-empty after trimming.
 *
 * @param {any} str - Value to evaluate.
 * @returns {boolean} True if `str` is a non-blank string.
 */
export function isNonBlankString(str) {
  return typeof str === 'string' && Boolean(str.trim());
}

/**
 * Pads a number with leading zeros to at least two digits.
 *
 * @param {number} num - Number to pad.
 * @returns {string} Padded string representation.
 */
function padTwo(num) {
  const str = String(num);
  return str.length < 2 ? '0'.repeat(2 - str.length) + str : str;
}

/**
 * Formats a total number of seconds into a HH:MM:SS string.
 *
 * @param {number} totalSeconds - Seconds to format.
 * @returns {string} Formatted time string or 'N/A' if input invalid.
 */
export function formatPlaytime(totalSeconds) {
  if (
    typeof totalSeconds !== 'number' ||
    !Number.isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return 'N/A';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return padTwo(hours) + ':' + padTwo(minutes) + ':' + padTwo(seconds);
}

/**
 * Formats an ISO timestamp string to a locale-specific string.
 *
 * @param {string} timestamp - ISO timestamp to format.
 * @param {string} [fallback] - Text to return on parse failure.
 * @returns {string} Formatted timestamp or fallback on error.
 */
export function formatTimestamp(timestamp, fallback = 'Invalid Date') {
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return fallback;
    }
    return date.toLocaleString();
  } catch {
    return fallback;
  }
}

// --- FILE END ---
