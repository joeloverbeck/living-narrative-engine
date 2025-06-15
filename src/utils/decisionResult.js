/**
 * @module decisionResult
 */

import { freeze } from './objectUtils.js';

/**
 * @typedef {object} DecisionResult
 * @property {'success'} kind - Indicates the decision was successful.
 * @property {*} action - The action payload for the turn.
 * @property {{speech: string|null, thoughts: string|null, notes: string|null}} extractedData
 *   - Metadata extracted from the decision (speech, thoughts, notes).
 */

/**
 * Builds a normalized turn decision envelope and freezes it to ensure immutability.
 *
 * @param {*} action - The action object or identifier for this turn decision.
 * @param {object} [meta] - Optional metadata.
 * @param {string} [meta.speech]   - Speech text, if any.
 * @param {string} [meta.thoughts] - Thoughts text, if any.
 * @param {string} [meta.notes]    - Notes text, if any.
 * @returns {Readonly<DecisionResult>} A frozen decision result envelope.
 */
export function buildDecisionResult(action, meta = {}) {
  const extractedData = {
    speech: meta.speech ?? null,
    thoughts: meta.thoughts ?? null,
    notes: meta.notes ?? null,
  };

  // Freeze nested data first
  freeze(extractedData);

  const result = {
    kind: 'success',
    action,
    extractedData,
  };

  // Then freeze the entire envelope
  return freeze(result);
}
