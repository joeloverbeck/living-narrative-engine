/**
 * @module HasPartWithComponentValueOperator
 * @description Operator that checks if an entity has a body part with a specific component value
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';

/**
 * @class HasPartWithComponentValueOperator
 * @augments BaseBodyPartOperator
 * @description Checks if an entity has any body part with a specific component value
 * Usage: {"hasPartWithComponentValue": ["actor", {"componentType": "descriptors:build", "property": "build", "value": "muscular"}]}
 */
export class HasPartWithComponentValueOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'hasPartWithComponentValue');
  }

  /**
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - [componentId, propertyPath, expectedValue]
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if entity has a part with the specified component value
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    const [componentId, propertyPath, expectedValue] = params;

    this.logger.debug(
      `hasPartWithComponentValue called with entityPath='${context._currentPath || 'unknown'}', ` +
      `componentId='${componentId}', propertyPath='${propertyPath}', expectedValue='${expectedValue}'`
    );

    this.logger.debug(`hasPartWithComponentValue: Found entity ID: ${entityId}`);

    // Use BodyGraphService to check for the part
    const result = this.bodyGraphService.hasPartWithComponentValue(
      bodyComponent,
      componentId,
      propertyPath,
      expectedValue
    );

    this.logger.debug(
      `hasPartWithComponentValue(${entityId}, ${componentId}, ${propertyPath}, ${expectedValue}) = ${result.found}`
    );

    return result.found;
  }
}