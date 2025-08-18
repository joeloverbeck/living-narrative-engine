/**
 * @file Visual properties validation utility for actions
 */

import {
  validateColor,
  getColorErrorMessage,
} from '../utils/colorValidation.js';

/**
 * List of supported visual color properties
 */
const COLOR_PROPERTIES = [
  'backgroundColor',
  'textColor',
  'hoverBackgroundColor',
  'hoverTextColor',
];

/**
 * Validates visual properties for actions
 *
 * @param {object} visual - Visual properties object
 * @param {string} actionId - Action ID for error reporting
 * @returns {object} Validated visual properties
 * @throws {Error} If visual properties are invalid
 */
export function validateVisualProperties(visual, actionId) {
  if (!visual || typeof visual !== 'object') {
    throw new Error(
      `Invalid visual properties for action ${actionId}: expected object`
    );
  }

  const validated = {};
  const errors = [];

  // Validate each color property if present
  for (const prop of COLOR_PROPERTIES) {
    if (visual[prop] !== undefined) {
      if (!validateColor(visual[prop])) {
        errors.push(`${prop}: ${getColorErrorMessage(visual[prop])}`);
      } else {
        validated[prop] = visual[prop];
      }
    }
  }

  // Check for unknown properties
  const unknownProps = Object.keys(visual).filter(
    (prop) => !COLOR_PROPERTIES.includes(prop)
  );

  if (unknownProps.length > 0) {
    errors.push(`Unknown visual properties: ${unknownProps.join(', ')}`);
  }

  // Throw if any errors found
  if (errors.length > 0) {
    throw new Error(
      `Invalid visual properties for action ${actionId}:\n${errors.join('\n')}`
    );
  }

  return validated;
}

/**
 * Checks if an object has visual properties
 *
 * @param {object} data - Object to check
 * @returns {boolean} True if has visual properties
 */
export function hasVisualProperties(data) {
  return !!(
    data &&
    typeof data === 'object' &&
    data.visual &&
    typeof data.visual === 'object' &&
    Object.keys(data.visual).length > 0
  );
}

/**
 * Counts actions with visual properties
 *
 * @param {Array} actions - Array of action definitions
 * @returns {number} Count of actions with visual properties
 */
export function countActionsWithVisualProperties(actions) {
  if (!Array.isArray(actions)) {
    return 0;
  }
  return actions.filter(hasVisualProperties).length;
}
