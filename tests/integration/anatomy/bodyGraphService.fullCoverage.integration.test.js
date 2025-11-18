import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * Minimal in-memory entity manager tailored for BodyGraphService integration tests.
 */
class InMemoryEntityManager {
  constructor() {
    /** @type {Set<string>} */
    this.entities = new Set();
    /** @type {Map<string, any>} */
    this.components = new Map();
    /** @type {Map<string, Map<string, { id: string }>>} */
    this.componentIndex = new Map();
  }

  #key(entityId, componentId) {
    return `${entityId}:::${componentId}`;
  }

  #clone(value) {
    if (value === null || value === undefined) return value;
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
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
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getComponentData(entityId, componentId) {
    const stored = this.components.get(this.#key(entityId, componentId));
    return this.#clone(stored ?? null);
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
    if (!index) return [];
    return Array.from(index.values()).map((entry) => ({ ...entry }));
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
  dispatch: jest.fn().mockResolvedValue(undefined),
});

/**
 *
 */
async function createAnatomyFixture() {
  const entityManager = new InMemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const actorId = 'actor-1';
  const partIds = {
    torso: 'torso-1',
    head: 'head-1',
    leftArm: 'left-arm-1',
    leftHand: 'left-hand-1',
    rightArm: 'right-arm-1',
    heart: 'heart-1',
  };

  entityManager.addComponent(actorId, 'anatomy:body', {
    recipeId: 'test:humanoid',
    body: { root: partIds.torso },
    structure: { rootPartId: partIds.torso },
  });
  entityManager.addComponent(actorId, 'core:name', { text: 'Test Actor' });

  entityManager.addComponent(partIds.torso, 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent(partIds.torso, 'anatomy:joint', {
    parentId: actorId,
    socketId: 'core',
  });
  entityManager.addComponent(partIds.torso, 'custom:metadata', {});

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

  entityManager.addComponent(partIds.rightArm, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(partIds.rightArm, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'right-shoulder',
  });
  entityManager.addComponent(partIds.rightArm, 'equipment:grip', {});

  entityManager.addComponent(partIds.heart, 'anatomy:part', { subType: 'heart' });
  entityManager.addComponent(partIds.heart, 'anatomy:joint', {
    parentId: partIds.torso,
    socketId: 'chest',
  });

  await service.buildAdjacencyCache(actorId);

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    actorId,
    partIds,
    bodyComponent: entityManager.getComponentData(actorId, 'anatomy:body'),
  };
}

describe('BodyGraphService integration full coverage', () => {
  let service;
  let entityManager;
  let logger;
  let eventDispatcher;
  let actorId;
  let partIds;
  let bodyComponent;

  beforeEach(async () => {
    ({
      service,
      entityManager,
      logger,
      eventDispatcher,
      actorId,
      partIds,
      bodyComponent,
    } = await createAnatomyFixture());
  });

  it('traverses and inspects anatomy graphs across cache layers', async () => {
    expect(await service.getAnatomyData(actorId)).toEqual({
      recipeId: 'test:humanoid',
      rootEntityId: actorId,
    });

    expect(service.hasCache(actorId)).toBe(true);
    await service.buildAdjacencyCache(actorId);

    const noComponentResult = service.getAllParts(null);
    expect(noComponentResult).toEqual([]);
    expect(
      logger.debug.mock.calls.some((call) =>
        call[0]?.includes('No bodyComponent provided'),
      ),
    ).toBe(true);

    const missingRootResult = service.getAllParts({ body: {} });
    expect(missingRootResult).toEqual([]);
    expect(
      logger.debug.mock.calls.some((call) =>
        call[0]?.includes('No root ID found'),
      ),
    ).toBe(true);

    const allPartsUsingActor = service.getAllParts(bodyComponent, actorId);
    expect(allPartsUsingActor).toEqual(
      expect.arrayContaining([
        actorId,
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ]),
    );

    const allPartsFromBlueprint = service.getAllParts(bodyComponent);
    expect(allPartsFromBlueprint).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ]),
    );

    const fallbackParts = service.getAllParts(bodyComponent, 'ghost-actor');
    expect(fallbackParts).toEqual(allPartsFromBlueprint);
    expect(
      logger.debug.mock.calls.some((call) =>
        call[0]?.includes(
          `Using blueprint root '${partIds.torso}' as cache root (actor 'ghost-actor' not in cache`,
        ),
      ),
    ).toBe(true);

    const cachedParts = service.getAllParts(bodyComponent, actorId);
    expect(cachedParts).toBe(allPartsUsingActor);
    expect(
      logger.debug.mock.calls.some((call) =>
        call[0]?.includes('Found cached result for root'),
      ),
    ).toBe(true);

    const path = service.getPath(partIds.leftHand, partIds.rightArm);
    expect(path).toEqual([
      partIds.leftHand,
      partIds.leftArm,
      partIds.torso,
      partIds.rightArm,
    ]);

    expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);

    expect(service.getChildren(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.leftArm,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ]),
    );
    expect(service.getChildren('unknown-node')).toEqual([]);
    expect(service.getParent(partIds.leftHand)).toBe(partIds.leftArm);
    expect(service.getParent('unknown-node')).toBeNull();

    expect(service.getAncestors(partIds.leftHand)).toEqual([
      partIds.leftArm,
      partIds.torso,
      actorId,
    ]);

    const descendants = service.getAllDescendants(actorId);
    expect(descendants).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ]),
    );

    expect(
      service.hasPartWithComponent(bodyComponent, 'equipment:grip'),
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'custom:metadata'),
    ).toBe(false);

    const nestedMatch = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:status',
      'posture.state',
      'raised',
    );
    expect(nestedMatch).toEqual({ found: true, partId: partIds.leftArm });

    const nestedMiss = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:status',
      'posture.state',
      'lowered',
    );
    expect(nestedMiss).toEqual({ found: false });

    const bodyGraph = await service.getBodyGraph(actorId);
    expect(bodyGraph.getAllPartIds()).toEqual(allPartsUsingActor);
    expect(bodyGraph.getConnectedParts(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.leftArm,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ]),
    );

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('detaches parts, invalidates caches, and logs outcomes', async () => {
    const cascadeResult = await service.detachPart(partIds.leftArm);
    expect(cascadeResult).toEqual({
      detached: [partIds.leftArm, partIds.leftHand],
      parentId: partIds.torso,
      socketId: 'left-shoulder',
    });

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.leftArm,
        parentEntityId: partIds.torso,
        detachedCount: 2,
        reason: 'manual',
      }),
    );
    expect(service.hasCache(actorId)).toBe(false);

    await service.buildAdjacencyCache(actorId);
    expect(service.getAllParts(bodyComponent, actorId)).not.toContain(
      partIds.leftArm,
    );

    await service.detachPart(partIds.rightArm, {
      cascade: false,
      reason: 'surgery',
    });

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.rightArm,
        detachedCount: 1,
        reason: 'surgery',
      }),
    );

    expect(
      logger.info.mock.calls.some((call) =>
        call[0]?.includes('Detached 2 entities'),
      ),
    ).toBe(true);
  });

  it('guards against invalid usage scenarios', async () => {
    expect(() =>
      new BodyGraphService({ logger, eventDispatcher }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      new BodyGraphService({ entityManager, eventDispatcher }),
    ).toThrow(InvalidArgumentError);
    expect(() =>
      new BodyGraphService({ entityManager, logger }),
    ).toThrow(InvalidArgumentError);

    await expect(
      service.detachPart('missing-part'),
    ).rejects.toThrow(InvalidArgumentError);

    entityManager.addComponent('npc-1', 'core:name', { text: 'NPC' });

    await expect(service.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError,
    );
    await expect(service.getBodyGraph('npc-1')).rejects.toThrow(
      'has no anatomy:body component',
    );

    await expect(service.getAnatomyData(null)).rejects.toThrow(
      InvalidArgumentError,
    );
    await expect(service.getAnatomyData('npc-1')).resolves.toBeNull();
    expect(
      logger.debug.mock.calls.some((call) =>
        call[0]?.includes('has no anatomy:body component'),
      ),
    ).toBe(true);
  });

  it('supports injecting custom query cache implementations', () => {
    const customCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(['cached-arm']),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    const serviceWithCustomCache = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      queryCache: customCache,
    });

    const result = serviceWithCustomCache.findPartsByType(actorId, 'arm');
    expect(result).toEqual(['cached-arm']);
    expect(customCache.getCachedFindPartsByType).toHaveBeenCalledWith(
      actorId,
      'arm',
    );
    expect(customCache.cacheFindPartsByType).not.toHaveBeenCalled();
  });
});

