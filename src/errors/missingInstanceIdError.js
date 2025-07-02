/**
 * @file Error thrown when an entity instance within a world file is missing an instanceId.
 */

/**
 * Error thrown when an instance lacks the required instanceId.
 *
 * @class MissingInstanceIdError
 * @augments {Error}
 */
export class MissingInstanceIdError extends Error {
  /**
   * @param {string} worldFile - World file where the instance resides.
   */
  constructor(worldFile) {
    super(`Instance in world file '${worldFile}' is missing an 'instanceId'.`);
    this.name = 'MissingInstanceIdError';
    this.worldFile = worldFile;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MissingInstanceIdError);
    }
  }
}

export default MissingInstanceIdError;
