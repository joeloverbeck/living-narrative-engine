// src/anatomy/recipeConstraintEvaluator.js

/**
 * @file Service responsible for evaluating recipe constraints on anatomy graphs
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} RecipeConstraints
 * @property {Array<object>} [requires] - Required component/part combinations
 * @property {Array<object>} [excludes] - Mutually exclusive components
 */

/**
 * @typedef {object} ConstraintValidationResult
 * @property {boolean} valid - Whether constraints are satisfied
 * @property {string[]} errors - Constraint violations
 * @property {string[]} warnings - Non-critical issues
 */

/**
 * Service that evaluates recipe constraints against assembled anatomy graphs
 */
export class RecipeConstraintEvaluator {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    if (!entityManager) {
      throw new InvalidArgumentError('entityManager is required');
    }
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Evaluates recipe constraints against an anatomy graph
   *
   * @param {string[]} entityIds - All entity IDs in the graph
   * @param {object} recipe - Recipe with constraints
   * @returns {ConstraintValidationResult} Validation result
   */
  evaluateConstraints(entityIds, recipe) {
    const errors = [];
    const warnings = [];

    this.#logger.debug(
      `RecipeConstraintEvaluator: Evaluating constraints for ${entityIds.length} entities`
    );

    // Build graph metadata
    const graphMetadata = this.#buildGraphMetadata(entityIds);

    // Check requires constraints
    if (recipe.constraints?.requires) {
      this.#evaluateRequiresConstraints(
        recipe.constraints.requires,
        graphMetadata,
        errors
      );
    }

    // Check excludes constraints
    if (recipe.constraints?.excludes) {
      this.#evaluateExcludesConstraints(
        recipe.constraints.excludes,
        graphMetadata,
        errors
      );
    }

    // Check slot count constraints
    if (recipe.slots) {
      this.#evaluateSlotCountConstraints(
        recipe.slots,
        graphMetadata,
        errors,
        warnings
      );
    }

    const valid = errors.length === 0;

    if (!valid) {
      this.#logger.error(
        `RecipeConstraintEvaluator: Constraints failed with ${errors.length} errors`
      );
    } else if (warnings.length > 0) {
      this.#logger.warn(
        `RecipeConstraintEvaluator: Constraints passed with ${warnings.length} warnings`
      );
    } else {
      this.#logger.debug(
        'RecipeConstraintEvaluator: All constraints satisfied'
      );
    }

    return { valid, errors, warnings };
  }

  /**
   * Builds metadata about the graph for constraint evaluation
   *
   * @param {string[]} entityIds - Entity IDs in the graph
   * @returns {object} Graph metadata
   * @private
   */
  #buildGraphMetadata(entityIds) {
    const partTypes = new Set();
    const components = new Set();
    const partTypeCounts = new Map();

    for (const entityId of entityIds) {
      // Get anatomy part type
      const anatomyPart = this.#entityManager.getComponentData(
        entityId,
        'anatomy:part'
      );

      if (anatomyPart?.subType) {
        partTypes.add(anatomyPart.subType);

        // Count occurrences
        const currentCount = partTypeCounts.get(anatomyPart.subType) || 0;
        partTypeCounts.set(anatomyPart.subType, currentCount + 1);
      }

      // Get all components
      const componentTypes =
        this.#entityManager.getAllComponentTypesForEntity(entityId);
      if (componentTypes) {
        for (const componentId of componentTypes) {
          components.add(componentId);
        }
      }
    }

    return {
      partTypes,
      components,
      partTypeCounts,
      entityCount: entityIds.length,
    };
  }

  /**
   * Evaluates 'requires' constraints
   *
   * @param {Array<object>} requiresConstraints - Required constraints
   * @param {object} graphMetadata - Graph metadata
   * @param {string[]} errors - Error array to populate
   * @private
   */
  #evaluateRequiresConstraints(requiresConstraints, graphMetadata, errors) {
    for (const constraint of requiresConstraints) {
      const requiredComponents = constraint.components || [];
      const requiredPartTypes = constraint.partTypes || [];

      // Get validation metadata if provided
      const validation = constraint.validation || {};
      const minItems = validation.minItems || 1;

      // Check if sufficient required part types are present
      const presentPartTypes = requiredPartTypes.filter((pt) =>
        graphMetadata.partTypes.has(pt)
      );
      const hasRequiredPartType = presentPartTypes.length >= minItems;

      // If we have sufficient required part types, check for required components
      if (hasRequiredPartType && requiredComponents.length > 0) {
        const missingComponents = requiredComponents.filter(
          (c) => !graphMetadata.components.has(c)
        );

        if (missingComponents.length > 0) {
          // Use custom error message if provided, otherwise use default
          const errorMessage =
            validation.errorMessage ||
            `Required constraint not satisfied: has part types [${presentPartTypes.join(', ')}] ` +
              `but missing required components [${missingComponents.join(', ')}]`;

          errors.push(errorMessage);

          // Log explanation if provided
          if (validation.explanation) {
            this.#logger.debug(
              `Constraint explanation: ${validation.explanation}`
            );
          }
        }
      }
    }
  }

  /**
   * Evaluates 'excludes' constraints
   *
   * @param {Array<object>} excludesConstraints - Exclusion constraints
   * @param {object} graphMetadata - Graph metadata
   * @param {string[]} errors - Error array to populate
   * @private
   */
  #evaluateExcludesConstraints(excludesConstraints, graphMetadata, errors) {
    for (const constraint of excludesConstraints) {
      // Handle nested format with components array
      const excludedComponents = constraint.components || constraint;

      // Get validation metadata if provided
      const validation = constraint.validation || {};

      if (Array.isArray(excludedComponents)) {
        const presentExcluded = excludedComponents.filter((c) =>
          graphMetadata.components.has(c)
        );

        if (presentExcluded.length > 1) {
          // Use custom error message if provided, otherwise use default
          const errorMessage =
            validation.errorMessage ||
            `Exclusion constraint violated: found mutually exclusive components ` +
              `[${presentExcluded.join(', ')}] in the same anatomy`;

          errors.push(errorMessage);

          // Log explanation if provided
          if (validation.explanation) {
            this.#logger.debug(
              `Constraint explanation: ${validation.explanation}`
            );
          }
        }
      }
    }
  }

  /**
   * Evaluates slot count constraints
   *
   * @param {object} slots - Recipe slots with count constraints
   * @param {object} graphMetadata - Graph metadata
   * @param {string[]} errors - Error array to populate
   * @param {string[]} warnings - Warning array to populate
   * @private
   */
  #evaluateSlotCountConstraints(slots, graphMetadata, errors, warnings) {
    for (const [slotKey, slot] of Object.entries(slots)) {
      const slotErrorCountBefore = errors.length;
      const partType = slot.type || slot.partType;
      const actualCount = graphMetadata.partTypeCounts.get(partType) || 0;

      if (slot.count !== undefined) {
        // Handle both number and object formats
        if (typeof slot.count === 'number') {
          if (actualCount !== slot.count) {
            errors.push(
              `Slot '${slotKey}': expected exactly ${slot.count} parts of type '${partType}' ` +
                `but found ${actualCount}`
            );
          }
        } else if (typeof slot.count === 'object') {
          if (
            slot.count.exact !== undefined &&
            actualCount !== slot.count.exact
          ) {
            errors.push(
              `Slot '${slotKey}': expected exactly ${slot.count.exact} parts of type '${partType}' ` +
                `but found ${actualCount}`
            );
          } else if (
            slot.count.min !== undefined &&
            actualCount < slot.count.min
          ) {
            errors.push(
              `Slot '${slotKey}': expected at least ${slot.count.min} parts of type '${partType}' ` +
                `but found ${actualCount}`
            );
          } else if (
            slot.count.max !== undefined &&
            actualCount > slot.count.max
          ) {
            errors.push(
              `Slot '${slotKey}': expected at most ${slot.count.max} parts of type '${partType}' ` +
                `but found ${actualCount}`
            );
          } else if (
            slot.count.recommended !== undefined &&
            actualCount !== slot.count.recommended &&
            errors.length === slotErrorCountBefore
          ) {
            warnings.push(
              `Slot '${slotKey}': recommended ${slot.count.recommended} parts of type '${partType}' ` +
                `but found ${actualCount}`
            );
          }
        }
      }
    }
  }
}

export default RecipeConstraintEvaluator;
