/**
 * @file Centralized entity matching service for anatomy validation
 * @see src/anatomy/validation/RecipePreflightValidator.js
 */

import { BaseService } from '../../utils/serviceBase.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */

/**
 * Provides centralized entity matching logic for anatomy recipe validation
 * Eliminates code duplication and improves testability
 *
 * Extracted from RecipePreflightValidator to support:
 * - Basic entity matching for slots and patterns
 * - Slot-specific matching with allowedTypes filtering
 * - Property requirement merging
 */
class EntityMatcherService extends BaseService {
  constructor({ logger, dataRegistry }) {
    super();

    this._init('EntityMatcherService', logger, {
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get', 'getAll'],
      },
    });
  }

  /**
   * Find entities matching basic criteria (for slots and patterns)
   *
   * @param {object} criteria - Matching criteria
   * @param {string} criteria.partType - Required part type (subType in anatomy:part)
   * @param {Array<string>} [criteria.tags] - Required component tags
   * @param {object} [criteria.properties] - Required property values
   * @param {Array<object>} allEntityDefs - Entity definitions to search
   * @returns {Array<string>} Matching entity IDs
   */
  findMatchingEntities(criteria, allEntityDefs) {
    const matches = [];
    const requiredPartType = criteria.partType;
    const requiredTags = criteria.tags || [];
    const requiredPropertyValues = criteria.properties || {};

    for (const entityDef of allEntityDefs) {
      // Check if entity has anatomy:part component with matching subType
      if (!this.#hasMatchingPartType(entityDef, requiredPartType)) {
        continue;
      }

      // Check if entity has all required tags (components)
      if (!this.#hasAllRequiredTags(entityDef, requiredTags)) {
        continue;
      }

      // Check if entity property VALUES match required property values
      // This mirrors the runtime behavior in partSelectionService.js #matchesProperties
      if (!this.#matchesPropertyValues(entityDef, requiredPropertyValues)) {
        continue;
      }

      matches.push(entityDef.id);
    }

    return matches;
  }

  /**
   * Find entities matching slot requirements (includes allowedTypes filter)
   *
   * @param {object} requirements - Combined slot requirements
   * @param {string|null} requirements.partType - Required part type
   * @param {Array<string>} requirements.allowedTypes - Allowed part types ('*' = all)
   * @param {Array<string>} requirements.tags - Required component tags
   * @param {object} requirements.properties - Required property values
   * @param {Array<object>} allEntityDefs - Entity definitions to search
   * @returns {Array<string>} Matching entity IDs
   */
  findMatchingEntitiesForSlot(requirements, allEntityDefs) {
    const matches = [];
    const { partType, allowedTypes, tags, properties } = requirements;

    for (const entityDef of allEntityDefs) {
      // Check if entity has anatomy:part component
      const anatomyPart = entityDef.components?.['anatomy:part'];
      if (!anatomyPart) {
        continue;
      }

      // Check partType requirement (if specified)
      // When partType is provided, it must match the entity's subType
      if (partType && anatomyPart.subType !== partType) {
        continue;
      }

      // Check if subType is in allowedTypes (unless allowedTypes includes '*')
      // This filters based on the entity's actual subType, not the required partType
      if (allowedTypes && !allowedTypes.includes('*')) {
        if (!allowedTypes.includes(anatomyPart.subType)) {
          continue;
        }
      }

      // Check if entity has all required tags (components)
      if (!this.#hasAllRequiredTags(entityDef, tags)) {
        continue;
      }

      // Check if entity properties match required property VALUES
      // Properties is an object like { "descriptors:build": { "build": "slim" } }
      if (!this.#matchesPropertyValues(entityDef, properties)) {
        continue;
      }

      matches.push(entityDef.id);
    }

    return matches;
  }

  /**
   * Deep merge property requirements from pattern and blueprint
   * Ensures that both sets of constraints are preserved when they target the same component
   *
   * @param {object} patternProperties - Property requirements from pattern
   * @param {object} blueprintProperties - Property requirements from blueprint slot
   * @returns {object} Merged property requirements with all constraints
   * @example
   * // Pattern requires: descriptors:venom.potency === 'high'
   * // Blueprint requires: descriptors:venom.color === 'green'
   * // Result: descriptors:venom must have both potency='high' AND color='green'
   * const merged = service.mergePropertyRequirements(
   *   { "descriptors:venom": { "potency": "high" } },
   *   { "descriptors:venom": { "color": "green" } }
   * );
   * // => { "descriptors:venom": { "potency": "high", "color": "green" } }
   */
  mergePropertyRequirements(patternProperties, blueprintProperties) {
    const merged = { ...patternProperties };

    // Deep merge blueprint properties into pattern properties
    for (const [componentId, blueprintProps] of Object.entries(blueprintProperties)) {
      if (merged[componentId]) {
        // Component exists in both - merge the property constraints
        merged[componentId] = {
          ...merged[componentId],
          ...blueprintProps,
        };
      } else {
        // Component only in blueprint - add it
        merged[componentId] = { ...blueprintProps };
      }
    }

    return merged;
  }

  /**
   * Check if entity has anatomy:part component with required subType
   *
   * @param {object} entityDef - Entity definition
   * @param {string} partType - Required part type
   * @returns {boolean} True if part type matches
   * @private
   */
  #hasMatchingPartType(entityDef, partType) {
    const anatomyPart = entityDef.components?.['anatomy:part'];
    return anatomyPart && anatomyPart.subType === partType;
  }

  /**
   * Check if entity has all required tag components
   *
   * @param {object} entityDef - Entity definition
   * @param {Array<string>} tags - Required component tags
   * @returns {boolean} True if all tags present
   * @private
   */
  #hasAllRequiredTags(entityDef, tags) {
    return tags.every((tag) => entityDef.components?.[tag] !== undefined);
  }

  /**
   * Check if entity matches property value requirements
   * Mimics the production code's #matchesProperties method
   *
   * @param {object} entityDef - Entity definition
   * @param {object} propertyRequirements - Required property components with values
   * @returns {boolean} True if all property values match
   * @private
   */
  #matchesPropertyValues(entityDef, propertyRequirements) {
    if (!propertyRequirements || typeof propertyRequirements !== 'object') {
      return true;
    }

    for (const [componentId, requiredProps] of Object.entries(propertyRequirements)) {
      const component = entityDef.components?.[componentId];
      if (!component) {
        return false;
      }

      for (const [propKey, propValue] of Object.entries(requiredProps)) {
        if (component[propKey] !== propValue) {
          return false;
        }
      }
    }

    return true;
  }
}

export default EntityMatcherService;
