/**
 * @module HasWoundedPartOperator
 * @description Operator that checks if an entity has any wounded body part.
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';

/**
 * @class HasWoundedPartOperator
 * @augments BaseBodyPartOperator
 * @description Returns true when any part has anatomy:part_health below max or a non-healthy state.
 * Usage: {"hasWoundedPart": ["actor"]}
 */
export class HasWoundedPartOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'hasWoundedPart');
  }

  /**
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - [options] (currently unused)
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if any part is wounded
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    this.logger.debug(
      `hasWoundedPart called with entityPath='${
        context._currentPath || 'unknown'
      }'`
    );

    this.bodyGraphService.buildAdjacencyCache(rootId);

    const result = this.bodyGraphService.hasWoundedPart(
      bodyComponent,
      entityId
    );

    this.logger.debug(`hasWoundedPart(${entityId}) = ${result}`);

    return result;
  }
}
