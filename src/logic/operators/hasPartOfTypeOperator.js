/**
 * @module HasPartOfTypeOperator
 * @description Operator that checks if an entity has any body parts of a specific type
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';

/**
 * @class HasPartOfTypeOperator
 * @augments BaseBodyPartOperator
 * @description Checks if an entity has any body parts of a specific type
 * Usage: {"hasPartOfType": ["actor", "leg"]}
 */
export class HasPartOfTypeOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'hasPartOfType');
  }

  /**
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - [partType] where partType is the type of body part to check for
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if entity has at least one part of the specified type
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    const [partType] = params;

    this.logger.debug(
      `hasPartOfType called with entityPath='${context._currentPath || 'unknown'}', partType='${partType}'`
    );

    // Build the cache for this anatomy if not already built
    this.bodyGraphService.buildAdjacencyCache(rootId);

    // Use BodyGraphService to find parts of the specified type
    const partsOfType = this.bodyGraphService.findPartsByType(rootId, partType);

    this.logger.debug(
      `hasPartOfType(${entityId}, ${partType}) = ${partsOfType.length > 0} ` +
        `(found ${partsOfType.length} parts)`
    );

    return partsOfType.length > 0;
  }
}
