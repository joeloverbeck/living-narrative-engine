/**
 * Base error class for actor-related issues.
 *
 * @description Base error class for actor-related issues.
 * @class ActorError
 * @augments {Error}
 */
export class ActorError extends Error {
  /**
   * Creates a new ActorError instance.
   *
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    // This preserves the original stack trace in V8.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
