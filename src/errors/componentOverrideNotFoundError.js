/**
 * @file Error thrown when attempting to remove a component override that does not exist.
 */

/**
 * Error thrown when an entity does not have the requested component override.
 *
 * @class ComponentOverrideNotFoundError
 * @augments {Error}
 */
export class ComponentOverrideNotFoundError extends Error {
  /**
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The component type that was not found as an override.
   */
  constructor(instanceId, componentTypeId) {
    super(
      `Component '${componentTypeId}' not found as an override on entity '${instanceId}'. Nothing to remove at instance level.`
    );
    this.name = 'ComponentOverrideNotFoundError';
    this.instanceId = instanceId;
    this.componentTypeId = componentTypeId;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ComponentOverrideNotFoundError);
    }
  }
}

export default ComponentOverrideNotFoundError;
