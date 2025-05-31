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
        return "";
    }
    const trimmedText = text.trim();
    if (trimmedText === '') {
        return "";
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

// --- FILE END ---