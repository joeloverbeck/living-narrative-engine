import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';

/**
 * @class InMemoryEntityManager
 * @description Minimal entity manager implementation that satisfies the subset of the API used by BodyGraphService.
 */
class InMemoryEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.entities = new Map();
    /** @type {Map<string, Set<string>>} */
    this.componentIndex = new Map();
  }

  /**
   * @description Ensures a map exists for an entity before storing component data.
   * @param {string} entityId - Unique identifier of the entity.
   * @returns {void}
   */
  #ensureEntity(entityId) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
  }

  /**
   * @description Creates a deep clone of component payloads to preserve immutability guarantees.
   * @param {any} value - Arbitrary payload associated with a component.
   * @returns {any} Cloned payload.
   */
  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * @description Adds or replaces component data for a specific entity.
   * @param {string} entityId - Entity receiving the component data.
   * @param {string} componentId - Component type identifier.
   * @param {any} data - Component payload to persist.
   * @returns {void}
   */
  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    const entityComponents = this.entities.get(entityId);
    entityComponents.set(componentId, this.#clone(data));

    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Set());
    }
    this.componentIndex.get(componentId).add(entityId);
  }

  /**
   * @description Retrieves a component payload for an entity if it exists.
   * @param {string} entityId - Entity identifier to inspect.
   * @param {string} componentId - Component type identifier to locate.
   * @returns {any} Stored component payload or null when absent.
   */
  getComponentData(entityId, componentId) {
    const entityComponents = this.entities.get(entityId);
    if (!entityComponents) {
      return null;
    }
    const value = entityComponents.get(componentId);
    return value === undefined ? null : this.#clone(value);
  }

  /**
   * @description Removes a component payload from an entity.
   * @param {string} entityId - Entity identifier containing the component.
   * @param {string} componentId - Component type identifier to delete.
   * @returns {Promise<void>} Resolves once the component is removed.
   */
  async removeComponent(entityId, componentId) {
    const entityComponents = this.entities.get(entityId);
    if (entityComponents) {
      entityComponents.delete(componentId);
    }
    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }
  }

  /**
   * @description Lists all entities that contain a given component type.
   * @param {string} componentId - Component identifier to match.
   * @returns {Array<{id: string}>} Collection of entity references.
   */
  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) {
      return [];
    }
    return Array.from(index.values()).map((entityId) => ({ id: entityId }));
  }

  /**
   * @description Retrieves a lightweight entity instance wrapper for algorithms that expect the real interface.
   * @param {string} entityId - Identifier of the entity to retrieve.
   * @returns {{ id: string, getComponentData: (componentId: string) => any }} Wrapper exposing the expected methods.
   */
  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) => this.getComponentData(entityId, componentId),
      hasComponent: (componentId) => this.getComponentData(entityId, componentId) !== null,
    };
  }
}

/**
 * @description Creates a logger that records all messages grouped by severity.
 * @param {string} [prefix] - Label inserted into recorded log messages for easier debugging.
 * @returns {{ messages: Array<{ level: string, text: string }>, debug: Function, info: Function, warn: Function, error: Function }}
 */
function createLogger(prefix = 'integration') {
  const messages = [];
  const capture = (level) => (...args) => {
    const rendered = args
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');
    messages.push({ level, text: `[${prefix}] ${rendered}` });
  };
  return {
    messages,
    debug: capture('debug'),
    info: capture('info'),
    warn: capture('warn'),
    error: capture('error'),
  };
}

/**
 * @description Builds an event dispatcher that records every dispatched payload.
 * @param {string} [name] - Identifier stored alongside dispatched payloads.
 * @returns {{ events: Array<{ eventId: string, payload: any }>, dispatch: (eventId: string, payload: any) => Promise<boolean> }}
 */
function createEventDispatcher(name = 'dispatcher') {
  return {
    events: [],
    async dispatch(eventId, payload) {
      this.events.push({ eventId, payload: { ...payload, dispatcher: name } });
      return true;
    },
  };
}

/**
 * @description Sets up a BodyGraphService instance backed by a rich anatomy graph for integration testing.
 * @param {object} [options] - Optional overrides for fixture creation.
 * @param {string} [options.dispatcherName] - Name assigned to the recording dispatcher.
 * @returns {{
 *   service: BodyGraphService,
 *   entityManager: InMemoryEntityManager,
 *   logger: ReturnType<typeof createLogger>,
 *   eventDispatcher: ReturnType<typeof createEventDispatcher>,
 *   actorId: string,
 *   parts: Record<string, string>,
 *   bodyComponent: object,
 *   directStructure: object,
 *   loosePartId: string
 * }} Prepared integration test context.
 */
function setupBodyGraphService(options = {}) {
  const { dispatcherName = 'dispatcher' } = options;
  const entityManager = new InMemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher(dispatcherName);

  const actorId = 'actor-1';
  const parts = {
    torso: 'torso-1',
    head: 'head-1',
    leftArm: 'left-arm-1',
    leftHand: 'left-hand-1',
    rightArm: 'right-arm-1',
    rightHand: 'right-hand-1',
    heart: 'heart-1',
  };
  const loosePartId = 'loose-part-1';

  const bodyComponent = {
    recipeId: 'test:humanoid',
    body: { root: parts.torso },
    structure: {
      rootPartId: parts.torso,
    },
  };

  entityManager.addComponent(actorId, 'anatomy:body', bodyComponent);
  entityManager.addComponent(parts.torso, 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent(parts.torso, 'anatomy:joint', {
    parentId: actorId,
    socketId: 'core',
  });

  entityManager.addComponent(parts.head, 'anatomy:part', { subType: 'head' });
  entityManager.addComponent(parts.head, 'anatomy:joint', {
    parentId: parts.torso,
    socketId: 'neck',
  });
  entityManager.addComponent(parts.head, 'equipment:empty', {});

  entityManager.addComponent(parts.leftArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(parts.leftArm, 'anatomy:joint', {
    parentId: parts.torso,
    socketId: 'left-shoulder',
  });
  entityManager.addComponent(parts.leftArm, 'anatomy:status', {
    posture: { state: 'raised' },
  });
  entityManager.addComponent(parts.leftArm, 'core:description', {
    text: 'left arm ready',
  });

  entityManager.addComponent(parts.leftHand, 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent(parts.leftHand, 'anatomy:joint', {
    parentId: parts.leftArm,
    socketId: 'left-wrist',
  });
  entityManager.addComponent(parts.leftHand, 'equipment:grip', {
    strength: 'firm',
  });

  entityManager.addComponent(parts.rightArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(parts.rightArm, 'anatomy:joint', {
    parentId: parts.torso,
    socketId: 'right-shoulder',
  });

  entityManager.addComponent(parts.rightHand, 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent(parts.rightHand, 'anatomy:joint', {
    parentId: parts.rightArm,
    socketId: 'right-wrist',
  });

  entityManager.addComponent(parts.heart, 'anatomy:part', { subType: 'organ' });
  entityManager.addComponent(parts.heart, 'anatomy:joint', {
    parentId: parts.torso,
    socketId: 'chest',
  });

  entityManager.addComponent(loosePartId, 'anatomy:part', { subType: 'horn' });

  const directStructure = { root: parts.torso };

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    actorId,
    parts,
    bodyComponent,
    directStructure,
    loosePartId,
  };
}

describe('BodyGraphService cache orchestration integration', () => {
  /** @type {ReturnType<typeof setupBodyGraphService>} */
  let context;

  beforeEach(() => {
    context = setupBodyGraphService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires fundamental dependencies to be provided', () => {
    const { entityManager, logger, eventDispatcher } = context;
    expect(
      () =>
        new BodyGraphService({
          logger,
          eventDispatcher,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new BodyGraphService({
          entityManager,
          eventDispatcher,
        })
    ).toThrow(InvalidArgumentError);
    expect(
      () =>
        new BodyGraphService({
          entityManager,
          logger,
        })
    ).toThrow(InvalidArgumentError);
  });

  it('performs end-to-end anatomy graph operations with cache invalidation', async () => {
    const {
      service,
      entityManager,
      eventDispatcher,
      actorId,
      parts,
      bodyComponent,
      directStructure,
      loosePartId,
    } = context;

    const expectedFullSet = new Set([
      actorId,
      parts.torso,
      parts.head,
      parts.leftArm,
      parts.leftHand,
      parts.rightArm,
      parts.rightHand,
      parts.heart,
    ]);

    const preCacheSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');
    const initialTraversal = service.getAllParts(bodyComponent, actorId);
    expect(new Set(initialTraversal)).toEqual(new Set([...expectedFullSet].filter((id) => id !== actorId)));
    expect(preCacheSpy).toHaveBeenCalledTimes(1);
    preCacheSpy.mockRestore();

    const buildSpy = jest.spyOn(AnatomyCacheManager.prototype, 'buildCache');
    await service.buildAdjacencyCache(actorId);
    expect(buildSpy).toHaveBeenCalledTimes(1);
    await service.buildAdjacencyCache(actorId);
    expect(buildSpy).toHaveBeenCalledTimes(1);
    buildSpy.mockRestore();

    expect(service.hasCache(actorId)).toBe(true);
    expect(service.hasCache('missing-root')).toBe(false);

    expect(service.getChildren(actorId)).toEqual([parts.torso]);
    expect(service.getChildren(parts.torso)).toEqual(
      expect.arrayContaining([
        parts.head,
        parts.leftArm,
        parts.rightArm,
        parts.heart,
      ])
    );
    expect(service.getChildren('unknown')).toEqual([]);

    expect(service.getParent(parts.torso)).toBe(actorId);
    expect(service.getParent(parts.leftArm)).toBe(parts.torso);
    expect(service.getParent('ghost')).toBeNull();

    expect(service.getAncestors(parts.leftHand)).toEqual([
      parts.leftArm,
      parts.torso,
      actorId,
    ]);
    expect(service.getAncestors('ghost')).toEqual([]);

    expect(service.getAllDescendants(parts.leftArm)).toEqual([parts.leftHand]);
    expect(new Set(service.getAllDescendants(parts.torso))).toEqual(
      new Set([
        parts.leftArm,
        parts.leftHand,
        parts.rightArm,
        parts.rightHand,
        parts.head,
        parts.heart,
      ])
    );
    expect(service.getAllDescendants('ghost')).toEqual([]);

    const cachedPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');
    const cachedTraversal = service.getAllParts(bodyComponent, actorId);
    expect(new Set(cachedTraversal)).toEqual(expectedFullSet);
    const cachedTraversalAgain = service.getAllParts(bodyComponent, actorId);
    expect(cachedTraversalAgain).toEqual(cachedTraversal);
    expect(cachedPartsSpy).toHaveBeenCalledTimes(1);
    cachedPartsSpy.mockRestore();

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);
    expect(new Set(service.getAllParts(directStructure))).toEqual(
      new Set([
        parts.torso,
        parts.head,
        parts.leftArm,
        parts.leftHand,
        parts.rightArm,
        parts.rightHand,
        parts.heart,
      ])
    );
    expect(new Set(service.getAllParts(bodyComponent))).toEqual(
      new Set([
        parts.torso,
        parts.head,
        parts.leftArm,
        parts.leftHand,
        parts.rightArm,
        parts.rightHand,
        parts.heart,
      ])
    );

    const findPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');
    const armsFirst = service.findPartsByType(actorId, 'arm');
    expect(new Set(armsFirst)).toEqual(new Set([parts.leftArm, parts.rightArm]));
    const armsSecond = service.findPartsByType(actorId, 'arm');
    expect(armsSecond).toEqual(armsFirst);
    expect(findPartsSpy).toHaveBeenCalledTimes(1);
    findPartsSpy.mockRestore();

    expect(service.hasPartWithComponent(bodyComponent, 'equipment:grip')).toBe(true);
    expect(service.hasPartWithComponent(bodyComponent, 'equipment:empty')).toBe(false);
    expect(service.hasPartWithComponent(bodyComponent, 'made:up')).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.state',
        'raised'
      )
    ).toEqual({ found: true, partId: parts.leftArm });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.state',
        'lowered'
      )
    ).toEqual({ found: false });

    const graph = await service.getBodyGraph(actorId);
    expect(new Set(graph.getAllPartIds())).toEqual(expectedFullSet);
    expect(graph.getConnectedParts(parts.leftArm)).toEqual([parts.leftHand]);
    expect(graph.getConnectedParts('ghost')).toEqual([]);
    await expect(service.getBodyGraph(undefined)).rejects.toThrow(InvalidArgumentError);
    await expect(service.getBodyGraph('unknown-actor')).rejects.toThrow('has no anatomy:body component');

    await expect(service.getAnatomyData(undefined)).rejects.toThrow(InvalidArgumentError);
    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: 'test:humanoid',
      rootEntityId: actorId,
    });
    await expect(service.getAnatomyData('ghost')).resolves.toBeNull();

    expect(service.getAnatomyRoot(parts.leftHand)).toBe(actorId);
    expect(service.getAnatomyRoot('ghost')).toBe('ghost');
    expect(service.getAnatomyRoot('')).toBeNull();

    expect(service.getPath(parts.leftHand, parts.leftHand)).toEqual([parts.leftHand]);
    expect(service.getPath(parts.leftHand, parts.head)).toEqual([
      parts.leftHand,
      parts.leftArm,
      parts.torso,
      parts.head,
    ]);
    expect(service.getPath(parts.leftHand, 'ghost')).toBeNull();

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);

    await expect(service.detachPart(loosePartId)).rejects.toThrow(InvalidArgumentError);

    service.getAllParts(bodyComponent, actorId);
    service.findPartsByType(actorId, 'arm');

    const cascadeResult = await service.detachPart(parts.leftArm, {
      reason: 'injury',
    });
    expect(new Set(cascadeResult.detached)).toEqual(
      new Set([parts.leftArm, parts.leftHand])
    );
    expect(cascadeResult.parentId).toBe(parts.torso);
    expect(cascadeResult.socketId).toBe('left-shoulder');

    const firstEvent = eventDispatcher.events.at(-1);
    expect(firstEvent).toMatchObject({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({
        detachedEntityId: parts.leftArm,
        parentEntityId: parts.torso,
        socketId: 'left-shoulder',
        detachedCount: 2,
        reason: 'injury',
      }),
    });
    expect(typeof firstEvent.payload.timestamp).toBe('number');
    expect(service.hasCache(actorId)).toBe(false);

    entityManager.addComponent(parts.leftArm, 'anatomy:joint', {
      parentId: parts.torso,
      socketId: 'left-shoulder',
    });

    await service.buildAdjacencyCache(actorId);
    const postDetachPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');
    const repopulated = service.getAllParts(bodyComponent, actorId);
    expect(new Set(repopulated)).toEqual(expectedFullSet);
    expect(postDetachPartsSpy).toHaveBeenCalledTimes(1);
    postDetachPartsSpy.mockRestore();

    const postDetachFindSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');
    const refreshedArms = service.findPartsByType(actorId, 'arm');
    expect(new Set(refreshedArms)).toEqual(new Set([parts.leftArm, parts.rightArm]));
    expect(postDetachFindSpy).toHaveBeenCalledTimes(1);
    postDetachFindSpy.mockRestore();

    const precisionResult = await service.detachPart(parts.rightArm, {
      cascade: false,
      reason: 'precision',
    });
    expect(precisionResult.detached).toEqual([parts.rightArm]);
    expect(precisionResult.parentId).toBe(parts.torso);

    const secondEvent = eventDispatcher.events.at(-1);
    expect(secondEvent.payload.detachedCount).toBe(1);
    expect(secondEvent.payload.reason).toBe('precision');

    await service.buildAdjacencyCache(actorId);
    expect(service.getChildren(parts.torso)).not.toEqual(
      expect.arrayContaining([parts.rightArm])
    );
  });
});
