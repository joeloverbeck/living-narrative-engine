/**
 * @module HasPartSubTypeContainingOperator
 * @description Operator that checks if an entity has any body parts with subType containing a substring
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';

/**
 * @class HasPartSubTypeContainingOperator
 * @augments BaseBodyPartOperator
 * @description Checks if an entity has any body parts with subType containing a substring
 * Usage: {"hasPartSubTypeContaining": ["actor", "beak"]}
 */
export class HasPartSubTypeContainingOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'hasPartSubTypeContaining');
  }

  /**
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - [substring] where substring is the text to search for in subType
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if entity has at least one part with subType containing the substring
   */
  evaluateInternal(entityId, rootId, params, context, _bodyComponent) {
    const [substring] = params;

    if (!substring || typeof substring !== 'string') {
      this.logger.warn(
        `hasPartSubTypeContaining: Invalid substring parameter`
      );
      return false;
    }

    const lowerSubstring = substring.toLowerCase();

    this.logger.debug(
      `hasPartSubTypeContaining called with entityPath='${context._currentPath || 'unknown'}', substring='${substring}'`
    );

    // Build the cache for this anatomy if not already built
    this.bodyGraphService.buildAdjacencyCache(rootId);

    // Get all body parts and check subType
    const allParts = this.bodyGraphService.getAllParts(rootId);

    const matchingParts = allParts.filter(part => {
      const subType = part.subType;
      return subType && typeof subType === 'string' &&
             subType.toLowerCase().includes(lowerSubstring);
    });

    this.logger.debug(
      `hasPartSubTypeContaining(${entityId}, ${substring}) = ${matchingParts.length > 0} ` +
        `(found ${matchingParts.length} parts)`
    );

    return matchingParts.length > 0;
  }
}
