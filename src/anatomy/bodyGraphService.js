// src/anatomy/bodyGraphService.js

/**
 * @file Service for managing anatomy graphs at runtime (detachment, queries, etc.)
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../errors/entityNotFoundError.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * Event dispatched when a body part is detached
 */
export const LIMB_DETACHED_EVENT_ID = 'anatomy:limb_detached';

/**
 * @typedef {object} AnatomyNode
 * @property {string} entityId
 * @property {string} partType
 * @property {string} [parentId]
 * @property {string} [socketId]
 * @property {string[]} children
 */

/**
 * Service that manages anatomy graphs at runtime
 */
export class BodyGraphService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {Map<string, AnatomyNode>} */
  #adjacencyCache;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.eventDispatcher
   */
  constructor({ entityManager, logger, eventDispatcher }) {
    if (!entityManager) throw new InvalidArgumentError('entityManager is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!eventDispatcher) throw new InvalidArgumentError('eventDispatcher is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#adjacencyCache = new Map();
  }

  /**
   * Builds or rebuilds the adjacency cache for an anatomy graph
   * 
   * @param {string} rootEntityId - The root entity of the anatomy
   * @returns {void}
   */
  buildAdjacencyCache(rootEntityId) {
    this.#logger.debug(`BodyGraphService: Building adjacency cache for anatomy rooted at '${rootEntityId}'`);
    
    this.#adjacencyCache.clear();
    const visited = new Set();
    
    this.#buildCacheRecursive(rootEntityId, null, null, visited);
    
    this.#logger.info(`BodyGraphService: Built adjacency cache with ${this.#adjacencyCache.size} nodes`);
  }

  /**
   * Recursively builds the adjacency cache
   *
   * @param entityId
   * @param parentId
   * @param socketId
   * @param visited
   * @private
   */
  #buildCacheRecursive(entityId, parentId, socketId, visited) {
    if (visited.has(entityId)) return;
    visited.add(entityId);

    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      const anatomyPart = this.#entityManager.getComponentData(entityId, 'anatomy:part');
      
      // Create node
      const node = {
        entityId,
        partType: anatomyPart?.subType || 'unknown',
        parentId,
        socketId,
        children: []
      };
      
      this.#adjacencyCache.set(entityId, node);

      // Find all children (entities with joints pointing to this entity)
      const allEntities = this.#entityManager.getAllEntities();
      
      for (const childEntity of allEntities) {
        const joint = this.#entityManager.getComponentData(childEntity.id, 'anatomy:joint');
        if (joint && joint.parentId === entityId) {
          node.children.push(childEntity.id);
          this.#buildCacheRecursive(childEntity.id, entityId, joint.socketId, visited);
        }
      }
    } catch (error) {
      this.#logger.error(`Failed to build cache node for entity '${entityId}'`, { error });
    }
  }

  /**
   * Detaches a body part and its sub-graph from the anatomy
   * 
   * @param {string} partEntityId - The entity ID of the part to detach
   * @param {object} [options]
   * @param {boolean} [options.cascade] - Whether to detach the entire sub-graph
   * @param {string} [options.reason] - Reason for detachment (e.g., 'damage', 'amputation')
   * @returns {Promise<{detached: string[], parentId: string, socketId: string}>}
   */
  async detachPart(partEntityId, options = {}) {
    const { cascade = true, reason = 'manual' } = options;
    
    this.#logger.debug(`BodyGraphService: Detaching part '${partEntityId}' (cascade: ${cascade})`);

    // Get the joint component
    const joint = this.#entityManager.getComponentData(partEntityId, 'anatomy:joint');
    if (!joint) {
      throw new InvalidArgumentError(`Entity '${partEntityId}' has no joint component - cannot detach`);
    }

    const parentId = joint.parentId;
    const socketId = joint.socketId;

    // Get all entities to detach
    const toDetach = cascade ? this.#getSubgraph(partEntityId) : [partEntityId];
    
    // Remove joint component from the root of detachment
    await this.#entityManager.removeComponent(partEntityId, 'anatomy:joint');

    // Update adjacency cache
    const parentNode = this.#adjacencyCache.get(parentId);
    if (parentNode) {
      parentNode.children = parentNode.children.filter(id => id !== partEntityId);
    }
    
    // Remove detached nodes from cache if not cascading
    if (!cascade) {
      this.#adjacencyCache.delete(partEntityId);
    }

    // Dispatch event
    await this.#eventDispatcher.dispatch({
      type: LIMB_DETACHED_EVENT_ID,
      payload: {
        detachedEntityId: partEntityId,
        parentEntityId: parentId,
        socketId: socketId,
        detachedCount: toDetach.length,
        reason: reason,
        timestamp: Date.now()
      }
    });

    this.#logger.info(`BodyGraphService: Detached ${toDetach.length} entities from parent '${parentId}'`);

    return {
      detached: toDetach,
      parentId,
      socketId
    };
  }

  /**
   * Gets all entities in a sub-graph rooted at the given entity
   * 
   * @param {string} rootEntityId - The root of the sub-graph
   * @returns {string[]} All entity IDs in the sub-graph (including root)
   */
  #getSubgraph(rootEntityId) {
    const result = [];
    const stack = [rootEntityId];
    const visited = new Set();

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (visited.has(currentId)) continue;
      
      visited.add(currentId);
      result.push(currentId);

      const node = this.#adjacencyCache.get(currentId);
      if (node && node.children) {
        stack.push(...node.children);
      }
    }

    return result;
  }

  /**
   * Finds all body parts of a specific type in an anatomy
   * 
   * @param {string} rootEntityId - The root entity of the anatomy
   * @param {string} partType - The part type to search for
   * @returns {string[]} Entity IDs of matching parts
   */
  findPartsByType(rootEntityId, partType) {
    const result = [];
    const visited = new Set();
    const stack = [rootEntityId];

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = this.#adjacencyCache.get(currentId);
      if (!node) continue;

      if (node.partType === partType) {
        result.push(currentId);
      }

      if (node.children) {
        stack.push(...node.children);
      }
    }

    return result;
  }

  /**
   * Gets the anatomy root for a given body part
   * 
   * @param {string} partEntityId - Any entity ID in the anatomy
   * @returns {string|null} The root entity ID, or null if not found
   */
  getAnatomyRoot(partEntityId) {
    let currentId = partEntityId;
    const visited = new Set();

    while (currentId) {
      if (visited.has(currentId)) {
        this.#logger.warn(`Cycle detected while finding root for '${partEntityId}'`);
        return null;
      }
      visited.add(currentId);

      const node = this.#adjacencyCache.get(currentId);
      if (!node) {
        // Try to get from entity manager
        const joint = this.#entityManager.getComponentData(currentId, 'anatomy:joint');
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
    }

    return null;
  }

  /**
   * Checks if a part can be detached based on damage threshold
   * 
   * @param {string} partEntityId - The entity ID to check
   * @param {number} damageAmount - The amount of damage to apply
   * @returns {boolean} True if the part should detach
   */
  shouldDetachFromDamage(partEntityId, damageAmount) {
    const joint = this.#entityManager.getComponentData(partEntityId, 'anatomy:joint');
    if (!joint) return false;

    const threshold = joint.breakThreshold || 0;
    if (threshold === 0) return false; // 0 means unbreakable

    return damageAmount >= threshold;
  }

  /**
   * Gets a path from one body part to another
   * 
   * @param {string} fromEntityId - Starting entity
   * @param {string} toEntityId - Target entity
   * @returns {string[]|null} Path of entity IDs, or null if no path exists
   */
  getPath(fromEntityId, toEntityId) {
    if (fromEntityId === toEntityId) return [fromEntityId];

    // First, find their common ancestor
    const fromAncestors = this.#getAncestors(fromEntityId);
    const toAncestors = this.#getAncestors(toEntityId);
    
    let commonAncestor = null;
    for (const ancestor of fromAncestors) {
      if (toAncestors.includes(ancestor)) {
        commonAncestor = ancestor;
        break;
      }
    }

    if (!commonAncestor) return null;

    // Build path: from -> ancestor -> to
    const pathUp = this.#getPathToAncestor(fromEntityId, commonAncestor);
    const pathDown = this.#getPathToAncestor(toEntityId, commonAncestor).reverse();
    
    // Remove duplicate common ancestor
    if (pathDown.length > 0 && pathDown[0] === commonAncestor) {
      pathDown.shift();
    }

    return [...pathUp, ...pathDown];
  }

  /**
   * Gets all ancestors of an entity
   *
   * @param entityId
   * @private
   */
  #getAncestors(entityId) {
    const ancestors = [];
    let current = entityId;

    while (current) {
      ancestors.push(current);
      const node = this.#adjacencyCache.get(current);
      current = node?.parentId || null;
    }

    return ancestors;
  }

  /**
   * Gets path from entity to ancestor
   *
   * @param entityId
   * @param ancestorId
   * @private
   */
  #getPathToAncestor(entityId, ancestorId) {
    const path = [];
    let current = entityId;

    while (current && current !== ancestorId) {
      path.push(current);
      const node = this.#adjacencyCache.get(current);
      current = node?.parentId || null;
    }

    if (current === ancestorId) {
      path.push(ancestorId);
    }

    return path;
  }

  /**
   * Validates the integrity of the cached graph
   * 
   * @returns {{valid: boolean, issues: string[]}}
   */
  validateCache() {
    const issues = [];
    
    for (const [entityId, node] of this.#adjacencyCache.entries()) {
      // Check entity still exists
      try {
        this.#entityManager.getEntityInstance(entityId);
      } catch (error) {
        issues.push(`Cached entity '${entityId}' no longer exists`);
        continue;
      }

      // Check parent relationship
      if (node.parentId) {
        const joint = this.#entityManager.getComponentData(entityId, 'anatomy:joint');
        if (!joint) {
          issues.push(`Entity '${entityId}' in cache has parent but no joint component`);
        } else if (joint.parentId !== node.parentId) {
          issues.push(`Parent mismatch for '${entityId}': cache says '${node.parentId}', joint says '${joint.parentId}'`);
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
      issues
    };
  }
}

export default BodyGraphService;