/**
 * @file Error for the cases when an entity definition hasn't been found.
 * @see src/errors/definitionNotFound.js
 */

/**
 * Error thrown when an entity definition cannot be found in the registry.
 * @class
 * @extends {Error}
 */
export class DefinitionNotFoundError extends Error {
  /**
   * @param {string} definitionId - The ID of the definition that was not found.
   */
  constructor(definitionId) {
    super(`Entity definition not found: '${definitionId}'`);
    this.name = 'DefinitionNotFoundError';
    this.definitionId = definitionId;
  }
}