/**
 * @file Error thrown when a world references an entity instance that does not exist.
 */

/**
 * Error thrown when a world references a non-existent entity instance.
 *
 * @class MissingEntityInstanceError
 * @augments {Error}
 */
export class MissingEntityInstanceError extends Error {
  /**
   * @param {string} instanceId - The missing entity instance ID.
   * @param {string} worldFile - The world filename where the reference occurs.
   */
  constructor(instanceId, worldFile) {
    super(
      `Unknown entity instanceId '${instanceId}' referenced in world '${worldFile}'.`
    );
    this.name = 'MissingEntityInstanceError';
    this.instanceId = instanceId;
    this.worldFile = worldFile;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MissingEntityInstanceError);
    }
  }
}

export default MissingEntityInstanceError;
