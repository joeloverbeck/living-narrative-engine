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
   * @returns {Promise<void>}
   */
  async buildCache(rootEntityId, entityManager) {
    if (!rootEntityId)
      throw new InvalidArgumentError('rootEntityId is required');
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');

    this.#logger.debug(
      `AnatomyCacheManager: Building cache for anatomy rooted at '${rootEntityId}'`
    );

    // Only invalidate if this root already has cached entries
    // For new anatomies, we don't need to clear anything
    if (this.#adjacencyCache.has(rootEntityId)) {
      this.invalidateCacheForRoot(rootEntityId);
    }
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

    // SPECIAL HANDLING: If root entity has anatomy:body but no children in cache,
    // find and include the anatomy root part that isn't directly connected via joints
    await this.#handleDisconnectedActorAnatomy(
      rootEntityId,
      entityManager,
      visited,
      parentToChildren
    );

    this.#logger.debug(
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

      // Check both possible parent field names for compatibility
      const parentId = joint?.parentEntityId || joint?.parentId;

      if (parentId) {
        if (!parentToChildren.has(parentId)) {
          parentToChildren.set(parentId, []);
        }
        parentToChildren.get(parentId).push({
          childId: entity.id,
          socketId: joint.socketId || joint.childSocketId,
        });

        this.#logger.debug(
          `AnatomyCacheManager: Found joint relationship - parent: '${parentId}', child: '${entity.id}', socket: '${joint.socketId || joint.childSocketId}'`
        );
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
      const anatomyBody = entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );

      // Determine part type - handle both anatomy:part and anatomy:body components
      let partType = 'unknown';
      if (anatomyPart?.subType) {
        partType = anatomyPart.subType;
      } else if (anatomyBody) {
        partType = 'body_root';
      }

      // Debug logging
      this.#logger.debug(
        `AnatomyCacheManager: Entity '${entityId}' anatomy:part data: ${JSON.stringify(anatomyPart)}, anatomy:body data: ${JSON.stringify(anatomyBody)}`
      );

      // Create node
      const node = {
        entityId,
        partType,
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

      // Special handling for root entities with anatomy:body component
      // These may not have direct joint children but should still be included in traversal
      if (anatomyBody && children.length === 0) {
        // For body root entities, we need to find the actual body parts
        // by looking for entities that reference this body in their structure
        this.#findAndConnectBodyParts(
          entityId,
          entityManager,
          parentToChildren,
          visited,
          depth
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
   * Finds and connects body parts for a root entity with anatomy:body component
   * This handles cases where the root entity doesn't have direct joint relationships
   * but should still be connected to the anatomy structure
   *
   * @param {string} rootEntityId
   * @param {IEntityManager} entityManager
   * @param {Map<string, Array<{childId: string, socketId: string}>>} parentToChildren
   * @param {Set<string>} visited
   * @param {number} depth
   * @private
   */
  #findAndConnectBodyParts(
    rootEntityId,
    entityManager,
    parentToChildren,
    visited,
    depth
  ) {
    try {
      const anatomyBody = entityManager.getComponentData(
        rootEntityId,
        'anatomy:body'
      );
      if (!anatomyBody || !anatomyBody.structure) {
        return;
      }

      // Get the root part from the anatomy structure
      const rootPartId = anatomyBody.structure.rootPartId;
      if (rootPartId && !visited.has(rootPartId)) {
        this.#logger.debug(
          `AnatomyCacheManager: Connecting body root '${rootEntityId}' to root part '${rootPartId}'`
        );

        // Add the root part as a child of the body root
        // At this point rootNode is guaranteed to exist because the method
        // returns early when it is missing.
        const rootNode = this.#adjacencyCache.get(rootEntityId);
        rootNode.children.push(rootPartId);

        // Recursively process the anatomy structure starting from the root part
        this.#buildCacheRecursive(
          rootPartId,
          rootEntityId,
          'root_connection',
          entityManager,
          visited,
          depth + 1,
          parentToChildren
        );
      }
    } catch (error) {
      this.#logger.debug(
        `AnatomyCacheManager: Could not connect body parts for '${rootEntityId}': ${error.message}`
      );
    }
  }

  /**
   * Handles cases where an actor entity with anatomy:body is disconnected from anatomy parts
   * This occurs when the actor entity has no direct joint children but should be connected
   * to an anatomy structure
   *
   * @param {string} rootEntityId
   * @param {IEntityManager} entityManager
   * @param {Set<string>} visited
   * @param {Map<string, Array<{childId: string, socketId: string}>>} parentToChildren
   * @private
   */
  async #handleDisconnectedActorAnatomy(
    rootEntityId,
    entityManager,
    visited,
    parentToChildren
  ) {
    try {
      // Check if root entity has anatomy:body but no children in cache
      const rootNode = this.#adjacencyCache.get(rootEntityId);
      if (!rootNode || rootNode.children.length > 0) {
        return; // Root has children, no need for special handling
      }

      const anatomyBody = entityManager.getComponentData(
        rootEntityId,
        'anatomy:body'
      );
      if (!anatomyBody) {
        return; // Not an actor entity with anatomy:body
      }

      this.#logger.debug(
        `AnatomyCacheManager: Actor entity '${rootEntityId}' has anatomy:body but no joint children, searching for anatomy root`
      );

      // FIXED: Use the anatomy root from anatomy:body component instead of searching all anatomy parts
      // This prevents concurrent processing bugs where multiple actors share anatomy parts
      const anatomyRootId = anatomyBody.body?.root;

      if (!anatomyRootId) {
        this.#logger.warn(
          `AnatomyCacheManager: Actor '${rootEntityId}' has anatomy:body but no body.root field`
        );
        return;
      }

      // Verify this anatomy root actually exists and is an anatomy part
      const anatomyPart = entityManager.getComponentData(
        anatomyRootId,
        'anatomy:part'
      );

      if (!anatomyPart) {
        this.#logger.warn(
          `AnatomyCacheManager: Anatomy root '${anatomyRootId}' from actor '${rootEntityId}' is not an anatomy part`
        );
        return;
      }

      this.#logger.debug(
        `AnatomyCacheManager: Found anatomy root '${anatomyRootId}' from anatomy:body.body.root, adding to cache and connecting to actor`
      );

      // Add the anatomy root as a child of the actor
      rootNode.children.push(anatomyRootId);

      // Build the anatomy subtree starting from this root
      this.#buildCacheRecursive(
        anatomyRootId,
        rootEntityId,
        'anatomy_root_connection',
        entityManager,
        visited,
        1,
        parentToChildren
      );

      this.#logger.info(
        `AnatomyCacheManager: Successfully connected actor '${rootEntityId}' to its own anatomy root '${anatomyRootId}'`
      );
    } catch (error) {
      this.#logger.error(
        `AnatomyCacheManager: Failed to handle disconnected actor anatomy for '${rootEntityId}'`,
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
