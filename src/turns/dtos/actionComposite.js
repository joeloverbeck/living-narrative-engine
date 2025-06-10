/**
 * @file Creates the composite of a single available action.
 * @see src/turns/dtos/actionComposite.js
 */

import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';

/**
 * @typedef {Object} ActionComposite
 * @property {number} index - 1-based position in the list of available actions (1 ≤ index ≤ MAX_ACTIONS_PER_TURN).
 * @property {string} actionId - Canonical identifier for the action (e.g. "core:attack").
 * @property {string} commandString - Raw command a player or AI would issue (e.g. "go out to town").
 * @property {Object} params - Arguments for the action (at minimum { targetId?: string }, extensible).
 * @property {string} description - Human-readable, localized summary of what the action does.
 */

/**
 * Create an immutable ActionComposite.
 *
 * @param {number} index - Must be integer between 1 and MAX_ACTIONS_PER_TURN.
 * @param {string} actionId - Non-empty canonical action identifier.
 * @param {string} commandString - Non-empty raw command string.
 * @param {Object} params - Non-null object of action parameters.
 * @param {string} description - Non-empty human-readable description.
 * @returns {ActionComposite}
 * @throws {Error} When any argument is invalid.
 */
export function createActionComposite(
  index,
  actionId,
  commandString,
  params,
  description
) {
  // index validation
  if (
    !Number.isInteger(index) ||
    index < 1 ||
    index > MAX_AVAILABLE_ACTIONS_PER_TURN
  ) {
    throw new Error(
      `"index" must be an integer between 1 and ${MAX_AVAILABLE_ACTIONS_PER_TURN}, received ${index}`
    );
  }

  // string fields validation
  const fields = { actionId, commandString, description };
  for (const [name, val] of Object.entries(fields)) {
    if (typeof val !== 'string' || !val.trim()) {
      throw new Error(`"${name}" must be a non-empty string`);
    }
  }

  // params validation
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new Error(`"params" must be a non-null object`);
  }

  const composite = { index, actionId, commandString, params, description };
  return Object.freeze(composite);
}
