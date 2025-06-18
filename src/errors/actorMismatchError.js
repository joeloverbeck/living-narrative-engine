import { ActorError } from './actorError';

/**
 * Error thrown when an operation expects a specific actor but receives a different one,
 * or when an actor context is missing entirely.
 *
 * @description Error thrown when an operation expects a specific actor but receives a different one,
 * or when an actor context is missing entirely.
 * @class ActorMismatchError
 * @augments {ActorError}
 */
export class ActorMismatchError extends ActorError {
  /**
   * Creates a new ActorMismatchError instance.
   *
   * @param {string} message - The error message.
   * @param {object} [context] - Additional context for debugging.
   * @param {string|null} [context.expectedActorId] - The ID of the actor that was expected.
   * @param {string|null} [context.actualActorId] - The ID of the actor that was provided.
   * @param {string} [context.operation] - The name of the operation where the mismatch occurred.
   */
  constructor(
    message,
    { expectedActorId = null, actualActorId = null, operation = 'N/A' } = {}
  ) {
    super(message);
    this.name = 'ActorMismatchError';
    /** @type {string|null} */
    this.expectedActorId = expectedActorId;
    /** @type {string|null} */
    this.actualActorId = actualActorId;
    /** @type {string} */
    this.operation = operation;
  }
}
