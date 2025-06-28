/**
 * @file Error class for invalid actor entities.
 */

/**
 * Error thrown when an actor entity is missing required properties or otherwise invalid.
 *
 * @class InvalidActorEntityError
 * @augments {Error}
 */
export class InvalidActorEntityError extends Error {
  /**
   * Creates a new InvalidActorEntityError instance.
   *
   * @param {string} [message] - Optional custom message.
   */
  constructor(message = 'Invalid actor entity') {
    super(message);
    this.name = 'InvalidActorEntityError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidActorEntityError);
    }
  }
}

export default InvalidActorEntityError;
