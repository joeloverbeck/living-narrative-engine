/**
 * @file Error class for invalid action definitions.
 */

/**
 * Error thrown when an action definition is missing required properties or otherwise invalid.
 *
 * @class InvalidActionDefinitionError
 * @augments {Error}
 */
export class InvalidActionDefinitionError extends Error {
  /**
   * @param {string} [message] - Optional custom message.
   */
  constructor(message = 'Invalid actionDefinition') {
    super(message);
    this.name = 'InvalidActionDefinitionError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidActionDefinitionError);
    }
  }
}

export default InvalidActionDefinitionError;
