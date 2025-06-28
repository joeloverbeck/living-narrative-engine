/**
 * @file Error class for repository consistency failures.
 */

/**
 * Error thrown when the entity repository reports success retrieving
 * an entity but fails to remove it.
 *
 * @class RepositoryConsistencyError
 * @augments {Error}
 */
export class RepositoryConsistencyError extends Error {
  /**
   * @param {string} instanceId - The ID of the entity instance that could not be removed.
   * @param {string} [message] - Optional custom error message.
   */
  constructor(instanceId, message = null) {
    const defaultMessage = `Internal error: Failed to remove entity '${instanceId}' from entity repository despite entity being found.`;
    super(message || defaultMessage);
    this.name = 'RepositoryConsistencyError';
    this.instanceId = instanceId;
  }
}

export default RepositoryConsistencyError;
