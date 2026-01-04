/**
 * @file Validates target entities against forbidden component constraints
 * @see ComponentFilteringStage.js for similar validation patterns
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ALL_TARGET_ROLES } from '../pipeline/TargetRoleRegistry.js';

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
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: [
        'getEntityInstance',
        'hasComponent',
        'getAllComponentTypesForEntity',
      ],
    });
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * @typedef {Object} TargetComponentValidationResult
   * @property {boolean} valid
   * @property {string} [reason]
   * @property {object} [filteredTargets]
   * @property {Array<{role: string, targetId: string|null, component: string|null}>} [removedTargets]
   * @property {Object} [details] - Only present when includeDetails: true
   * @property {Array<{entityId: string, forbiddenComponentsPresent: string[]}>} [details.rejectedEntities]
   * @property {string} [details.targetRole]
   */

  /**
   * Validates target entities against forbidden component constraints
   *
   * @param {object} actionDef - Action definition with forbidden_components
   * @param {object} targetEntities - Object with target entities by role
   * @param {Object} [options] - Validation options
   * @param {boolean} [options.includeDetails=false] - Include detailed rejection info
   * @returns {TargetComponentValidationResult} Validation result
   */
  validateTargetComponents(actionDef, targetEntities, options = {}) {
    const startTime = performance.now();
    const { includeDetails = false } = options;

    // If no forbidden_components defined, validation passes
    if (!actionDef.forbidden_components) {
      return includeDetails
        ? { valid: true, details: { rejectedEntities: [] } }
        : { valid: true };
    }

    // Handle null/undefined target entities gracefully
    if (!targetEntities) {
      this.#logger.debug(
        `No target entities provided for action '${actionDef.id}', validation passes`
      );
      return includeDetails
        ? { valid: true, details: { rejectedEntities: [] } }
        : { valid: true };
    }

    let result;

    // Check if this uses NEW multi-target roles (primary/secondary/tertiary)
    const hasMultiTargetRoles =
      actionDef.forbidden_components.primary ||
      actionDef.forbidden_components.secondary ||
      actionDef.forbidden_components.tertiary;

    // Check if it has BOTH actor and target forbidden components
    const hasActorAndTarget =
      actionDef.forbidden_components.actor &&
      actionDef.forbidden_components.target;

    if (hasMultiTargetRoles || hasActorAndTarget) {
      // Use multi-target validation (handles both actor and all target roles)
      result = this.#validateMultiTargetFormat(
        actionDef,
        targetEntities,
        includeDetails
      );
    } else if (actionDef.forbidden_components.target) {
      // Pure legacy single-target format (ONLY has .target, no .actor)
      result = this.#validateLegacyFormat(
        actionDef,
        targetEntities,
        includeDetails
      );
    } else {
      // No target validation needed (only actor forbidden components or none)
      return includeDetails
        ? { valid: true, details: { rejectedEntities: [] } }
        : { valid: true };
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
   * @param {Object} [options] - Validation options
   * @param {boolean} [options.includeAllForbidden=false] - If true, collect all forbidden components instead of stopping at first
   * @returns {{valid: boolean, component?: string, forbiddenComponentsPresent?: string[]}} Validation result
   */
  validateEntityComponents(entity, forbiddenComponents, options = {}) {
    const { includeAllForbidden = false } = options;

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
        entityComponents =
          this.#entityManager.getAllComponentTypesForEntity(entity.id) || [];
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
    if (includeAllForbidden) {
      // Collect ALL forbidden components
      const forbiddenFound = [];
      for (const component of entityComponents) {
        if (forbiddenSet.has(component)) {
          forbiddenFound.push(component);
        }
      }
      if (forbiddenFound.length > 0) {
        return {
          valid: false,
          component: forbiddenFound[0], // Backward compat
          forbiddenComponentsPresent: forbiddenFound,
        };
      }
    } else {
      // Original behavior: return on first match
      for (const component of entityComponents) {
        if (forbiddenSet.has(component)) {
          return {
            valid: false,
            component,
          };
        }
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
   * @param {boolean} includeDetails - Whether to include detailed rejection info
   * @returns {object} Validation result
   */
  #validateLegacyFormat(actionDef, targetEntities, includeDetails) {
    const forbiddenComponents = actionDef.forbidden_components.target;
    const targetEntity = targetEntities.target;
    const filteredTargets = { ...targetEntities };
    const removedTargets = [];

    // No target entity means validation passes
    if (!targetEntity) {
      return includeDetails
        ? { valid: true, details: { rejectedEntities: [], targetRole: 'target' } }
        : { valid: true };
    }

    const validation = this.validateEntityComponents(
      targetEntity,
      forbiddenComponents,
      { includeAllForbidden: includeDetails }
    );

    if (!validation.valid) {
      const reason =
        `Action '${actionDef.id}' cannot be performed: ` +
        `target entity '${targetEntity.id || 'unknown'}' has forbidden component '${validation.component}'`;

      this.#logger.debug(reason);

      filteredTargets.target = null;
      removedTargets.push({
        role: 'target',
        targetId: targetEntity.id || null,
        component: validation.component || null,
      });

      const result = {
        valid: false,
        reason,
        filteredTargets,
        removedTargets,
      };

      if (includeDetails) {
        result.details = {
          targetRole: 'target',
          rejectedEntities: [
            {
              entityId: targetEntity.id || 'unknown',
              forbiddenComponentsPresent:
                validation.forbiddenComponentsPresent || [validation.component],
            },
          ],
        };
      }

      return result;
    }

    return includeDetails
      ? { valid: true, details: { rejectedEntities: [], targetRole: 'target' } }
      : { valid: true };
  }

  /**
   * Validates multi-target format
   *
   * @private
   * @param {object} actionDef - Action definition
   * @param {object} targetEntities - Target entities by role
   * @param {boolean} includeDetails - Whether to include detailed rejection info
   * @returns {object} Validation result
   */
  #validateMultiTargetFormat(actionDef, targetEntities, includeDetails) {
    const forbiddenConfig = actionDef.forbidden_components;
    const targetRoles = ALL_TARGET_ROLES;
    const filteredTargets = { ...targetEntities };
    const removedTargets = [];
    const rejectedEntities = []; // For detailed output
    let hasRemovals = false;
    let firstFailureReason = null;
    let firstFailureRole = null;

    // Check each target role
    for (const role of targetRoles) {
      const forbiddenComponents = forbiddenConfig[role];
      let rawTarget = targetEntities[role];

      // Skip if no forbidden components for this role
      if (!forbiddenComponents || forbiddenComponents.length === 0) {
        continue;
      }

      // LEGACY ACTION COMPATIBILITY FIX:
      // Legacy actions populate resolvedTargets.primary, not resolvedTargets.target
      // If checking 'target' role but it's empty, check 'primary' as fallback
      if (role === 'target' && !rawTarget && targetEntities.primary) {
        rawTarget = targetEntities.primary;
        this.#logger.debug(
          `Action '${actionDef.id}': Using primary targets for legacy 'target' role validation`
        );
      }

      // Skip if no entity for this role (after legacy fallback)
      if (!rawTarget) {
        continue;
      }

      const targetCandidates = Array.isArray(rawTarget)
        ? rawTarget
        : [rawTarget];

      if (targetCandidates.length === 0) {
        continue;
      }

      const validCandidates = [];

      let lastInvalidReason = null;

      for (const candidate of targetCandidates) {
        const entity = candidate && (candidate.entity || candidate);

        if (!entity) {
          continue;
        }

        const validation = this.validateEntityComponents(
          entity,
          forbiddenComponents,
          { includeAllForbidden: includeDetails }
        );

        if (!validation.valid) {
          hasRemovals = true;
          const reason =
            `Action '${actionDef.id}' cannot be performed: ` +
            `${role} target '${entity.id || 'unknown'}' has forbidden component '${validation.component}'`;

          this.#logger.debug(reason);
          lastInvalidReason = reason;
          removedTargets.push({
            role,
            targetId: entity.id || null,
            component: validation.component || null,
          });

          // Collect detailed rejection info
          if (includeDetails) {
            rejectedEntities.push({
              entityId: entity.id || 'unknown',
              forbiddenComponentsPresent:
                validation.forbiddenComponentsPresent || [validation.component],
            });
          }

          continue;
        }

        validCandidates.push(candidate);
      }

      if (Array.isArray(rawTarget)) {
        filteredTargets[role] = validCandidates;
      } else {
        filteredTargets[role] =
          validCandidates.length > 0 ? validCandidates[0] : null;
      }

      if (validCandidates.length === 0 && targetCandidates.length > 0) {
        if (!firstFailureReason) {
          firstFailureReason =
            lastInvalidReason ||
            `Action '${actionDef.id}' cannot be performed: ${role} target lacks eligible candidates after forbidden component filtering`;
          firstFailureRole = role;
        }
      }
    }

    if (hasRemovals && removedTargets.length > 0) {
      const result = {
        valid: !firstFailureReason,
        reason: firstFailureReason || undefined,
        filteredTargets,
        removedTargets,
      };

      if (includeDetails) {
        result.details = {
          targetRole: firstFailureRole || removedTargets[0]?.role || null,
          rejectedEntities,
        };
      }

      return result;
    }

    const result = {
      valid: !firstFailureReason,
      reason: firstFailureReason || undefined,
    };

    if (includeDetails) {
      result.details = {
        targetRole: firstFailureRole || null,
        rejectedEntities,
      };
    }

    return result;
  }
}

export default TargetComponentValidator;
