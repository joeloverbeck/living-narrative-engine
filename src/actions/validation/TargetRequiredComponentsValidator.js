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
 * @typedef {object} TargetRequiredValidationResult
 * @property {boolean} valid
 * @property {string} [reason]
 * @property {object} [details] - Only present when includeDetails: true
 * @property {Array<{entityId: string, requiredComponentsMissing: string[]}>} [details.rejectedEntities]
 * @property {string} [details.targetRole]
 */

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
   * @param {object} [options] - Validation options
   * @param {boolean} [options.includeDetails] - Include detailed rejection info
   * @returns {TargetRequiredValidationResult} Validation result
   * @example
   * // Action with primary target requirements
   * const actionDef = {
   *   required_components: {
   *     actor: ["personal-space-states:closeness"],
   *     primary: ["sitting-states:sitting_on", "personal-space-states:closeness"]
   *   }
   * };
   * const targetEntities = {
   *   primary: { id: "npc1", components: { "sitting-states:sitting_on": {}, "personal-space-states:closeness": {} } }
   * };
   * const result = validator.validateTargetRequirements(actionDef, targetEntities);
   * // { valid: true }
   */
  validateTargetRequirements(actionDef, targetEntities, options = {}) {
    const { includeDetails = false } = options;

    // No required_components defined - always valid
    if (!actionDef.required_components) {
      return includeDetails
        ? { valid: true, details: { rejectedEntities: [] } }
        : { valid: true };
    }

    const requirements = actionDef.required_components;
    const allRejectedEntities = [];
    let firstFailureResult = null;

    // Check legacy single-target format
    if (
      requirements[LEGACY_TARGET_ROLE] &&
      requirements[LEGACY_TARGET_ROLE].length > 0
    ) {
      const result = this.#validateTargetRole(
        LEGACY_TARGET_ROLE,
        requirements[LEGACY_TARGET_ROLE],
        targetEntities,
        includeDetails
      );
      if (!result.valid) {
        if (!includeDetails) {
          return result;
        }
        if (!firstFailureResult) {
          firstFailureResult = result;
        }
        if (result.details?.rejectedEntities) {
          allRejectedEntities.push(...result.details.rejectedEntities);
        }
      }
    }

    // Check multi-target format
    for (const role of ALL_MULTI_TARGET_ROLES) {
      if (requirements[role] && requirements[role].length > 0) {
        const result = this.#validateTargetRole(
          role,
          requirements[role],
          targetEntities,
          includeDetails
        );
        if (!result.valid) {
          if (!includeDetails) {
            return result;
          }
          if (!firstFailureResult) {
            firstFailureResult = result;
          }
          if (result.details?.rejectedEntities) {
            allRejectedEntities.push(...result.details.rejectedEntities);
          }
        }
      }
    }

    // Return with details if requested
    if (includeDetails) {
      if (firstFailureResult) {
        return {
          valid: false,
          reason: firstFailureResult.reason,
          details: {
            targetRole: firstFailureResult.details?.targetRole,
            rejectedEntities: allRejectedEntities,
          },
        };
      }
      return { valid: true, details: { rejectedEntities: [] } };
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
   * @param {boolean} includeDetails - Whether to include detailed rejection info
   * @returns {{valid: boolean, reason?: string, details?: object}} Validation result with optional failure reason and details
   */
  #validateTargetRole(role, requiredComponents, targetEntities, includeDetails) {
    const rejectedEntities = [];

    // Guard: Check if targetEntities itself is null/undefined first
    if (targetEntities === null || targetEntities === undefined) {
      this.#logger.debug(`No target entities provided for ${role} validation`);
      const result = {
        valid: false,
        reason: `No target entities available for ${role} validation`,
      };
      if (includeDetails) {
        result.details = { targetRole: role, rejectedEntities: [] };
      }
      return result;
    }

    // No target entity for this role
    if (!targetEntities[role]) {
      this.#logger.debug(
        `No ${role} target entity found for required components validation`
      );
      const result = {
        valid: false,
        reason: `No ${role} target available for validation`,
      };
      if (includeDetails) {
        result.details = { targetRole: role, rejectedEntities: [] };
      }
      return result;
    }

    const targetCandidates = Array.isArray(targetEntities[role])
      ? targetEntities[role]
      : [targetEntities[role]];

    if (targetCandidates.length === 0) {
      this.#logger.debug(
        `Empty ${role} target array for required components validation`
      );
      const result = {
        valid: false,
        reason: `No ${role} target available for validation`,
      };
      if (includeDetails) {
        result.details = { targetRole: role, rejectedEntities: [] };
      }
      return result;
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

      // Collect missing components based on mode
      let missingComponentId = null;
      let allMissingComponents = [];

      if (includeDetails) {
        // Collect ALL missing components for detailed output
        allMissingComponents = requiredComponents.filter(
          (componentId) => !hasComponent(componentId)
        );
        missingComponentId = allMissingComponents[0] || null;
      } else {
        // Original behavior: find first missing component
        missingComponentId = requiredComponents.find(
          (componentId) => !hasComponent(componentId)
        );
      }

      if (missingComponentId) {
        const entityId = targetEntity.id || 'unknown';
        this.#logger.debug(
          `Target entity ${entityId} missing required component: ${missingComponentId}`
        );
        lastFailureReason = `Target (${role}) must have component: ${missingComponentId}`;

        // Track rejected entity when includeDetails is true
        if (includeDetails) {
          rejectedEntities.push({
            entityId,
            requiredComponentsMissing: allMissingComponents,
          });
        }
        continue;
      }

      hasValidCandidate = true;
      break;
    }

    if (hasValidCandidate) {
      const result = { valid: true };
      if (includeDetails) {
        result.details = { targetRole: role, rejectedEntities: [] };
      }
      return result;
    }

    const result = {
      valid: false,
      reason: lastFailureReason,
    };
    if (includeDetails) {
      result.details = { targetRole: role, rejectedEntities };
    }
    return result;
  }
}

export default TargetRequiredComponentsValidator;
