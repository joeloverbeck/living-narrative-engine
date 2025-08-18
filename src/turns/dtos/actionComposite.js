/**
 * @file Creates the composite of a single available action.
 * @see src/turns/dtos/actionComposite.js
 */

import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../constants/core.js';
import { freeze } from '../../utils/cloneUtils.js';

/**
 * @typedef {object} VisualProperties
 * @property {string} [backgroundColor] - CSS color for button background
 * @property {string} [textColor] - CSS color for button text
 * @property {string} [hoverBackgroundColor] - CSS color for hover background
 * @property {string} [hoverTextColor] - CSS color for hover text
 */

/**
 * @typedef {object} ActionComposite
 * @property {number} index - 1-based position in the list of available actions (1 ≤ index ≤ MAX_ACTIONS_PER_TURN).
 * @property {string} actionId - Canonical identifier for the action (e.g. "core:attack").
 * @property {string} commandString - Raw command a player or AI would issue (e.g. "go out to town").
 * @property {object} params - Arguments for the action (at minimum { targetId?: string }, extensible).
 * @property {string} description - Human-readable, localized summary of what the action does.
 * @property {VisualProperties|null} visual - Visual customization properties, or null if not provided.
 */

/**
 * Create an immutable ActionComposite.
 *
 * @param {number} index - Must be integer between 1 and MAX_ACTIONS_PER_TURN.
 * @param {string} actionId - Non-empty canonical action identifier.
 * @param {string} commandString - Non-empty raw command string.
 * @param {object} params - Non-null object of action parameters.
 * @param {string} description - Non-empty human-readable description.
 * @param {VisualProperties} [visual] - Optional visual customization properties.
 * @returns {ActionComposite}
 * @throws {Error} When any argument is invalid.
 */
export function createActionComposite(
  index,
  actionId,
  commandString,
  params,
  description,
  visual = null
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

  // visual properties validation
  if (visual !== null) {
    validateVisualProperties(visual);
  }

  const composite = {
    index,
    actionId,
    commandString,
    params,
    description,
    visual: visual ? freeze({ ...visual }) : null,
  };
  return freeze(composite);
}

/**
 * Validate visual properties according to the action schema patterns.
 *
 * @param {VisualProperties} visual - Visual properties to validate.
 * @throws {Error} When validation fails.
 */
function validateVisualProperties(visual) {
  if (typeof visual !== 'object' || visual === null || Array.isArray(visual)) {
    throw new Error('Visual properties must be a non-null object');
  }

  // CSS color pattern from action.schema.json (simplified for DTO validation)
  const validColorPattern =
    /^(#([0-9A-Fa-f]{3}){1,2}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/;

  const colorProperties = [
    'backgroundColor',
    'textColor',
    'hoverBackgroundColor',
    'hoverTextColor',
  ];

  for (const [prop, value] of Object.entries(visual)) {
    if (!colorProperties.includes(prop)) {
      console.warn(`Unknown visual property "${prop}" will be ignored`);
      continue;
    }

    if (typeof value !== 'string' || !validColorPattern.test(value)) {
      throw new Error(
        `Invalid ${prop} in visual properties: "${value}". ` +
          `Must be a valid CSS color (hex, rgb, rgba, or named color).`
      );
    }
  }
}

// Export validation function for testing
export { validateVisualProperties };
