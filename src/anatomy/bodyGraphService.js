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

  buildAdjacencyCache(rootEntityId) {
    if (this.#cacheManager.hasCacheForRoot(rootEntityId)) {
      const { valid } = this.#cacheManager.validateCache(this.#entityManager);
      if (valid) {
        return;
      }
      this.#cacheManager.invalidateCacheForRoot(rootEntityId);
    }
    this.#cacheManager.buildCache(rootEntityId, this.#entityManager);
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
    await this.#eventDispatcher.dispatch({
      type: ANATOMY_CONSTANTS.LIMB_DETACHED_EVENT_ID,
      payload: {
        detachedEntityId: partEntityId,
        parentEntityId: parentId,
        socketId: socketId,
        detachedCount: toDetach.length,
        reason: reason,
        timestamp: Date.now(),
      },
    });

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

  getAllParts(bodyComponent) {
    // Handle both full anatomy:body component and direct body structure
    let rootId = null;

    if (!bodyComponent) return [];

    // Check if this is the full anatomy:body component with nested structure
    if (bodyComponent.body && bodyComponent.body.root) {
      rootId = bodyComponent.body.root;
    }
    // Check if this is the direct body structure
    else if (bodyComponent.root) {
      rootId = bodyComponent.root;
    }

    if (!rootId) return [];

    // Check query cache first
    const cachedResult = this.#queryCache.getCachedGetAllParts(rootId);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    // Perform the query
    const result = AnatomyGraphAlgorithms.getAllParts(
      rootId,
      this.#cacheManager,
      this.#entityManager
    );

    // Cache the result
    this.#queryCache.cacheGetAllParts(rootId, result);

    return result;
  }

  hasPartWithComponent(bodyComponent, componentId) {
    const allParts = this.getAllParts(bodyComponent);
    for (const partId of allParts) {
      const componentData = this.#entityManager.getComponentData(
        partId,
        componentId
      );
      if (componentData !== null) return true;
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

  validateCache() {
    return this.#cacheManager.validateCache(this.#entityManager);
  }
}

export default BodyGraphService;
