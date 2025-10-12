/**
 * @file Validates target entities against forbidden component constraints
 * @see ComponentFilteringStage.js for similar validation patterns
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} IEntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @class TargetComponentValidator
 * @description Validates target entities against forbidden component constraints.
 * Supports both legacy single-target and multi-target action formats.
 * Optimized for performance with O(1) component lookups.
 */
export class TargetComponentValidator {
  #logger;
  #entityManager;

  /**
   * Creates a TargetComponentValidator instance
   *
   * @param {object} dependencies - Constructor dependencies
   * @param {ILogger} dependencies.logger - Logger for diagnostic output
   * @param {IEntityManager} dependencies.entityManager - Entity manager for component data
   */
  constructor({ logger, entityManager }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance', 'hasComponent', 'getAllComponentTypesForEntity']
    });
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Validates target entities against forbidden component constraints
   *
   * @param {object} actionDef - Action definition with forbidden_components
   * @param {object} targetEntities - Object with target entities by role
   * @returns {{valid: boolean, reason?: string}} Validation result
   */
  validateTargetComponents(actionDef, targetEntities) {
    const startTime = performance.now();

    // If no forbidden_components defined, validation passes
    if (!actionDef.forbidden_components) {
      return { valid: true };
    }

    // Handle null/undefined target entities gracefully
    if (!targetEntities) {
      this.#logger.debug(
        `No target entities provided for action '${actionDef.id}', validation passes`
      );
      return { valid: true };
    }

    let result;

    // Check if this is legacy single-target format
    if (actionDef.forbidden_components.target &&
        !actionDef.forbidden_components.primary &&
        !actionDef.forbidden_components.secondary &&
        !actionDef.forbidden_components.tertiary) {
      result = this.#validateLegacyFormat(actionDef, targetEntities);
    } else {
      // Multi-target format
      result = this.#validateMultiTargetFormat(actionDef, targetEntities);
    }

    // Log performance metrics in debug mode
    const duration = performance.now() - startTime;
    if (duration > 5) {
      this.#logger.debug(
        `Target validation for action '${actionDef.id}' took ${duration.toFixed(2)}ms`
      );
    }

    return result;
  }

  /**
   * Validates a single entity against forbidden components
   *
   * @param {Entity|object} entity - Entity to validate
   * @param {Array<string>} forbiddenComponents - List of forbidden component IDs
   * @returns {{valid: boolean, component?: string}} Validation result
   */
  validateEntityComponents(entity, forbiddenComponents) {
    // Handle empty forbidden components list
    if (!forbiddenComponents || forbiddenComponents.length === 0) {
      return { valid: true };
    }

    // Handle null/undefined entity
    if (!entity) {
      return { valid: true };
    }

    // Create Set for O(1) lookups
    const forbiddenSet = new Set(forbiddenComponents);

    // Get entity's components
    let entityComponents = [];
    try {
      if (entity.id) {
        // Try to get components from entity manager for most accurate data
        entityComponents = this.#entityManager.getAllComponentTypesForEntity(entity.id) || [];
      }
    } catch (err) {
      this.#logger.warn(
        `Failed to get components for entity validation: ${err.message}`
      );
      // If entity manager fails but entity has components property, use that
      if (entity.components && Array.isArray(entity.components)) {
        entityComponents = entity.components;
      }
    }

    // If no ID but has components property, use that directly
    if (!entity.id && entity.components && Array.isArray(entity.components)) {
      entityComponents = entity.components;
    }

    // Check for forbidden components
    for (const component of entityComponents) {
      if (forbiddenSet.has(component)) {
        return {
          valid: false,
          component
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validates legacy single-target format
   *
   * @private
   * @param {object} actionDef - Action definition
   * @param {object} targetEntities - Target entities
   * @returns {object} Validation result
   */
  #validateLegacyFormat(actionDef, targetEntities) {
    const forbiddenComponents = actionDef.forbidden_components.target;
    const targetEntity = targetEntities.target;

    // No target entity means validation passes
    if (!targetEntity) {
      return { valid: true };
    }

    const validation = this.validateEntityComponents(targetEntity, forbiddenComponents);

    if (!validation.valid) {
      const reason = `Action '${actionDef.id}' cannot be performed: ` +
        `target entity '${targetEntity.id || 'unknown'}' has forbidden component '${validation.component}'`;

      this.#logger.debug(reason);

      return {
        valid: false,
        reason
      };
    }

    return { valid: true };
  }

  /**
   * Validates multi-target format
   *
   * @private
   * @param {object} actionDef - Action definition
   * @param {object} targetEntities - Target entities by role
   * @returns {object} Validation result
   */
  #validateMultiTargetFormat(actionDef, targetEntities) {
    const forbiddenConfig = actionDef.forbidden_components;
    const targetRoles = ['primary', 'secondary', 'tertiary'];

    // Check each target role
    for (const role of targetRoles) {
      const forbiddenComponents = forbiddenConfig[role];
      let targetEntity = targetEntities[role];

      // Skip if no forbidden components for this role
      if (!forbiddenComponents || forbiddenComponents.length === 0) {
        continue;
      }

      // Skip if no entity for this role
      if (!targetEntity) {
        continue;
      }

      // Handle array of targets - validate first target only
      // (Pipeline creates separate action instances for each target)
      if (Array.isArray(targetEntity)) {
        if (targetEntity.length === 0) {
          continue;
        }
        targetEntity = targetEntity[0];
      }

      const validation = this.validateEntityComponents(targetEntity, forbiddenComponents);

      if (!validation.valid) {
        const reason = `Action '${actionDef.id}' cannot be performed: ` +
          `${role} target '${targetEntity.id || 'unknown'}' has forbidden component '${validation.component}'`;

        this.#logger.debug(reason);

        // Short-circuit on first failure
        return {
          valid: false,
          reason
        };
      }
    }

    return { valid: true };
  }
}

export default TargetComponentValidator;