import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const clone = (value) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

class MemoryEntityManager {
  constructor() {
    this.records = new Map();
  }

  #ensureRecord(entityId) {
    if (!this.records.has(entityId)) {
      this.records.set(entityId, { components: new Map() });
    }
    return this.records.get(entityId);
  }

  addEntity(entityId, components = {}) {
    const record = this.#ensureRecord(entityId);
    for (const [componentId, data] of Object.entries(components)) {
      record.components.set(componentId, clone(data));
    }
    return { id: entityId };
  }

  setComponent(entityId, componentId, data) {
    const record = this.#ensureRecord(entityId);
    record.components.set(componentId, clone(data));
  }

  updateComponent(entityId, componentId, data) {
    this.setComponent(entityId, componentId, data);
  }

  removeComponent(entityId, componentId) {
    const record = this.records.get(entityId);
    if (!record) return false;
    return record.components.delete(componentId);
  }

  getComponentData(entityId, componentId) {
    const record = this.records.get(entityId);
    if (!record) return null;
    const value = record.components.get(componentId);
    return value === undefined ? null : clone(value);
  }

  getEntitiesWithComponent(componentId) {
    const results = [];
    for (const [entityId, record] of this.records.entries()) {
      if (record.components.has(componentId)) {
        results.push({ id: entityId });
      }
    }
    return results;
  }

  getEntityInstance(entityId) {
    const record = this.records.get(entityId);
    if (!record) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      components: Object.fromEntries(
        Array.from(record.components.entries(), ([key, value]) => [
          key,
          clone(value),
        ])
      ),
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

const addPart = (
  entityManager,
  entityId,
  {
    parentId = undefined,
    socketId = undefined,
    partType = 'unknown',
    extraComponents = {},
  }
) => {
  entityManager.setComponent(entityId, 'anatomy:part', { subType: partType });
  if (parentId !== undefined) {
    entityManager.setComponent(entityId, 'anatomy:joint', {
      parentId,
      socketId,
    });
  }
  for (const [componentId, data] of Object.entries(extraComponents)) {
    entityManager.setComponent(entityId, componentId, data);
  }
};

const createFixture = ({ queryCache } = {}) => {
  const entityManager = new MemoryEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();
  const actorId = 'actor-main';
  const partIds = {
    torso: 'part-torso',
    leftArm: 'part-left-arm',
    leftHand: 'part-left-hand',
    rightArm: 'part-right-arm',
    head: 'part-head',
    heart: 'part-heart',
  };

  entityManager.addEntity(actorId, {
    'anatomy:body': {
      recipeId: 'test:humanoid',
      body: { root: partIds.torso },
      structure: { rootPartId: partIds.torso },
    },
    'core:name': { text: 'Integration Actor' },
  });

  addPart(entityManager, partIds.torso, {
    parentId: actorId,
    socketId: 'core',
    partType: 'torso',
  });
  addPart(entityManager, partIds.leftArm, {
    parentId: partIds.torso,
    socketId: 'left-shoulder',
    partType: 'arm',
    extraComponents: {
      'anatomy:status': { posture: { state: 'raised' } },
    },
  });
  addPart(entityManager, partIds.leftHand, {
    parentId: partIds.leftArm,
    socketId: 'left-wrist',
    partType: 'hand',
    extraComponents: {
      'equipment:grip': { itemId: 'sword-1' },
    },
  });
  addPart(entityManager, partIds.rightArm, {
    parentId: partIds.torso,
    socketId: 'right-shoulder',
    partType: 'arm',
  });
  addPart(entityManager, partIds.head, {
    parentId: partIds.torso,
    socketId: 'neck',
    partType: 'head',
    extraComponents: {
      'anatomy:status': { posture: { state: 'neutral' } },
    },
  });
  addPart(entityManager, partIds.heart, {
    parentId: partIds.torso,
    socketId: 'chest',
    partType: 'heart',
  });

  entityManager.addEntity('no-body-entity', {
    'core:name': { text: 'Villager' },
  });

  entityManager.addEntity('no-recipe', {
    'anatomy:body': {
      body: { root: partIds.torso },
      structure: { rootPartId: partIds.torso },
    },
  });

  entityManager.addEntity('floating', {
    'anatomy:part': { subType: 'floating' },
  });

  entityManager.addEntity('orphan', {
    'anatomy:part': { subType: 'orphan' },
    'anatomy:joint': { parentId: null, socketId: 'loose' },
  });

  entityManager.addEntity('statue', {
    'anatomy:body': {
      recipeId: 'test:statue',
      body: { root: 'statue-torso' },
      structure: { rootPartId: 'statue-torso' },
    },
  });
  addPart(entityManager, 'statue-torso', {
    partType: 'torso',
  });
  addPart(entityManager, 'statue-arm', {
    parentId: 'statue-torso',
    socketId: 'statue-shoulder',
    partType: 'arm',
  });

  addPart(entityManager, 'loop-node', {
    partType: 'loop',
  });
  entityManager.updateComponent('loop-node', 'anatomy:joint', {
    parentId: 'loop-node',
    socketId: 'loop',
  });

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
  });

  const bodyComponent = entityManager.getComponentData(
    actorId,
    'anatomy:body'
  );

  return {
    service,
    entityManager,
    logger,
    eventDispatcher,
    actorId,
    partIds,
    bodyComponent,
  };
};

describe('BodyGraphService integration edge cases', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates required dependencies at construction time', () => {
    const entityManager = new MemoryEntityManager();
    const logger = createLogger();
    const eventDispatcher = createEventDispatcher();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher })
    ).toThrow('entityManager is required');
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher })
    ).toThrow('logger is required');
    expect(
      () => new BodyGraphService({ entityManager, logger })
    ).toThrow('eventDispatcher is required');
  });

  it('builds caches once, exposes traversal helpers, and validates cache integrity', async () => {
    const { service, logger, actorId, partIds, bodyComponent } =
      createFixture();
    const buildCacheSpy = jest.spyOn(
      AnatomyCacheManager.prototype,
      'buildCache'
    );

    await service.buildAdjacencyCache(actorId);
    await service.buildAdjacencyCache(actorId);
    expect(buildCacheSpy).toHaveBeenCalledTimes(1);

    expect(service.getAllParts(null)).toEqual([]);

    const actorParts = service.getAllParts(bodyComponent, actorId);
    expect(actorParts).toEqual(
      expect.arrayContaining([
        actorId,
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ])
    );

    const cachedAgain = service.getAllParts(bodyComponent, actorId);
    expect(cachedAgain).toBe(actorParts);

    const blueprintParts = service.getAllParts(bodyComponent);
    expect(blueprintParts).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ])
    );
    const structureParts = service.getAllParts({ root: partIds.torso });
    expect(structureParts).toEqual(blueprintParts);
    expect(service.getAllParts({ body: {} })).toEqual([]);

    const fallbackParts = service.getAllParts(bodyComponent, 'ghost-actor');
    expect(fallbackParts).toEqual(blueprintParts);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        "BodyGraphService.getAllParts: Actor 'ghost-actor' -> Using blueprint root 'part-torso' as cache root"
      )
    );

    const path = service.getPath(partIds.leftHand, partIds.rightArm);
    expect(path).toEqual([
      partIds.leftHand,
      partIds.leftArm,
      partIds.torso,
      partIds.rightArm,
    ]);
    expect(service.getPath(partIds.leftHand, partIds.leftHand)).toEqual([
      partIds.leftHand,
    ]);
    expect(service.getPath(partIds.leftHand, 'missing')).toBeNull();

    expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);
    expect(service.getAnatomyRoot('loop-node')).toBeNull();

    expect(service.getChildren(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.leftArm,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ])
    );
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent(partIds.leftHand)).toBe(partIds.leftArm);
    expect(service.getParent('unknown')).toBeNull();

    expect(service.getAncestors(partIds.leftHand)).toEqual([
      partIds.leftArm,
      partIds.torso,
      actorId,
    ]);
    expect(service.getAncestors(actorId)).toEqual([]);

    const descendants = service.getAllDescendants(actorId);
    expect(descendants).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ])
    );

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);

    buildCacheSpy.mockRestore();
  });

  it('supports part lookups, component queries, and query cache reuse', async () => {
    const customCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    const { service, actorId, partIds, bodyComponent } = createFixture({
      queryCache: customCache,
    });

    await service.buildAdjacencyCache(actorId);

    const arms = service.findPartsByType(partIds.torso, 'arm');
    expect(arms).toEqual(
      expect.arrayContaining([partIds.leftArm, partIds.rightArm])
    );
    expect(customCache.cacheFindPartsByType).toHaveBeenCalledWith(
      partIds.torso,
      'arm',
      expect.any(Array)
    );

    customCache.getCachedFindPartsByType.mockReturnValue(['cached-arm']);
    const cachedArms = service.findPartsByType(partIds.torso, 'arm');
    expect(cachedArms).toEqual(['cached-arm']);

    const parts = service.getAllParts(bodyComponent, actorId);
    expect(customCache.cacheGetAllParts).toHaveBeenCalledWith(actorId, parts);

    customCache.getCachedGetAllParts.mockReturnValue(parts);
    const cachedParts = service.getAllParts(bodyComponent, actorId);
    expect(cachedParts).toBe(parts);

    expect(
      service.hasPartWithComponent(bodyComponent, 'equipment:grip')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'missing:component')
    ).toBe(false);

    const nestedMatch = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:status',
      'posture.state',
      'raised'
    );
    expect(nestedMatch).toEqual({ found: true, partId: partIds.leftArm });

    const nestedMiss = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:status',
      'posture.state',
      'sleeping'
    );
    expect(nestedMiss).toEqual({ found: false });

    const missingPath = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:status',
      'posture.missing',
      'anything'
    );
    expect(missingPath).toEqual({ found: false });
  });

  it('detaches parts with cascade options and invalidates caches and query cache', async () => {
    const customCache = {
      getCachedFindPartsByType: jest.fn().mockReturnValue(undefined),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };
    const { service, entityManager, eventDispatcher, actorId, partIds, bodyComponent } =
      createFixture({ queryCache: customCache });

    await service.buildAdjacencyCache(actorId);

    const cascadeResult = await service.detachPart(partIds.leftArm, {
      reason: 'combat',
    });
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
        reason: 'combat',
      })
    );
    expect(customCache.invalidateRoot).toHaveBeenCalledWith(actorId);
    expect(customCache.invalidateRoot).toHaveBeenCalledTimes(1);
    expect(service.hasCache(actorId)).toBe(false);

    // Rebuild cache so the remaining arm can be detached without cascade.
    await service.buildAdjacencyCache(actorId);
    const partial = await service.detachPart(partIds.rightArm, {
      cascade: false,
      reason: 'surgery',
    });
    expect(partial).toEqual({
      detached: [partIds.rightArm],
      parentId: partIds.torso,
      socketId: 'right-shoulder',
    });
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.rightArm,
        detachedCount: 1,
        reason: 'surgery',
      })
    );
    expect(customCache.invalidateRoot).toHaveBeenCalledTimes(2);

    await expect(service.detachPart('floating')).rejects.toThrow(
      "Entity 'floating' has no joint component - cannot detach"
    );

    const orphanResult = await service.detachPart('orphan');
    expect(orphanResult).toEqual({
      detached: ['orphan'],
      parentId: null,
      socketId: 'loose',
    });
    expect(customCache.invalidateRoot).toHaveBeenCalledTimes(2);
  });

  it('provides body graphs and anatomy metadata while guarding invalid inputs', async () => {
    const { service, actorId, bodyComponent, partIds } = createFixture();

    await service.buildAdjacencyCache(actorId);

    const bodyGraph = await service.getBodyGraph(actorId);
    const allParts = service.getAllParts(bodyComponent, actorId);
    expect(bodyGraph.getAllPartIds()).toEqual(allParts);
    expect(bodyGraph.getConnectedParts(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.leftArm,
        partIds.rightArm,
        partIds.head,
        partIds.heart,
      ])
    );
    expect(bodyGraph.getConnectedParts('missing')).toEqual([]);

    await expect(service.getBodyGraph(null)).rejects.toThrow(InvalidArgumentError);
    await expect(service.getBodyGraph(123)).rejects.toThrow(InvalidArgumentError);
    await expect(service.getBodyGraph('no-body-entity')).rejects.toThrow(
      'has no anatomy:body component'
    );

    await expect(service.getAnatomyData(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData('no-body-entity')).resolves.toBeNull();
    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: 'test:humanoid',
      rootEntityId: actorId,
    });
    await expect(service.getAnatomyData('no-recipe')).resolves.toEqual({
      recipeId: null,
      rootEntityId: 'no-recipe',
    });
  });

  it('links disconnected actors to anatomy roots when caches are built', async () => {
    const { service } = createFixture();

    await service.buildAdjacencyCache('statue');
    const statueBody = await service.getBodyGraph('statue');
    expect(statueBody.getAllPartIds()).toEqual(
      expect.arrayContaining(['statue', 'statue-torso', 'statue-arm'])
    );
    expect(service.getChildren('statue')).toEqual(['statue-torso']);
  });

  it('derives anatomy roots using entity manager data before caches exist', () => {
    const { service, partIds, actorId } = createFixture();
    expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);
  });
});
