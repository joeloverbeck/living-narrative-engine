/**
 * @module HasPartOfTypeWithComponentValueOperator
 * @description Operator that checks if an entity has body parts of a specific type with a specific component value
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';

/**
 * @class HasPartOfTypeWithComponentValueOperator
 * @augments BaseBodyPartOperator
 * @description Checks if an entity has body parts of a specific type with a specific component value
 * Usage: {"hasPartOfTypeWithComponentValue": ["actor", "leg", "descriptors:build", "build", "muscular"]}
 */
export class HasPartOfTypeWithComponentValueOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'hasPartOfTypeWithComponentValue');
  }

  /**
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - [partType, componentId, propertyPath, expectedValue]
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if entity has a part of the specified type with the specified component value
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    const [partType, componentId, propertyPath, expectedValue] = params;

    // Build the cache for this anatomy if not already built
    this.bodyGraphService.buildAdjacencyCache(rootId);

    // Use BodyGraphService to find parts of the specified type
    const partsOfType = this.bodyGraphService.findPartsByType(rootId, partType);

    if (partsOfType.length === 0) {
      this.logger.debug(`Entity ${entityId} has no parts of type ${partType}`);
      return false;
    }

    // Check each part of the specified type for the component value
    for (const partId of partsOfType) {
      const componentData = this.entityManager.getComponentData(
        partId,
        componentId
      );

      if (componentData) {
        // Navigate the property path within the component
        let value = componentData;
        const propParts = propertyPath.split('.');

        for (const prop of propParts) {
          if (value && typeof value === 'object') {
            value = value[prop];
          } else {
            value = undefined;
            break;
          }
        }

        if (value === expectedValue) {
          this.logger.debug(
            `hasPartOfTypeWithComponentValue(${entityId}, ${partType}, ${componentId}, ` +
              `${propertyPath}, ${expectedValue}) = true (found in part ${partId})`
          );
          return true;
        }
      }
    }

    this.logger.debug(
      `hasPartOfTypeWithComponentValue(${entityId}, ${partType}, ${componentId}, ` +
        `${propertyPath}, ${expectedValue}) = false`
    );
    return false;
  }
}
