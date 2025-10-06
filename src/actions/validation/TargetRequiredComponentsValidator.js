/**
 * @file TargetRequiredComponentsValidator.js
 * Validates that target entities have required components
 * @see TargetComponentValidator.js (forbidden components pattern)
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

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
    if (requirements.target && requirements.target.length > 0) {
      const result = this.#validateTargetRole(
        'target',
        requirements.target,
        targetEntities
      );
      if (!result.valid) {
        return result;
      }
    }

    // Check multi-target format
    const multiTargetRoles = ['primary', 'secondary', 'tertiary'];
    for (const role of multiTargetRoles) {
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
      this.#logger.debug(
        `No target entities provided for ${role} validation`
      );
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

    const targetEntity = targetEntities[role];

    // Check each required component
    for (const componentId of requiredComponents) {
      if (!targetEntity.components || !targetEntity.components[componentId]) {
        const entityId = targetEntity.id || 'unknown';
        this.#logger.debug(
          `Target entity ${entityId} missing required component: ${componentId}`
        );
        return {
          valid: false,
          reason: `Target (${role}) must have component: ${componentId}`,
        };
      }
    }

    return { valid: true };
  }
}

export default TargetRequiredComponentsValidator;
