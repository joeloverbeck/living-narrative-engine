import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { AnatomyCacheManager } from './anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from './anatomyGraphAlgorithms.js';
import { ANATOMY_CONSTANTS } from './constants/anatomyConstants.js';

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

  constructor({ entityManager, logger, eventDispatcher }) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!eventDispatcher)
      throw new InvalidArgumentError('eventDispatcher is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#cacheManager = new AnatomyCacheManager({ logger });
  }

  buildAdjacencyCache(rootEntityId) {
    this.#cacheManager.buildCache(rootEntityId, this.#entityManager);
  }

  async detachPart(partEntityId, options = {}) {
    const { cascade = true, reason = 'manual' } = options;

    this.#logger.debug(
      `BodyGraphService: Detaching part '${partEntityId}' (cascade: ${cascade})`
    );

    const joint = this.#entityManager.getComponentData(partEntityId, 'anatomy:joint');
    if (!joint) {
      throw new InvalidArgumentError(`Entity '${partEntityId}' has no joint component - cannot detach`);
    }

    const parentId = joint.parentId;
    const socketId = joint.socketId;
    const toDetach = cascade 
      ? AnatomyGraphAlgorithms.getSubgraph(partEntityId, this.#cacheManager) 
      : [partEntityId];

    await this.#entityManager.removeComponent(partEntityId, 'anatomy:joint');

    const parentNode = this.#cacheManager.get(parentId);
    if (parentNode) {
      parentNode.children = parentNode.children.filter((id) => id !== partEntityId);
    }

    if (!cascade) {
      this.#cacheManager.delete(partEntityId);
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
    return AnatomyGraphAlgorithms.findPartsByType(rootEntityId, partType, this.#cacheManager);
  }

  getAnatomyRoot(partEntityId) {
    return AnatomyGraphAlgorithms.getAnatomyRoot(partEntityId, this.#cacheManager, this.#entityManager);
  }

  getPath(fromEntityId, toEntityId) {
    return AnatomyGraphAlgorithms.getPath(fromEntityId, toEntityId, this.#cacheManager);
  }

  getAllParts(bodyComponent) {
    if (!bodyComponent || !bodyComponent.root) return [];
    return AnatomyGraphAlgorithms.getAllParts(bodyComponent.root, this.#cacheManager, this.#entityManager);
  }

  hasPartWithComponent(bodyComponent, componentId) {
    const allParts = this.getAllParts(bodyComponent);
    for (const partId of allParts) {
      const componentData = this.#entityManager.getComponentData(partId, componentId);
      if (componentData !== null) return true;
    }
    return false;
  }

  hasPartWithComponentValue(bodyComponent, componentId, propertyPath, expectedValue) {
    const allParts = this.getAllParts(bodyComponent);
    for (const partId of allParts) {
      const componentData = this.#entityManager.getComponentData(partId, componentId);
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