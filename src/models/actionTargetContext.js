// src/models/actionTargetContext.js

/**
 * @typedef {'entity' | 'direction' | 'none'} ActionTargetType
 * Represents the possible types of targets an action can have.
 */

/**
 * Represents the context of an action's target.
 * Provides a unified way to handle different target types (or lack thereof).
 */
export class ActionTargetContext {
  /** @type {ActionTargetType} The type of the target ('entity', 'direction', 'none'). */
  type;
  /** @type {string | null} The ID of the target entity, if type is 'entity'. */
  entityId;
  /** @type {string | null} The direction string (e.g., 'north'), if type is 'direction'. */
  direction;

  /**
   * Creates an instance of ActionTargetContext.
   *
   * @param {ActionTargetType} type - The type of the target.
   * @param {object} [options] - Additional options based on type.
   * @param {string} [options.entityId] - Required if type is 'entity'. Must be a non-empty string.
   * @param {string} [options.direction] - Required if type is 'direction'. Must be a non-empty string.
   * @throws {Error} If required options for the given type are missing or invalid.
   */
  constructor(type, { entityId = null, direction = null } = {}) {
    if (!['entity', 'direction', 'none'].includes(type)) {
      throw new Error(`ActionTargetContext: Invalid type specified: ${type}`);
    }
    this.type = type;
    this.entityId = entityId;
    this.direction = direction;

    if (
      type === 'entity' &&
      (typeof entityId !== 'string' || !entityId.trim())
    ) {
      throw new Error(
        "ActionTargetContext: entityId (non-empty string) is required for type 'entity'."
      );
    }
    if (
      type === 'direction' &&
      (typeof direction !== 'string' || !direction.trim())
    ) {
      throw new Error(
        "ActionTargetContext: direction (non-empty string) is required for type 'direction'."
      );
    }
    // Ensure properties are null if not applicable to the type
    if (type !== 'entity') this.entityId = null;
    if (type !== 'direction') this.direction = null;
  }

  /** Static factory for creating a context with no target. */
  static noTarget() {
    return new ActionTargetContext('none');
  }

  /**
   * Static factory for creating a context targeting an entity.
   *
   * @param entityId
   */
  static forEntity(entityId) {
    // Validation is handled by the constructor
    return new ActionTargetContext('entity', { entityId });
  }

  /**
   * Static factory for creating a context targeting a direction.
   *
   * @param direction
   */
  static forDirection(direction) {
    // Validation is handled by the constructor
    return new ActionTargetContext('direction', { direction });
  }
}

// Optional: If using default export is preferred style
// export default ActionTargetContext;
