import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import AnatomyQueryCache from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

class InMemoryEntityManager {
  constructor() {
    /** @type {Set<string>} */
    this.entities = new Set();
    /** @type {Map<string, any>} */
    this.components = new Map();
    /** @type {Map<string, Map<string, true>>} */
    this.componentIndex = new Map();
  }

  #key(entityId, componentId) {
    return `${entityId}:::${componentId}`;
  }

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  #ensureEntity(entityId) {
    this.entities.add(entityId);
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    this.components.set(this.#key(entityId, componentId), this.#clone(data));
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, true);
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getComponentData(entityId, componentId) {
    if (!this.entities.has(entityId)) {
      return null;
    }
    const stored = this.components.get(this.#key(entityId, componentId));
    return stored === undefined ? null : this.#clone(stored);
  }

  async removeComponent(entityId, componentId) {
    this.components.delete(this.#key(entityId, componentId));
    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) {
      return [];
    }
    return Array.from(index.keys()).map((id) => ({ id }));
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) => this.getComponentData(entityId, componentId),
    };
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(true),
});

/**
 *
 * @param root0
 * @param root0.useCustomQueryCache
 * @param root0.autoBuildCache
 */
async function createBodyGraphFixture({
  useCustomQueryCache = false,
  autoBuildCache = true,
} = {}) {
  const entityManager = new InMemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();
  const queryCache = useCustomQueryCache
    ? new AnatomyQueryCache({ logger })
    : undefined;

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
  });

  const actorId = 'actor-1';
  const partIds = {
    torso: 'torso-1',
    head: 'head-1',
    leftArm: 'left-arm-1',
    leftHand: 'left-hand-1',
    leftFinger: 'left-finger-1',
    rightArm: 'right-arm-1',
    rightHand: 'right-hand-1',
    heart: 'heart-1',
  };

  entityManager.addComponent(actorId, 'anatomy:body', {
    recipeId: 'test:humanoid',
    body: { root: partIds.torso },
    structure: { rootPartId: partIds.torso },
  });

  entityManager.addComponent(partIds.torso, 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent(partIds.torso, 'anatomy:joint', {
    parentId: actorId,
    socketId: 'core',
  });
  entityManager.addComponent(partIds.torso, 'equipment:placeholder', {});

  entityManager.addComponent(partIds.head, 'anatomy:part', { subType: 'head' });
  entityManager.addComponent(partIds.head, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'neck',
  });

  entityManager.addComponent(partIds.leftArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(partIds.leftArm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'left-shoulder',
  });
  entityManager.addComponent(partIds.leftArm, 'anatomy:status', {
    posture: { state: 'raised' },
  });

  entityManager.addComponent(partIds.leftHand, 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent(partIds.leftHand, 'anatomy:joint', {
    parentId: partIds.leftArm,
    socketId: 'left-wrist',
  });
  entityManager.addComponent(partIds.leftHand, 'equipment:grip', {
    itemId: 'sword-1',
    quality: 'legendary',
  });

  entityManager.addComponent(partIds.leftFinger, 'anatomy:part', {
    subType: 'finger',
  });
  entityManager.addComponent(partIds.leftFinger, 'anatomy:joint', {
    parentId: partIds.leftHand,
    socketId: 'index',
  });

  entityManager.addComponent(partIds.rightArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(partIds.rightArm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'right-shoulder',
  });

  entityManager.addComponent(partIds.rightHand, 'anatomy:part', {
    subType: 'hand',
  });
  entityManager.addComponent(partIds.rightHand, 'anatomy:joint', {
    parentId: partIds.rightArm,
    socketId: 'right-wrist',
  });

  entityManager.addComponent(partIds.heart, 'anatomy:part', { subType: 'heart' });
  entityManager.addComponent(partIds.heart, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'chest',
  });

  const bodyComponent = entityManager.getComponentData(actorId, 'anatomy:body');

  if (autoBuildCache) {
    await service.buildAdjacencyCache(actorId);
  }

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    actorId,
    partIds,
    bodyComponent,
    queryCache: queryCache ?? null,
  };
}

describe('BodyGraphService cache workflow integration', () => {
  /** @type {Awaited<ReturnType<typeof createBodyGraphFixture>>} */
  let fixture;

  beforeEach(async () => {
    fixture = await createBodyGraphFixture();
  });

  it('builds caches, traverses anatomy, and reuses cached query results', () => {
    const { service, bodyComponent, actorId, partIds, entityManager } = fixture;

    expect(service.hasCache(actorId)).toBe(true);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);

    const blueprintResult = service.getAllParts(bodyComponent);
    expect(blueprintResult).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.leftFinger,
        partIds.rightArm,
        partIds.rightHand,
        partIds.head,
        partIds.heart,
      ]),
    );

    const fromActor = service.getAllParts(bodyComponent, actorId);
    expect(fromActor).toEqual(
      expect.arrayContaining([
        actorId,
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.leftFinger,
        partIds.rightArm,
        partIds.rightHand,
        partIds.head,
        partIds.heart,
      ]),
    );

    const cachedFromActor = service.getAllParts(bodyComponent, actorId);
    expect(cachedFromActor).toBe(fromActor);

    const fallbackRoot = service.getAllParts(bodyComponent, 'unknown-actor');
    expect(fallbackRoot).toEqual(blueprintResult);

    const algorithmSpy = jest.spyOn(
      AnatomyGraphAlgorithms,
      'findPartsByType',
    );

    const firstArms = service.findPartsByType(actorId, 'arm');
    expect(firstArms).toEqual(
      expect.arrayContaining([partIds.leftArm, partIds.rightArm]),
    );

    const cachedArms = service.findPartsByType(actorId, 'arm');
    expect(cachedArms).toBe(firstArms);
    expect(algorithmSpy).toHaveBeenCalledTimes(1);

    algorithmSpy.mockRestore();

    expect(service.getAnatomyRoot(partIds.leftFinger)).toBe(actorId);
    expect(service.getPath(partIds.leftFinger, partIds.rightHand)).toEqual([
      partIds.leftFinger,
      partIds.leftHand,
      partIds.leftArm,
      partIds.torso,
      partIds.rightArm,
      partIds.rightHand,
    ]);

    expect(service.getChildren(partIds.leftArm)).toEqual(
      expect.arrayContaining([partIds.leftHand]),
    );
    expect(service.getChildren('missing-node')).toEqual([]);
    expect(service.getParent(partIds.leftHand)).toBe(partIds.leftArm);
    expect(service.getParent('missing-node')).toBeNull();
    expect(service.getAncestors(partIds.leftFinger)).toEqual([
      partIds.leftHand,
      partIds.leftArm,
      partIds.torso,
      actorId,
    ]);
    expect(service.getAllDescendants(actorId)).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.leftFinger,
        partIds.rightArm,
        partIds.rightHand,
        partIds.head,
        partIds.heart,
      ]),
    );

    expect(service.hasPartWithComponent(bodyComponent, 'equipment:grip')).toBe(
      true,
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'equipment:placeholder'),
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.state',
        'raised',
      ),
    ).toEqual({ found: true, partId: partIds.leftArm });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.intent',
        'combat',
      ),
    ).toEqual({ found: false });

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(Array.isArray(validation.issues)).toBe(true);

    expect(service.hasCache('ghost-root')).toBe(false);

    expect(
      entityManager.getComponentData(partIds.leftHand, 'equipment:grip'),
    ).toEqual({ itemId: 'sword-1', quality: 'legendary' });
  });

  it('invalidates caches and query results after detaching parts', async () => {
    const { service, actorId, partIds } = fixture;

    const initialArms = service.findPartsByType(actorId, 'arm');
    expect(initialArms).toEqual(
      expect.arrayContaining([partIds.leftArm, partIds.rightArm]),
    );

    const algorithmSpy = jest.spyOn(
      AnatomyGraphAlgorithms,
      'findPartsByType',
    );

    await service.detachPart(partIds.leftArm, {
      cascade: true,
      reason: 'integration-test',
    });

    expect(service.hasCache(actorId)).toBe(false);

    await service.buildAdjacencyCache(actorId);

    const refreshedArms = service.findPartsByType(actorId, 'arm');
    expect(refreshedArms).toEqual([partIds.rightArm]);
    expect(algorithmSpy).toHaveBeenCalled();
    algorithmSpy.mockRestore();

    const dispatcherCalls = fixture.eventDispatcher.dispatch.mock.calls;
    expect(dispatcherCalls).toHaveLength(1);
    const [eventId, payload] = dispatcherCalls[0];
    expect(eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(payload.detachedEntityId).toBe(partIds.leftArm);
    expect(payload.parentEntityId).toBe(partIds.torso);
    expect(payload.detachedCount).toBeGreaterThan(1);
    expect(payload.reason).toBe('integration-test');

    const rightHandParent = service.getParent(partIds.rightHand);
    expect(rightHandParent).toBe(partIds.rightArm);
  });

  it('supports non-cascade detachment and surfaces errors for invalid inputs', async () => {
    const { service, actorId, partIds, entityManager } = fixture;

    entityManager.addComponent('floating-part', 'anatomy:part', {
      subType: 'mystery',
    });

    await expect(
      service.detachPart('floating-part'),
    ).rejects.toThrow(InvalidArgumentError);

    const result = await service.detachPart(partIds.rightHand, {
      cascade: false,
      reason: 'manual-check',
    });

    expect(result).toEqual({
      detached: [partIds.rightHand],
      parentId: partIds.rightArm,
      socketId: 'right-wrist',
    });

    const dispatcherCalls = fixture.eventDispatcher.dispatch.mock.calls;
    const lastCall = dispatcherCalls[dispatcherCalls.length - 1];
    expect(lastCall[0]).toBe(LIMB_DETACHED_EVENT_ID);
    expect(lastCall[1].detachedCount).toBe(1);
    expect(lastCall[1].reason).toBe('manual-check');

    await service.buildAdjacencyCache(actorId);
    expect(service.getChildren(partIds.rightArm)).not.toContain(
      partIds.rightHand,
    );
  });

  it('builds body graphs on demand and returns anatomy metadata', async () => {
    const freshFixture = await createBodyGraphFixture({
      useCustomQueryCache: true,
      autoBuildCache: false,
    });
    const { service, actorId, partIds, entityManager, logger, queryCache } =
      freshFixture;

    entityManager.addComponent('mysterious-actor', 'core:name', {
      text: 'Ghost',
    });

    await expect(service.getBodyGraph(123)).rejects.toThrow(
      InvalidArgumentError,
    );

    await expect(service.getBodyGraph('mysterious-actor')).rejects.toThrow(
      /has no anatomy:body component/,
    );

    const bodyGraph = await service.getBodyGraph(actorId);
    const partIdsFromGraph = bodyGraph.getAllPartIds();
    expect(partIdsFromGraph).toEqual(
      expect.arrayContaining([
        actorId,
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.leftFinger,
        partIds.rightArm,
        partIds.rightHand,
        partIds.head,
        partIds.heart,
      ]),
    );
    expect(bodyGraph.getConnectedParts(partIds.leftHand)).toEqual([
      partIds.leftFinger,
    ]);

    const anatomyData = await service.getAnatomyData(actorId);
    expect(anatomyData).toEqual({
      recipeId: 'test:humanoid',
      rootEntityId: actorId,
    });

    await expect(service.getAnatomyData('ghost')).resolves.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Entity 'ghost' has no anatomy:body component"),
    );

    expect(service.hasCache(actorId)).toBe(true);

    const cacheStats = queryCache.getStats();
    expect(cacheStats.size).toBeGreaterThanOrEqual(0);

    await service.buildAdjacencyCache(actorId);
    expect(service.hasCache(actorId)).toBe(true);
  });
});
