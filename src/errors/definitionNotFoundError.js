/**
 * @file Error for the cases when an entity definition hasn't been found.
 * @see src/errors/definitionNotFound.js
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an entity definition cannot be found in the registry.
 *
 * @class
 * @augments {BaseError}
 */
export class DefinitionNotFoundError extends BaseError {
  /**
   * Creates an instance of DefinitionNotFoundError.
   *
   * @param {string} definitionId - The ID of the definition that was not found.
   */
  constructor(definitionId) {
    const context = { definitionId };
    super(
      `Entity definition not found: '${definitionId}'`,
      'DEFINITION_NOT_FOUND_ERROR',
      context
    );
    this.name = 'DefinitionNotFoundError';
    // Backward compatibility
    this.definitionId = definitionId;
  }

  /**
   * @returns {string} Severity level for definition not found errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Definition not found errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
