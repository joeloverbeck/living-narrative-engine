/**
 * @file Error template registry for anatomy system errors
 * @description Central registry for creating anatomy errors from templates
 */

import ComponentNotFoundError from './ComponentNotFoundError.js';
import InvalidPropertyError from './InvalidPropertyError.js';
import SocketNotFoundError from './SocketNotFoundError.js';
import RecipeValidationError from './RecipeValidationError.js';

/**
 * Error message template registry
 * Maps error types to their corresponding error classes
 *
 * @type {Object<string, Function>}
 */
const ERROR_TEMPLATES = {
  COMPONENT_NOT_FOUND: ComponentNotFoundError,
  INVALID_PROPERTY: InvalidPropertyError,
  SOCKET_NOT_FOUND: SocketNotFoundError,
  RECIPE_VALIDATION: RecipeValidationError,
};

/**
 * Creates an error from a template
 *
 * @param {string} type - The error template type (e.g., 'COMPONENT_NOT_FOUND')
 * @param {object} data - Data to pass to the error constructor
 * @returns {AnatomyError} The created error instance
 * @throws {Error} If the error type is unknown
 * @example
 * const error = createError('COMPONENT_NOT_FOUND', {
 *   recipeId: 'human_female',
 *   location: { type: 'slot', name: 'torso' },
 *   componentId: 'anatomy:missing_component',
 * });
 */
export function createError(type, data) {
  const ErrorClass = ERROR_TEMPLATES[type];

  if (!ErrorClass) {
    throw new Error(`Unknown error type: ${type}`);
  }

  return new ErrorClass(data);
}

export { ERROR_TEMPLATES };
