/**
 * @module HasPartWithStatusEffectOperator
 * @description Operator that checks if an entity has a body part with a given status component and optional predicate.
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';

/**
 * @class HasPartWithStatusEffectOperator
 * @augments BaseBodyPartOperator
 * @description Checks for component presence or field comparisons on body parts.
 * Usage: {"hasPartWithStatusEffect": ["actor", "anatomy:bleeding", "severity", {"op": ">=", "value": "moderate"}]}
 */
export class HasPartWithStatusEffectOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'hasPartWithStatusEffect');
  }

  /**
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - [componentId, propertyPath?, predicate?]
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if a matching status effect is found
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    const [componentId, propertyPath, predicate] = params;

    if (!componentId || typeof componentId !== 'string') {
      this.logger.warn(
        'hasPartWithStatusEffect: Invalid componentId parameter'
      );
      return false;
    }

    this.logger.debug(
      `hasPartWithStatusEffect called with entityPath='${
        context._currentPath || 'unknown'
      }', componentId='${componentId}', propertyPath='${
        propertyPath ?? ''
      }'`
    );

    this.bodyGraphService.buildAdjacencyCache(rootId);

    const result = this.bodyGraphService.hasPartWithStatusEffect(
      bodyComponent,
      componentId,
      propertyPath,
      predicate,
      entityId
    );

    this.logger.debug(
      `hasPartWithStatusEffect(${entityId}, ${componentId}) = ${result}`
    );

    return result;
  }
}
