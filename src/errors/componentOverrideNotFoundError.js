/**
 * @file Error thrown when attempting to remove a component override that does not exist.
 */

import BaseError from './baseError.js';

/**
 * Error thrown when an entity does not have the requested component override.
 *
 * @class ComponentOverrideNotFoundError
 * @augments {BaseError}
 */
export class ComponentOverrideNotFoundError extends BaseError {
  /**
   * Creates an instance of ComponentOverrideNotFoundError.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The component type that was not found as an override.
   */
  constructor(instanceId, componentTypeId) {
    const message = `Component '${componentTypeId}' not found as an override on entity '${instanceId}'. Nothing to remove at instance level.`;
    const context = { instanceId, componentTypeId };
    super(message, 'COMPONENT_OVERRIDE_NOT_FOUND_ERROR', context);
    this.name = 'ComponentOverrideNotFoundError';
    // Backward compatibility
    this.instanceId = instanceId;
    this.componentTypeId = componentTypeId;
  }

  /**
   * @returns {string} Severity level for component override not found errors
   */
  getSeverity() {
    return 'error';
  }

  /**
   * @returns {boolean} Component override not found errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

export default ComponentOverrideNotFoundError;
