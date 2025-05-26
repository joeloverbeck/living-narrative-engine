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

// --- FILE END ---