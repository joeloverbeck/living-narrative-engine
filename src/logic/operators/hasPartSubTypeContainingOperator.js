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
   * @param {Array} params - [substring, options] where substring is the text to search for in subType and options can enable stricter matching
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} True if entity has at least one part with subType containing the substring
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    const [substring, rawOptions] = params;
    const options = this.#normalizeOptions(rawOptions);

    if (!substring || typeof substring !== 'string') {
      this.logger.warn(`hasPartSubTypeContaining: Invalid substring parameter`);
      return false;
    }

    const lowerSubstring = substring.toLowerCase();

    this.logger.debug(
      `hasPartSubTypeContaining called with entityPath='${context._currentPath || 'unknown'}', substring='${substring}'`
    );

    // Build the cache for this anatomy if not already built
    this.bodyGraphService.buildAdjacencyCache(rootId);

    // Get all body parts (returns entity IDs as strings)
    const allParts = this.bodyGraphService.getAllParts(bodyComponent, entityId);

    // Look up each part in the cache to get its partType (subType)
    const matchingParts = allParts.filter((partId) => {
      const node = this.bodyGraphService.getCacheNode(partId);
      if (!node) return false;

      const partType = node.partType;
      if (!partType || typeof partType !== 'string') {
        return false;
      }

      const partTypeLower = partType.toLowerCase();

      if (options.matchAtEnd) {
        return partTypeLower.endsWith(lowerSubstring);
      }

      return options.matchWholeWord
        ? this.#matchesWholeWord(partType, lowerSubstring)
        : partTypeLower.includes(lowerSubstring);
    });

    this.logger.debug(
      `hasPartSubTypeContaining(${entityId}, ${substring}) = ${matchingParts.length > 0} ` +
        `(found ${matchingParts.length} matching parts out of ${allParts.length} total)`
    );

    return matchingParts.length > 0;
  }

  /**
   * Normalizes optional options parameter.
   * @param {unknown} rawOptions
   * @returns {{matchWholeWord: boolean, matchAtEnd: boolean}}
   */
  #normalizeOptions(rawOptions) {
    if (rawOptions === true) {
      return { matchWholeWord: true, matchAtEnd: false };
    }

    if (!rawOptions || typeof rawOptions !== 'object') {
      return { matchWholeWord: false, matchAtEnd: false };
    }

    return {
      matchWholeWord: Boolean(rawOptions.matchWholeWord),
      matchAtEnd: Boolean(rawOptions.matchAtEnd),
    };
  }

  /**
   * Matches substring on word boundaries (start/end or separated by non-alphanumeric characters).
   * @param {string} partType
   * @param {string} lowerSubstring
   * @returns {boolean}
   */
  #matchesWholeWord(partType, lowerSubstring) {
    const escaped = lowerSubstring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryPattern = `(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`;
    const boundaryRegex = new RegExp(boundaryPattern, 'i');
    return boundaryRegex.test(partType);
  }
}
