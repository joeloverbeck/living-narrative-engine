/**
 * @file Manager for anatomy adjacency cache operations
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ANATOMY_CONSTANTS } from './constants/anatomyConstants.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} AnatomyNode
 * @property {string} entityId
 * @property {string} partType
 * @property {string} [parentId]
 * @property {string} [socketId]
 * @property {string[]} children
 */

/**
 * Manages the adjacency cache for anatomy graphs
 * Follows the Manager pattern - does not extend BaseService
 */
export class AnatomyCacheManager {
  /** @type {Map<string, AnatomyNode>} */
  #adjacencyCache;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   */
  constructor({ logger }) {
    if (!logger) throw new InvalidArgumentError('logger is required');

    this.#logger = logger;
    this.#adjacencyCache = new Map();
  }

  /**
   * Clears all entries from the cache
   *
   * @returns {void}
   */
  clear() {
    this.#adjacencyCache.clear();
    this.#logger.debug('AnatomyCacheManager: Cache cleared');
  }

  /**
   * Sets a node in the cache
   *
   * @param {string} entityId
   * @param {AnatomyNode} node
   * @returns {void}
   */
  set(entityId, node) {
    if (!entityId) throw new InvalidArgumentError('entityId is required');
    if (!node) throw new InvalidArgumentError('node is required');

    this.#adjacencyCache.set(entityId, node);
  }

  /**
   * Gets a node from the cache
   *
   * @param {string} entityId
   * @returns {AnatomyNode|undefined}
   */
  get(entityId) {
    return this.#adjacencyCache.get(entityId);
  }

  /**
   * Checks if an entity exists in the cache
   *
   * @param {string} entityId
   * @returns {boolean}
   */
  has(entityId) {
    return this.#adjacencyCache.has(entityId);
  }

  /**
   * Checks if a cache exists for a specific root entity
   * A cache is considered to exist if the root entity is present in the cache
   *
   * @param {string} rootEntityId - The root entity ID to check
   * @returns {boolean} True if cache exists for this root
   */
  hasCacheForRoot(rootEntityId) {
    if (!rootEntityId) return false;
    return this.#adjacencyCache.has(rootEntityId);
  }

  /**
   * Deletes an entity from the cache
   *
   * @param {string} entityId
   * @returns {boolean} Whether the entity was deleted
   */
  delete(entityId) {
    return this.#adjacencyCache.delete(entityId);
  }

  /**
   * Returns all entries in the cache
   *
   * @returns {IterableIterator<[string, AnatomyNode]>}
   */
  entries() {
    return this.#adjacencyCache.entries();
  }

  /**
   * Returns the size of the cache
   *
   * @returns {number}
   */
  size() {
    return this.#adjacencyCache.size;
  }

  /**
   * Invalidates the cache for a specific root entity
   * This should be called when anatomy structure changes
   *
   * @param {string} rootEntityId - The root entity whose cache should be invalidated
   * @returns {void}
   */
  invalidateCacheForRoot(rootEntityId) {
    if (!rootEntityId) return;

    // Remove all entities that belong to this anatomy tree
    const toRemove = [];
    for (const [entityId, node] of this.#adjacencyCache.entries()) {
      // Check if this entity is part of the anatomy tree
      // by traversing up to find the root
      let current = node;
      let currentId = entityId;

      while (current && current.parentId) {
        currentId = current.parentId;
        current = this.#adjacencyCache.get(currentId);
      }

      if (currentId === rootEntityId) {
        toRemove.push(entityId);
      }
    }

    // Remove all entities in this anatomy tree
    for (const entityId of toRemove) {
      this.#adjacencyCache.delete(entityId);
    }

    this.#logger.debug(
      `AnatomyCacheManager: Invalidated cache for root '${rootEntityId}', removed ${toRemove.length} entries`
    );
  }

  /**
   * Builds the adjacency cache for an anatomy graph
   *
   * @param {string} rootEntityId
   * @param {IEntityManager} entityManager
   * @returns {void}
   */
  buildCache(rootEntityId, entityManager) {
    if (!rootEntityId)
      throw new InvalidArgumentError('rootEntityId is required');
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');

    this.#logger.debug(
      `AnatomyCacheManager: Building cache for anatomy rooted at '${rootEntityId}'`
    );

    // Don't clear if we're checking for existing cache
    // Clear only when explicitly building a new cache
    this.clear();
    const visited = new Set();

    // Build parent-to-children map in single pass for O(n) complexity
    const parentToChildren = this.#buildParentToChildrenMap(entityManager);

    this.#buildCacheRecursive(
      rootEntityId,
      null,
      null,
      entityManager,
      visited,
      0,
      parentToChildren
    );

    this.#logger.info(
      `AnatomyCacheManager: Built cache with ${this.#adjacencyCache.size} nodes`
    );
  }

  /**
   * Builds a parent-to-children map for O(n) child lookup
   *
   * @param {IEntityManager} entityManager
   * @returns {Map<string, Array<{childId: string, socketId: string}>>}
   * @private
   */
  #buildParentToChildrenMap(entityManager) {
    const parentToChildren = new Map();

    // Get all entities with joints in a single pass
    const entitiesWithJoints =
      entityManager.getEntitiesWithComponent('anatomy:joint');

    // Handle case where getEntitiesWithComponent returns null/undefined
    if (!entitiesWithJoints) {
      this.#logger.debug('AnatomyCacheManager: No entities with joints found');
      return parentToChildren;
    }

    // Build the map in O(n) time
    for (const entity of entitiesWithJoints) {
      const joint = entityManager.getComponentData(entity.id, 'anatomy:joint');
      if (joint?.parentId) {
        if (!parentToChildren.has(joint.parentId)) {
          parentToChildren.set(joint.parentId, []);
        }
        parentToChildren.get(joint.parentId).push({
          childId: entity.id,
          socketId: joint.socketId,
        });
      }
    }

    this.#logger.debug(
      `AnatomyCacheManager: Built parent-to-children map with ${parentToChildren.size} parent nodes`
    );

    return parentToChildren;
  }

  /**
   * Recursively builds the adjacency cache
   *
   * @param {string} entityId
   * @param {string|null} parentId
   * @param {string|null} socketId
   * @param {IEntityManager} entityManager
   * @param {Set<string>} visited
   * @param {number} depth
   * @param {Map<string, Array<{childId: string, socketId: string}>>} parentToChildren
   * @private
   */
  #buildCacheRecursive(
    entityId,
    parentId,
    socketId,
    entityManager,
    visited,
    depth,
    parentToChildren
  ) {
    if (depth > ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH) {
      this.#logger.warn(
        `AnatomyCacheManager: Max recursion depth reached at entity '${entityId}'`
      );
      return;
    }

    if (visited.has(entityId)) return;
    visited.add(entityId);

    try {
      const entity = entityManager.getEntityInstance(entityId);
      const anatomyPart = entityManager.getComponentData(
        entityId,
        'anatomy:part'
      );

      // Debug logging
      this.#logger.debug(
        `AnatomyCacheManager: Entity '${entityId}' anatomy:part data: ${JSON.stringify(anatomyPart)}`
      );

      // Create node
      const node = {
        entityId,
        partType: anatomyPart?.subType || 'unknown',
        parentId,
        socketId,
        children: [],
      };

      this.#logger.debug(
        `AnatomyCacheManager: Created node for entity '${entityId}' with partType: '${node.partType}'`
      );

      this.#adjacencyCache.set(entityId, node);

      // Use the parent-to-children map for O(1) lookup instead of O(n) search
      const children = parentToChildren.get(entityId) || [];

      for (const child of children) {
        node.children.push(child.childId);
        this.#buildCacheRecursive(
          child.childId,
          entityId,
          child.socketId,
          entityManager,
          visited,
          depth + 1,
          parentToChildren
        );
      }
    } catch (error) {
      this.#logger.error(
        `AnatomyCacheManager: Failed to build cache node for entity '${entityId}'`,
        { error }
      );
    }
  }

  /**
   * Validates the integrity of the cached graph
   *
   * @param {IEntityManager} entityManager
   * @returns {{valid: boolean, issues: string[]}}
   */
  validateCache(entityManager) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');

    const issues = [];

    for (const [entityId, node] of this.#adjacencyCache.entries()) {
      // Check entity still exists
      try {
        entityManager.getEntityInstance(entityId);
      } catch (error) {
        issues.push(`Cached entity '${entityId}' no longer exists`);
        continue;
      }

      // Check parent relationship
      if (node.parentId) {
        const joint = entityManager.getComponentData(entityId, 'anatomy:joint');
        if (!joint) {
          issues.push(
            `Entity '${entityId}' in cache has parent but no joint component`
          );
        } else if (joint.parentId !== node.parentId) {
          issues.push(
            `Parent mismatch for '${entityId}': cache says '${node.parentId}', joint says '${joint.parentId}'`
          );
        }
      }

      // Check children exist
      for (const childId of node.children) {
        if (!this.#adjacencyCache.has(childId)) {
          issues.push(`Child '${childId}' of '${entityId}' not in cache`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export default AnatomyCacheManager;
