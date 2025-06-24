// src/utils/cloneTotals.js

/**
 * @file Utility function to clone totals objects used during content loading.
 */

/**
 * @template T
 * @description Creates a deep clone of the provided totals object.
 * Falls back to JSON methods when `structuredClone` is unavailable.
 * @param {T} totals - Totals object to clone.
 * @returns {T} A deep clone of the totals object.
 */
export function cloneTotals(totals) {
  if (typeof structuredClone === 'function') {
    return structuredClone(totals);
  }
  return JSON.parse(JSON.stringify(totals));
}

export default cloneTotals;
