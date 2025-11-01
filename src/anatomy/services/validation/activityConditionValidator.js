/**
 * @file Activity Condition Validation Utilities
 * @description Pure utility functions for validating activity visibility conditions
 * Extracted from ActivityDescriptionService for reusability and better separation of concerns
 */

import { ensureValidLogger } from '../../../utils/loggerUtils.js';

/**
 * Stateless validators for activity condition evaluation
 *
 * This class provides pure utility methods for validating various activity visibility
 * conditions including empty conditions, property matching, required components,
 * forbidden components, and entity data extraction.
 */
class ActivityConditionValidator {
  #logger;

  /**
   * Creates a new ActivityConditionValidator instance
   *
   * @param {object} dependencies - Dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger, 'ActivityConditionValidator');
  }

  /**
   * Check if conditions object is empty or invalid
   *
   * @param {object} conditions - Conditions object to check
   * @returns {boolean} True if conditions are empty/null
   */
  isEmptyConditionsObject(conditions) {
    if (!conditions) {
      return true;
    }

    return Object.keys(conditions).length === 0;
  }

  /**
   * Verify showOnlyIfProperty rule against activity data
   *
   * Checks if an activity's source data satisfies a property-based visibility rule.
   * If no rule is provided or the rule lacks a property field, the method returns true.
   *
   * @param {object} activity - Activity record with sourceData
   * @param {object} rule - Rule with property and equals keys
   * @param {string} rule.property - Property name to check
   * @param {string|number|boolean} rule.equals - Expected value for the property
   * @returns {boolean} True if activity satisfies the rule
   */
  matchesPropertyCondition(activity, rule) {
    if (!rule || !rule.property) {
      return true;
    }

    const sourceData = activity?.sourceData ?? {};
    return sourceData[rule.property] === rule.equals;
  }

  /**
   * Verify entity has all required components
   *
   * Checks if an entity instance has all specified components. Returns false if
   * the entity lacks the hasComponent method or if any component check fails.
   * Logs warnings for individual component check failures.
   *
   * @param {object} entity - Entity instance with hasComponent method
   * @param {Array<string>} required - Required component IDs
   * @returns {boolean} True if all components exist
   */
  hasRequiredComponents(entity, required) {
    if (!entity || typeof entity.hasComponent !== 'function') {
      return false;
    }

    try {
      return required.every((componentId) => {
        try {
          return entity.hasComponent(componentId);
        } catch (error) {
          this.#logger.warn(
            `Failed to verify required component ${componentId} for ${entity?.id ?? 'unknown'}`,
            error
          );
          return false;
        }
      });
    } catch (error) {
      this.#logger.warn(
        `Failed to evaluate required components for ${entity?.id ?? 'unknown'}`,
        error
      );
      return false;
    }
  }

  /**
   * Verify entity contains any forbidden components
   *
   * Checks if an entity instance has any of the specified forbidden components.
   * Returns false if the entity lacks the hasComponent method or if all checks fail.
   * Logs warnings for individual component check failures.
   *
   * @param {object} entity - Entity instance with hasComponent method
   * @param {Array<string>} forbidden - Forbidden component IDs
   * @returns {boolean} True if a forbidden component is present
   */
  hasForbiddenComponents(entity, forbidden) {
    if (!entity || typeof entity.hasComponent !== 'function') {
      return false;
    }

    try {
      return forbidden.some((componentId) => {
        try {
          return entity.hasComponent(componentId);
        } catch (error) {
          this.#logger.warn(
            `Failed to verify forbidden component ${componentId} for ${entity?.id ?? 'unknown'}`,
            error
          );
          return false;
        }
      });
    } catch (error) {
      this.#logger.warn(
        `Failed to evaluate forbidden components for ${entity?.id ?? 'unknown'}`,
        error
      );
      return false;
    }
  }

  /**
   * Extract entity component data for JSON Logic evaluation
   *
   * Retrieves all component data from an entity instance and returns a simplified
   * representation containing the entity ID and a components object mapping
   * component IDs to their data. Logs warnings for failed component data extractions.
   *
   * @param {object} entity - Entity instance
   * @param {string} entity.id - Entity identifier
   * @param {Array<string>} entity.componentTypeIds - Array of component IDs
   * @param {function(string): object} entity.getComponentData - Method to retrieve component data
   * @returns {object|null} Simplified entity representation with id and components, or null if entity is invalid
   */
  extractEntityData(entity) {
    if (!entity) {
      return null;
    }

    const componentIds = entity.componentTypeIds ?? [];
    const components = {};

    if (Array.isArray(componentIds)) {
      for (const componentId of componentIds) {
        if (typeof entity.getComponentData === 'function') {
          try {
            components[componentId] = entity.getComponentData(componentId);
          } catch (error) {
            this.#logger.warn(
              `Failed to extract component data for ${componentId} on ${entity?.id ?? 'unknown entity'}`,
              error
            );
          }
        }
      }
    }

    return {
      id: entity.id,
      components,
    };
  }
}

export default ActivityConditionValidator;
