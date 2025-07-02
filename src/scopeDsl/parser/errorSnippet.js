/**
 * @file errorSnippet.js
 * @description Utility for generating formatted error snippets used in parser
 *   diagnostics. Provides a helper function that extracts the relevant line
 *   from the original source and places a caret under the offending column.
 */

/**
 * Generates a code snippet with a pointer for error messages.
 *
 * @param {string} input - The full source code string.
 * @param {number} line - The line number (1-based).
 * @param {number} column - The column number (1-based).
 * @returns {string} The formatted code snippet.
 */
export function generateErrorSnippet(input, line, column) {
  const lineContent = input.split('\n')[line - 1] || '';
  return `${lineContent}\n${' '.repeat(column - 1)}^`;
}

export default generateErrorSnippet;
