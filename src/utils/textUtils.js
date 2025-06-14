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
 * Checks if the provided value is a non-empty string after trimming.
 *
 * @param {*} value - Value to validate.
 * @returns {boolean} True if value is a non-empty string, otherwise false.
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
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
    Number.isNaN(totalSeconds) ||
    totalSeconds < 0
  ) {
    return 'N/A';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0')
  );
}

// --- FILE END ---
