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

    this.clear();
    const visited = new Set();

    this.#buildCacheRecursive(
      rootEntityId,
      null,
      null,
      entityManager,
      visited,
      0
    );

    this.#logger.info(
      `AnatomyCacheManager: Built cache with ${this.#adjacencyCache.size} nodes`
    );
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
   * @private
   */
  #buildCacheRecursive(
    entityId,
    parentId,
    socketId,
    entityManager,
    visited,
    depth
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

      // Create node
      const node = {
        entityId,
        partType: anatomyPart?.type || 'unknown',
        parentId,
        socketId,
        children: [],
      };

      this.#adjacencyCache.set(entityId, node);

      // Find all children (entities with joints pointing to this entity)
      const entitiesWithJoints =
        entityManager.getEntitiesWithComponent('anatomy:joint');

      for (const childEntity of entitiesWithJoints) {
        const joint = entityManager.getComponentData(
          childEntity.id,
          'anatomy:joint'
        );
        if (joint && joint.parentId === entityId) {
          node.children.push(childEntity.id);
          this.#buildCacheRecursive(
            childEntity.id,
            entityId,
            joint.socketId,
            entityManager,
            visited,
            depth + 1
          );
        }
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
