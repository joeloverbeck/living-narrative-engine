/**
 * @file TargetRequiredComponentsValidator.js
 * Validates that target entities have required components
 * @see TargetComponentValidator.js (forbidden components pattern)
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  ALL_MULTI_TARGET_ROLES,
  LEGACY_TARGET_ROLE,
} from '../pipeline/TargetRoleRegistry.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class TargetRequiredComponentsValidator
 * @description Validates target entities have required components.
 * Supports both legacy single-target and multi-target formats.
 */
class TargetRequiredComponentsValidator {
  #logger;

  /**
   * Creates a TargetRequiredComponentsValidator instance
   *
   * @param {object} dependencies - Constructor dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  /**
   * Validates that target entities have required components.
   *
   * @param {object} actionDef - Action definition with required_components
   * @param {object} targetEntities - Resolved target entities map
   * @returns {{valid: boolean, reason?: string}} Validation result
   * @example
   * // Action with primary target requirements
   * const actionDef = {
   *   required_components: {
   *     actor: ["positioning:closeness"],
   *     primary: ["positioning:sitting_on", "positioning:closeness"]
   *   }
   * };
   * const targetEntities = {
   *   primary: { id: "npc1", components: { "positioning:sitting_on": {}, "positioning:closeness": {} } }
   * };
   * const result = validator.validateTargetRequirements(actionDef, targetEntities);
   * // { valid: true }
   */
  validateTargetRequirements(actionDef, targetEntities) {
    // No required_components defined - always valid
    if (!actionDef.required_components) {
      return { valid: true };
    }

    const requirements = actionDef.required_components;

    // Check legacy single-target format
    if (
      requirements[LEGACY_TARGET_ROLE] &&
      requirements[LEGACY_TARGET_ROLE].length > 0
    ) {
      const result = this.#validateTargetRole(
        LEGACY_TARGET_ROLE,
        requirements[LEGACY_TARGET_ROLE],
        targetEntities
      );
      if (!result.valid) {
        return result;
      }
    }

    // Check multi-target format
    for (const role of ALL_MULTI_TARGET_ROLES) {
      if (requirements[role] && requirements[role].length > 0) {
        const result = this.#validateTargetRole(
          role,
          requirements[role],
          targetEntities
        );
        if (!result.valid) {
          return result;
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validates a specific target role has required components.
   *
   * @private
   * @param {string} role - Target role (target, primary, secondary, tertiary)
   * @param {string[]} requiredComponents - Required component IDs
   * @param {object} targetEntities - Resolved target entities map
   * @returns {{valid: boolean, reason?: string}} Validation result with optional failure reason
   */
  #validateTargetRole(role, requiredComponents, targetEntities) {
    // Guard: Check if targetEntities itself is null/undefined first
    if (targetEntities === null || targetEntities === undefined) {
      this.#logger.debug(`No target entities provided for ${role} validation`);
      return {
        valid: false,
        reason: `No target entities available for ${role} validation`,
      };
    }

    // No target entity for this role
    if (!targetEntities[role]) {
      this.#logger.debug(
        `No ${role} target entity found for required components validation`
      );
      return {
        valid: false,
        reason: `No ${role} target available for validation`,
      };
    }

    const targetCandidates = Array.isArray(targetEntities[role])
      ? targetEntities[role]
      : [targetEntities[role]];

    if (targetCandidates.length === 0) {
      this.#logger.debug(
        `Empty ${role} target array for required components validation`
      );
      return {
        valid: false,
        reason: `No ${role} target available for validation`,
      };
    }

    let hasValidCandidate = false;
    let lastFailureReason = `No ${role} target available for validation`;

    for (const candidate of targetCandidates) {
      if (!candidate) {
        this.#logger.debug(
          `Invalid ${role} target candidate encountered during required components validation`
        );
        lastFailureReason = `No ${role} target available for validation`;
        continue;
      }

      // Extract the actual entity - it may be nested under 'entity' property
      // or it may be the entity object directly. If the wrapper explicitly
      // exposes an `entity` property but it resolves to a falsy value, treat
      // it as missing so we emit a targeted debug message instead of trying to
      // validate the wrapper object itself.
      const candidateHasEntityProperty =
        candidate !== null &&
        typeof candidate === 'object' &&
        Object.prototype.hasOwnProperty.call(candidate, 'entity');
      const targetEntity = candidateHasEntityProperty
        ? candidate.entity
        : candidate;

      if (!targetEntity) {
        this.#logger.debug(
          `Resolved ${role} target candidate lacks entity reference`
        );
        lastFailureReason = `No ${role} target available for validation`;
        continue;
      }

      const hasComponent = (componentId) => {
        if (targetEntity.components && targetEntity.components[componentId]) {
          return true;
        }
        if (typeof targetEntity.hasComponent === 'function') {
          try {
            return targetEntity.hasComponent(componentId);
          } catch (error) {
            this.#logger.debug(
              `Error checking hasComponent('${componentId}') on ${role} target ${targetEntity.id || 'unknown'}: ${error.message}`
            );
          }
        }
        return false;
      };

      const missingComponentId = requiredComponents.find(
        (componentId) => !hasComponent(componentId)
      );

      if (missingComponentId) {
        const entityId = targetEntity.id || 'unknown';
        this.#logger.debug(
          `Target entity ${entityId} missing required component: ${missingComponentId}`
        );
        lastFailureReason = `Target (${role}) must have component: ${missingComponentId}`;
        continue;
      }

      hasValidCandidate = true;
      break;
    }

    if (hasValidCandidate) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: lastFailureReason,
    };
  }
}

export default TargetRequiredComponentsValidator;
