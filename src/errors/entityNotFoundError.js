/**
 * @file Error for the cases when an entity hasn't been found.
 * @see src/errors/entityNotFound.js
 */

/**
 * Error thrown when an entity instance cannot be found in the manager.
 * @class
 * @extends {Error}
 */
export class EntityNotFoundError extends Error {
  /**
   * @param {string} instanceId - The ID of the instance that was not found.
   */
  constructor(instanceId) {
    super(`Entity instance not found: '${instanceId}'`);
    this.name = 'EntityNotFoundError';
    this.instanceId = instanceId;
  }
}