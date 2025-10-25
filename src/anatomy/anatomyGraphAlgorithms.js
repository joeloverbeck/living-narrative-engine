/**
 * @file Utility functions for anatomy graph traversal and algorithms
 */

import { ANATOMY_CONSTANTS } from './constants/anatomyConstants.js';

/** @typedef {import('./anatomyCacheManager.js').AnatomyCacheManager} AnatomyCacheManager */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Provides static methods for anatomy graph operations
 * Following the utility pattern from graphUtils.js
 */
export class AnatomyGraphAlgorithms {
  /**
   * Gets all entities in a sub-graph rooted at the given entity
   *
   * @param {string} rootEntityId - The root of the sub-graph
   * @param {AnatomyCacheManager} cacheManager - The cache manager
   * @param {number} [maxDepth] - Maximum depth to traverse
   * @returns {string[]} All entity IDs in the sub-graph (including root)
   */
  static getSubgraph(
    rootEntityId,
    cacheManager,
    maxDepth = ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH
  ) {
    if (!rootEntityId || !cacheManager) return [];

    const result = [];
    const stack = [{ id: rootEntityId, depth: 0 }];
    const visited = new Set();

    while (stack.length > 0) {
      const { id, depth } = stack.pop();

      if (depth > maxDepth) continue;
      if (visited.has(id)) continue;

      visited.add(id);
      result.push(id);

      const node = cacheManager.get(id);
      if (node && node.children) {
        for (const childId of node.children) {
          stack.push({ id: childId, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Finds all body parts of a specific type in an anatomy
   *
   * @param {string} rootEntityId - The root entity of the anatomy
   * @param {string} partType - The part type to search for
   * @param {AnatomyCacheManager} cacheManager - The cache manager
   * @param {number} [maxDepth] - Maximum depth to traverse
   * @returns {string[]} Entity IDs of matching parts
   */
  static findPartsByType(
    rootEntityId,
    partType,
    cacheManager,
    maxDepth = ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH
  ) {
    if (!rootEntityId || !partType || !cacheManager) return [];

    const result = [];
    const visited = new Set();
    const stack = [{ id: rootEntityId, depth: 0 }];

    while (stack.length > 0) {
      const { id, depth } = stack.pop();

      if (depth > maxDepth) continue;
      if (visited.has(id)) continue;

      visited.add(id);

      const node = cacheManager.get(id);
      if (!node) {
        continue;
      }

      if (node.partType === partType) {
        result.push(id);
      }

      if (node.children) {
        for (const childId of node.children) {
          stack.push({ id: childId, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Gets the anatomy root for a given body part
   *
   * @param {string} partEntityId - Any entity ID in the anatomy
   * @param {AnatomyCacheManager} cacheManager - The cache manager
   * @param {IEntityManager} entityManager - Entity manager for fallback lookups
   * @param {number} [maxDepth] - Maximum depth to traverse
   * @returns {string|null} The root entity ID, or null if not found
   */
  static getAnatomyRoot(
    partEntityId,
    cacheManager,
    entityManager,
    maxDepth = ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH
  ) {
    if (!partEntityId) return null;

    let currentId = partEntityId;
    const visited = new Set();
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (visited.has(currentId)) {
        // Cycle detected
        return null;
      }
      visited.add(currentId);

      const node = cacheManager.get(currentId);
      if (!node) {
        // Try to get from entity manager
        const joint = entityManager?.getComponentData(
          currentId,
          'anatomy:joint'
        );
        if (joint) {
          currentId = joint.parentId;
        } else {
          // No parent - this is the root
          return currentId;
        }
      } else if (!node.parentId) {
        return currentId;
      } else {
        currentId = node.parentId;
      }

      depth++;
    }

    return null;
  }

  /**
   * Gets a path from one body part to another
   *
   * @param {string} fromEntityId - Starting entity
   * @param {string} toEntityId - Target entity
   * @param {AnatomyCacheManager} cacheManager - The cache manager
   * @param {number} [maxDepth] - Maximum path length
   * @returns {string[]|null} Path of entity IDs, or null if no path exists
   */
  static getPath(
    fromEntityId,
    toEntityId,
    cacheManager,
    maxDepth = ANATOMY_CONSTANTS.DEFAULT_MAX_PATH_LENGTH
  ) {
    if (!fromEntityId || !toEntityId || !cacheManager) return null;
    if (fromEntityId === toEntityId) return [fromEntityId];

    // First, find their common ancestor
    const fromAncestors = this.#getAncestors(
      fromEntityId,
      cacheManager,
      maxDepth
    );
    const toAncestors = this.#getAncestors(toEntityId, cacheManager, maxDepth);

    let commonAncestor = null;
    for (const ancestor of fromAncestors) {
      if (toAncestors.includes(ancestor)) {
        commonAncestor = ancestor;
        break;
      }
    }

    if (!commonAncestor) return null;

    // Build path: from -> ancestor -> to
    const pathUp = this.#getPathToAncestor(
      fromEntityId,
      commonAncestor,
      cacheManager,
      maxDepth
    );
    const pathDown = this.#getPathToAncestor(
      toEntityId,
      commonAncestor,
      cacheManager,
      maxDepth
    ).reverse();

    // Remove duplicate common ancestor
    if (pathDown.length > 0 && pathDown[0] === commonAncestor) {
      pathDown.shift();
    }

    return [...pathUp, ...pathDown];
  }

  /**
   * Gets all parts from a body component by traversing the anatomy graph
   *
   * @param {string} rootEntityId - Root entity ID from body component
   * @param {AnatomyCacheManager} cacheManager - The cache manager
   * @param {IEntityManager} entityManager - Entity manager for fallback lookups
   * @param {number} [maxDepth] - Maximum depth to traverse
   * @returns {string[]} Array of all entity IDs in the anatomy
   */
  static getAllParts(
    rootEntityId,
    cacheManager,
    entityManager,
    maxDepth = ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH
  ) {
    if (!rootEntityId) return [];

    const result = [];
    const visited = new Set();
    const stack = [{ id: rootEntityId, depth: 0 }];

    while (stack.length > 0) {
      const { id, depth } = stack.pop();

      if (depth > maxDepth) continue;
      if (visited.has(id)) continue;

      visited.add(id);

      // Check if entity exists before adding to result
      const node = cacheManager?.get(id);
      let entityExists = !!node;

      // If not in cache, try to verify entity exists via entity manager
      if (!entityExists && entityManager) {
        try {
          const entityInstance = entityManager.getEntityInstance(id);
          entityExists = !!entityInstance;
        } catch (error) {
          // Entity doesn't exist, skip it
          entityExists = false;
        }
      }

      if (entityExists) {
        result.push(id);
      }

      // Try to get children from adjacency cache first
      if (node && node.children && node.children.length > 0) {
        for (const childId of node.children) {
          stack.push({ id: childId, depth: depth + 1 });
        }
      } else if (entityManager && entityExists) {
        // Fallback to direct entity manager lookup - find entities with anatomy:joint
        const entitiesWithJoints =
          entityManager.getEntitiesWithComponent('anatomy:joint');
        if (entitiesWithJoints) {
          for (const entity of entitiesWithJoints) {
            const joint = entityManager.getComponentData(
              entity.id,
              'anatomy:joint'
            );
            if (joint && joint.parentId === id && !visited.has(entity.id)) {
              stack.push({ id: entity.id, depth: depth + 1 });
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Gets all ancestors of an entity
   *
   * @param {string} entityId
   * @param {AnatomyCacheManager} cacheManager
   * @param {number} maxDepth
   * @returns {string[]}
   * @private
   */
  static #getAncestors(entityId, cacheManager, maxDepth) {
    const ancestors = [];
    let current = entityId;
    let depth = 0;

    while (current && depth < maxDepth) {
      ancestors.push(current);
      const node = cacheManager.get(current);
      current = node?.parentId;
      depth++;
    }

    return ancestors;
  }

  /**
   * Gets path from entity to ancestor
   *
   * @param {string} entityId
   * @param {string} ancestorId
   * @param {AnatomyCacheManager} cacheManager
   * @param {number} maxDepth
   * @returns {string[]}
   * @private
   */
  static #getPathToAncestor(entityId, ancestorId, cacheManager, maxDepth) {
    const path = [];
    let current = entityId;
    let depth = 0;

    while (current && current !== ancestorId && depth < maxDepth) {
      path.push(current);
      const node = cacheManager.get(current);
      current = node?.parentId || null;
      depth++;
    }

    if (current === ancestorId) {
      path.push(ancestorId);
    }

    return path;
  }
}

export default AnatomyGraphAlgorithms;
