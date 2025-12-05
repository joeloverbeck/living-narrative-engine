import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { AnatomyCacheManager } from './anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from './anatomyGraphAlgorithms.js';
import { ANATOMY_CONSTANTS } from './constants/anatomyConstants.js';
import { AnatomyQueryCache } from './cache/AnatomyQueryCache.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

export const LIMB_DETACHED_EVENT_ID = ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID;

export class BodyGraphService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {AnatomyCacheManager} */
  #cacheManager;
  /** @type {AnatomyQueryCache} */
  #queryCache;

  constructor({ entityManager, logger, eventDispatcher, queryCache }) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!eventDispatcher)
      throw new InvalidArgumentError('eventDispatcher is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#cacheManager = new AnatomyCacheManager({ logger });

    // Create query cache if not provided
    this.#queryCache = queryCache || new AnatomyQueryCache({ logger });
  }

  async buildAdjacencyCache(rootEntityId) {
    // Only build cache if it doesn't already exist for this root
    if (!this.#cacheManager.hasCacheForRoot(rootEntityId)) {
      await this.#cacheManager.buildCache(rootEntityId, this.#entityManager);
    }
  }

  async detachPart(partEntityId, options = {}) {
    const { cascade = true, reason = 'manual' } = options;

    this.#logger.debug(
      `BodyGraphService: Detaching part '${partEntityId}' (cascade: ${cascade})`
    );

    const joint = this.#entityManager.getComponentData(
      partEntityId,
      'anatomy:joint'
    );
    if (!joint) {
      throw new InvalidArgumentError(
        `Entity '${partEntityId}' has no joint component - cannot detach`
      );
    }

    const parentId = joint.parentId;
    const socketId = joint.socketId;
    const toDetach = cascade
      ? AnatomyGraphAlgorithms.getSubgraph(partEntityId, this.#cacheManager)
      : [partEntityId];

    await this.#entityManager.removeComponent(partEntityId, 'anatomy:joint');

    // Find the root of this anatomy to invalidate the correct cache
    const rootId = this.getAnatomyRoot(parentId);
    if (rootId) {
      this.#cacheManager.invalidateCacheForRoot(rootId);
      this.#queryCache.invalidateRoot(rootId);
    }
    await this.#eventDispatcher.dispatch(
      ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID,
      {
        detachedEntityId: partEntityId,
        parentEntityId: parentId,
        socketId: socketId,
        detachedCount: toDetach.length,
        reason: reason,
        timestamp: Date.now(),
      }
    );

    this.#logger.info(
      `BodyGraphService: Detached ${toDetach.length} entities from parent '${parentId}'`
    );

    return {
      detached: toDetach,
      parentId,
      socketId,
    };
  }

  findPartsByType(rootEntityId, partType) {
    // Check query cache first
    const cachedResult = this.#queryCache.getCachedFindPartsByType(
      rootEntityId,
      partType
    );
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    // Perform the query
    const result = AnatomyGraphAlgorithms.findPartsByType(
      rootEntityId,
      partType,
      this.#cacheManager
    );

    // Cache the result
    this.#queryCache.cacheFindPartsByType(rootEntityId, partType, result);

    return result;
  }

  getAnatomyRoot(partEntityId) {
    return AnatomyGraphAlgorithms.getAnatomyRoot(
      partEntityId,
      this.#cacheManager,
      this.#entityManager
    );
  }

  getPath(fromEntityId, toEntityId) {
    return AnatomyGraphAlgorithms.getPath(
      fromEntityId,
      toEntityId,
      this.#cacheManager
    );
  }

  getAllParts(bodyComponent, actorEntityId = null) {
    // Handle both full anatomy:body component and direct body structure
    let rootId = null;

    if (!bodyComponent) {
      this.#logger.debug(
        'BodyGraphService.getAllParts: No bodyComponent provided'
      );
      return [];
    }

    // Check if this is the full anatomy:body component with nested structure
    if (bodyComponent.body && bodyComponent.body.root) {
      rootId = bodyComponent.body.root;
      this.#logger.debug(
        `BodyGraphService.getAllParts: Found root ID in bodyComponent.body.root: ${rootId}`
      );
    }
    // Check if this is the direct body structure
    else if (bodyComponent.root) {
      rootId = bodyComponent.root;
      this.#logger.debug(
        `BodyGraphService.getAllParts: Found root ID in bodyComponent.root: ${rootId}`
      );
    }

    if (!rootId) {
      this.#logger.debug(
        'BodyGraphService.getAllParts: No root ID found in bodyComponent'
      );
      return [];
    }

    // If we have an actor entity ID and it's in the cache, use it as the starting point
    // This handles cases where the cache is built for the actor but bodyComponent
    // references the blueprint anatomy root ID
    let cacheRootId = rootId;
    const cacheSize = this.#cacheManager.size();
    if (actorEntityId && this.#cacheManager.has(actorEntityId)) {
      cacheRootId = actorEntityId;
      this.#logger.info(
        `BodyGraphService.getAllParts: Actor '${actorEntityId}' -> Using actor as cache root (blueprint root was '${rootId}', cache size: ${cacheSize})`
      );
    } else {
      this.#logger.info(
        `BodyGraphService.getAllParts: Actor '${actorEntityId}' -> Using blueprint root '${rootId}' as cache root (actor not in cache, cache size: ${cacheSize})`
      );
    }

    // Check query cache first
    const cachedResult = this.#queryCache.getCachedGetAllParts(cacheRootId);
    if (cachedResult !== undefined) {
      this.#logger.info(
        `BodyGraphService.getAllParts: CACHE HIT for cache root '${cacheRootId}': returning ${cachedResult.length} parts [${cachedResult.slice(0, 3).join(', ')}${cachedResult.length > 3 ? '...' : ''}]`
      );
      return cachedResult;
    } else {
      this.#logger.info(
        `BodyGraphService.getAllParts: CACHE MISS for cache root '${cacheRootId}': will query and cache`
      );
    }

    // Perform the query starting from the cache root
    const result = AnatomyGraphAlgorithms.getAllParts(
      cacheRootId,
      this.#cacheManager,
      this.#entityManager
    );

    this.#logger.info(
      `BodyGraphService.getAllParts: AnatomyGraphAlgorithms returned ${result.length} parts for cache root '${cacheRootId}': [${result.slice(0, 5).join(', ')}${result.length > 5 ? '...' : ''}]`
    );

    // Cache the result
    this.#queryCache.cacheGetAllParts(cacheRootId, result);
    this.#logger.info(
      `BodyGraphService.getAllParts: Cached ${result.length} parts for cache root '${cacheRootId}'`
    );

    return result;
  }

  hasPartWithComponent(bodyComponent, componentId) {
    const allParts = this.getAllParts(bodyComponent);
    for (const partId of allParts) {
      const componentData = this.#entityManager.getComponentData(
        partId,
        componentId
      );
      // Check for both null and empty object (mock returns)
      if (
        componentData !== null &&
        componentData !== undefined &&
        !(
          typeof componentData === 'object' &&
          Object.keys(componentData).length === 0
        )
      ) {
        return true;
      }
    }
    return false;
  }

  hasPartWithComponentValue(
    bodyComponent,
    componentId,
    propertyPath,
    expectedValue
  ) {
    const allParts = this.getAllParts(bodyComponent);
    for (const partId of allParts) {
      const componentData = this.#entityManager.getComponentData(
        partId,
        componentId
      );
      if (componentData !== null) {
        const value = this.#getNestedProperty(componentData, propertyPath);
        if (value === expectedValue) return { found: true, partId };
      }
    }
    return { found: false };
  }

  #getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Gets body graph structure for an entity
   *
   * @param {string} entityId - Entity ID to get body graph for
   * @returns {Promise<{getAllPartIds: () => string[]}>} Body graph object with getAllPartIds method
   * @throws {InvalidArgumentError} If entityId is invalid
   * @throws {Error} If entity has no anatomy:body component
   */
  async getBodyGraph(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      throw new InvalidArgumentError(
        'Entity ID is required and must be a string'
      );
    }

    this.#logger.debug(
      `BodyGraphService.getBodyGraph: Getting body graph for entity '${entityId}'`
    );

    const bodyComponent = await this.#entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );

    if (!bodyComponent) {
      throw new Error(`Entity ${entityId} has no anatomy:body component`);
    }

    // Ensure cache is built for the actor entity
    await this.buildAdjacencyCache(entityId);

    return {
      getAllPartIds: () => this.getAllParts(bodyComponent, entityId),
      getConnectedParts: (partEntityId) => {
        // Get connected parts (children) from cache
        const node = this.#cacheManager.get(partEntityId);
        return node?.children || [];
      },
    };
  }

  /**
   * Gets anatomy data for an entity including recipe ID and root entity ID
   *
   * @param {string} entityId - Entity ID to get anatomy data for
   * @returns {Promise<{recipeId: string, rootEntityId: string}|null>} Anatomy data or null if not found
   * @throws {InvalidArgumentError} If entityId is invalid
   */
  async getAnatomyData(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      throw new InvalidArgumentError(
        'Entity ID is required and must be a string'
      );
    }

    this.#logger.debug(
      `BodyGraphService.getAnatomyData: Getting anatomy data for entity '${entityId}'`
    );

    const bodyComponent = await this.#entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );

    if (!bodyComponent) {
      this.#logger.debug(
        `BodyGraphService.getAnatomyData: Entity '${entityId}' has no anatomy:body component`
      );
      return null;
    }

    return {
      recipeId: bodyComponent.recipeId || null,
      rootEntityId: entityId,
    };
  }

  validateCache() {
    return this.#cacheManager.validateCache(this.#entityManager);
  }

  /**
   * Check if cache exists for a root entity
   *
   * @param {string} rootEntityId - The root entity ID to check
   * @returns {boolean} True if cache exists for this root
   */
  hasCache(rootEntityId) {
    return this.#cacheManager.hasCacheForRoot(rootEntityId);
  }

  /**
   * Get direct children of an entity from the cache
   *
   * @param {string} entityId - The entity ID to get children for
   * @returns {string[]} Array of child entity IDs
   */
  getChildren(entityId) {
    const node = this.#cacheManager.get(entityId);
    return node?.children || [];
  }

  /**
   * Gets the cache node for a specific entity ID.
   * The cache node contains partType (subType), parentId, socketId, and children.
   *
   * @param {string} entityId - The entity ID to look up
   * @returns {{entityId: string, partType: string, parentId: string|null, socketId: string|null, children: string[]}|undefined} The cache node or undefined if not in cache
   */
  getCacheNode(entityId) {
    return this.#cacheManager.get(entityId);
  }

  /**
   * Get parent of an entity from the cache
   *
   * @param {string} entityId - The entity ID to get parent for
   * @returns {string|null} Parent entity ID or null if no parent
   */
  getParent(entityId) {
    const node = this.#cacheManager.get(entityId);
    return node?.parentId || null;
  }

  /**
   * Get all ancestors of an entity (parent, grandparent, etc.)
   *
   * @param {string} entityId - The entity ID to get ancestors for
   * @returns {string[]} Array of ancestor entity IDs (nearest to farthest)
   */
  getAncestors(entityId) {
    const ancestors = [];
    let current = entityId;

    while (current) {
      const parent = this.getParent(current);
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get all descendants of an entity (children, grandchildren, etc.)
   *
   * @param {string} entityId - The entity ID to get descendants for
   * @returns {string[]} Array of descendant entity IDs
   */
  getAllDescendants(entityId) {
    // Use the existing getSubgraph method but exclude the root entity itself
    const subgraph = AnatomyGraphAlgorithms.getSubgraph(
      entityId,
      this.#cacheManager
    );
    return subgraph.filter((id) => id !== entityId);
  }
}

export default BodyGraphService;
