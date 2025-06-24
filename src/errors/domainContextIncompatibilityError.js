/**
 * @file Custom error for domain/context incompatibility. Carries detailed context about the validation failure.
 * @see src/errors/domainContextIncompatibilityError.js
 */

/**
 * Custom error for domain/context incompatibility. Carries detailed context about the validation failure.
 * @export
 */
export class DomainContextIncompatibilityError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} details - The structured details of the error.
   * @param {string} details.actionId
   * @param {string} details.actionName
   * @param {string} details.actorId
   * @param {string|null} details.targetId
   * @param {string} details.expectedScope
   * @param {string} details.contextType
   */
  constructor(message, details) {
    super(message);
    this.name = 'DomainContextIncompatibilityError';
    this.details = details;
    this.actionId = details.actionId;
    this.actionName = details.actionName;
    this.actorId = details.actorId;
    this.targetId = details.targetId;
    this.expectedScope = details.expectedScope;
    this.contextType = details.contextType;
  }
}
