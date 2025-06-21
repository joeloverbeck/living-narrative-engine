/**
 * @file Utility functions for deriving rule IDs from filenames.
 */

import { extractBaseIdFromFilename } from './idUtils.js';

/**
 * Derives the base rule ID from a filename by delegating to
 * {@link extractBaseIdFromFilename} with rule-specific suffixes.
 *
 * @param {string} filename - The filename to parse.
 * @returns {string} The derived base ID, or an empty string if it cannot be determined.
 */
export function deriveBaseRuleIdFromFilename(filename) {
  return extractBaseIdFromFilename(filename, [
    '.rule',
    '.rule.json',
    '.rule.yml',
    '.rule.yaml',
  ]);
}
