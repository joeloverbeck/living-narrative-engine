/**
 * @file Error for duplicate entity creation attempts.
 */

/**
 * Error thrown when attempting to create an entity with an ID that already exists.
 *
 * @class
 * @augments {Error}
 */
export class DuplicateEntityError extends Error {
  /**
   * @param {string} entityId - The ID of the entity that already exists.
   * @param {string} [message] - Optional custom error message.
   */
  constructor(entityId, message = null) {
    const defaultMessage = `Entity with ID '${entityId}' already exists.`;
    super(message || defaultMessage);
    this.name = 'DuplicateEntityError';
    this.entityId = entityId;
  }
} 