import { afterEach, describe, expect, it, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

class InMemoryEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.entities = new Map();
    /** @type {Map<string, Map<string, { id: string }>>} */
    this.componentIndex = new Map();
  }

  #ensureEntity(entityId) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
  }

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  addComponent(entityId, componentId, data) {
    this.#ensureEntity(entityId);
    this.entities.get(entityId).set(componentId, this.#clone(data));
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return null;
    }
    const component = entity.get(componentId);
    return component !== undefined ? this.#clone(component) : null;
  }

  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.delete(componentId);
    }
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

class InstrumentedQueryCache {
  constructor({ logger }) {
    this.delegate = new AnatomyQueryCache({ logger });
    /** @type {{ rootId: string, partType?: string, result: string[] }[]} */
    this.findPartsCaches = [];
    /** @type {{ rootId: string, partType?: string }[]} */
    this.findPartsGets = [];
    /** @type {{ rootId: string, result: string[] }[]} */
    this.allPartsCaches = [];
    /** @type {string[]} */
    this.allPartsGets = [];
    /** @type {string[]} */
    this.invalidations = [];
  }

  getCachedFindPartsByType(rootId, partType) {
    this.findPartsGets.push({ rootId, partType });
    return this.delegate.getCachedFindPartsByType(rootId, partType);
  }

  cacheFindPartsByType(rootId, partType, result) {
    this.findPartsCaches.push({ rootId, partType, result: [...result] });
    this.delegate.cacheFindPartsByType(rootId, partType, result);
  }

  getCachedGetAllParts(rootId) {
    this.allPartsGets.push(rootId);
    return this.delegate.getCachedGetAllParts(rootId);
  }

  cacheGetAllParts(rootId, result) {
    this.allPartsCaches.push({ rootId, result: [...result] });
    this.delegate.cacheGetAllParts(rootId, result);
  }

  invalidateRoot(rootId) {
    this.invalidations.push(rootId);
    this.delegate.invalidateRoot(rootId);
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

describe('BodyGraphService integration - cache and query orchestration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('walks the anatomy graph, reuses caches, and detaches parts end-to-end', async () => {
    const logger = createLogger();
    const eventDispatcher = createEventDispatcher();
    const entityManager = new InMemoryEntityManager();
    const queryCache = new InstrumentedQueryCache({ logger });

    const actorId = 'actor-cache-query';
    const partIds = {
      torso: 'torso-root',
      head: 'head-part',
      leftArm: 'arm-left',
      leftHand: 'hand-left',
      rightArm: 'arm-right',
      rightHand: 'hand-right',
      heart: 'heart-core',
      leftLeg: 'leg-left',
    };
    const orphanPartId = 'orphan-limb';

    entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'test:humanoid',
      body: { root: partIds.torso },
      structure: { rootPartId: partIds.torso },
    });

    entityManager.addComponent(partIds.torso, 'anatomy:part', { subType: 'torso' });
    entityManager.addComponent(partIds.torso, 'anatomy:joint', {
      parentId: actorId,
      socketId: 'spine-base',
    });
    entityManager.addComponent(partIds.torso, 'custom:metadata', {});

    entityManager.addComponent(partIds.head, 'anatomy:part', { subType: 'head' });
    entityManager.addComponent(partIds.head, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'neck',
    });
    entityManager.addComponent(partIds.head, 'core:description', { text: 'head' });

    entityManager.addComponent(partIds.leftArm, 'anatomy:part', { subType: 'arm' });
    entityManager.addComponent(partIds.leftArm, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'left-shoulder',
    });
    entityManager.addComponent(partIds.leftArm, 'anatomy:status', {
      posture: { state: 'braced' },
    });

    entityManager.addComponent(partIds.leftHand, 'anatomy:part', { subType: 'hand' });
    entityManager.addComponent(partIds.leftHand, 'anatomy:joint', {
      parentId: partIds.leftArm,
      socketId: 'left-wrist',
    });
    entityManager.addComponent(partIds.leftHand, 'equipment:grip', {
      itemId: 'sword-01',
    });

    entityManager.addComponent(partIds.rightArm, 'anatomy:part', { subType: 'arm' });
    entityManager.addComponent(partIds.rightArm, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'right-shoulder',
    });
    entityManager.addComponent(partIds.rightArm, 'anatomy:status', {
      posture: { state: 'relaxed' },
    });
    entityManager.addComponent(partIds.rightArm, 'core:description', {});

    entityManager.addComponent(partIds.rightHand, 'anatomy:part', { subType: 'hand' });
    entityManager.addComponent(partIds.rightHand, 'anatomy:joint', {
      parentId: partIds.rightArm,
      socketId: 'right-wrist',
    });

    entityManager.addComponent(partIds.heart, 'anatomy:part', { subType: 'heart' });
    entityManager.addComponent(partIds.heart, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'chest',
    });

    entityManager.addComponent(partIds.leftLeg, 'anatomy:part', { subType: 'leg' });
    entityManager.addComponent(partIds.leftLeg, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'hip',
    });

    entityManager.addComponent(orphanPartId, 'anatomy:part', { subType: 'orphan' });

    const service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      queryCache,
    });

    const bodyComponent = entityManager.getComponentData(actorId, 'anatomy:body');

    const buildCacheSpy = jest.spyOn(AnatomyCacheManager.prototype, 'buildCache');
    const findPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');
    const allPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');
    const pathSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getPath');
    const subgraphSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getSubgraph');
    const rootSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot');

    expect(service.getAllParts(null)).toEqual([]);

    const blueprintPartsFirst = service.getAllParts(bodyComponent, actorId);
    expect(allPartsSpy).toHaveBeenCalledTimes(1);
    expect(blueprintPartsFirst).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.head,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.rightHand,
        partIds.heart,
        partIds.leftLeg,
      ])
    );

    const blueprintPartsSecond = service.getAllParts(bodyComponent, actorId);
    expect(allPartsSpy).toHaveBeenCalledTimes(1);

    expect(service.getAllParts({ root: partIds.torso })).toEqual(
      expect.arrayContaining([
        partIds.torso,
        partIds.head,
        partIds.leftArm,
      ])
    );

    expect(service.getAllParts({ body: {} })).toEqual([]);

    await service.buildAdjacencyCache(actorId);
    expect(buildCacheSpy).toHaveBeenCalledTimes(1);

    await service.buildAdjacencyCache(actorId);
    expect(buildCacheSpy).toHaveBeenCalledTimes(1);

    expect(service.hasCache(actorId)).toBe(true);
    expect(service.getChildren(actorId)).toEqual([partIds.torso]);

    const actorPartsFirst = service.getAllParts(bodyComponent, actorId);
    expect(allPartsSpy).toHaveBeenCalledTimes(2);
    expect(actorPartsFirst).toEqual(
      expect.arrayContaining([
        actorId,
        partIds.torso,
        partIds.head,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.rightHand,
        partIds.heart,
        partIds.leftLeg,
      ])
    );

    const actorPartsSecond = service.getAllParts(bodyComponent, actorId);
    expect(allPartsSpy).toHaveBeenCalledTimes(2);

    expect(service.hasPartWithComponent(bodyComponent, 'equipment:grip')).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'custom:metadata')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.state',
        'braced'
      )
    ).toEqual({ found: true, partId: partIds.leftArm });

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:status',
        'posture.state',
        'missing'
      )
    ).toEqual({ found: false });

    const armsFirst = service.findPartsByType(actorId, 'arm');
    expect(findPartsSpy).toHaveBeenCalledTimes(1);
    expect(armsFirst).toEqual(
      expect.arrayContaining([partIds.leftArm, partIds.rightArm])
    );

    const armsSecond = service.findPartsByType(actorId, 'arm');
    expect(findPartsSpy).toHaveBeenCalledTimes(1);
    expect(armsSecond).toEqual(expect.arrayContaining(armsFirst));

    const path = service.getPath(partIds.leftHand, partIds.rightHand);
    expect(pathSpy).toHaveBeenCalledTimes(1);
    expect(path).toEqual([
      partIds.leftHand,
      partIds.leftArm,
      partIds.torso,
      partIds.rightArm,
      partIds.rightHand,
    ]);

    expect(service.getAnatomyRoot(partIds.leftHand)).toBe(actorId);
    expect(service.getAnatomyRoot('non-existent')).toBe('non-existent');
    expect(rootSpy).toHaveBeenCalled();

    expect(service.getAncestors(partIds.leftHand)).toEqual([
      partIds.leftArm,
      partIds.torso,
      actorId,
    ]);
    expect(service.getParent(partIds.head)).toBe(partIds.torso);
    expect(service.getParent('unknown')).toBeNull();

    expect(service.getChildren(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.head,
        partIds.leftArm,
        partIds.rightArm,
        partIds.heart,
        partIds.leftLeg,
      ])
    );
    expect(service.getChildren('missing-root')).toEqual([]);

    expect(service.getAllDescendants(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.head,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.rightHand,
        partIds.heart,
        partIds.leftLeg,
      ])
    );
    expect(subgraphSpy).toHaveBeenCalled();

    await expect(service.getBodyGraph(42)).rejects.toThrow(InvalidArgumentError);
    await expect(service.getBodyGraph('ghost')).rejects.toThrow(
      /has no anatomy:body/
    );

    const graph = await service.getBodyGraph(actorId);
    expect(graph.getAllPartIds()).toEqual(
      expect.arrayContaining([
        actorId,
        partIds.torso,
        partIds.head,
        partIds.leftArm,
        partIds.leftHand,
        partIds.rightArm,
        partIds.rightHand,
        partIds.heart,
        partIds.leftLeg,
      ])
    );
    expect(graph.getConnectedParts(partIds.torso)).toEqual(
      expect.arrayContaining([
        partIds.head,
        partIds.leftArm,
        partIds.rightArm,
        partIds.heart,
        partIds.leftLeg,
      ])
    );
    expect(graph.getConnectedParts('missing-node')).toEqual([]);

    await expect(service.getAnatomyData(99)).rejects.toThrow(InvalidArgumentError);
    await expect(service.getAnatomyData('ghost')).resolves.toBeNull();
    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: 'test:humanoid',
      rootEntityId: actorId,
    });

    expect(service.validateCache()).toEqual({ valid: true, issues: [] });

    service.findPartsByType(actorId, 'arm');
    service.getAllParts(bodyComponent, actorId);

    const detachCascade = await service.detachPart(partIds.leftArm, {
      cascade: true,
      reason: 'integration-detach',
    });
    expect(detachCascade).toEqual(
      expect.objectContaining({
        detached: expect.arrayContaining([partIds.leftArm, partIds.leftHand]),
        parentId: partIds.torso,
        socketId: 'left-shoulder',
      })
    );
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.leftArm,
        parentEntityId: partIds.torso,
        socketId: 'left-shoulder',
        detachedCount: 2,
        reason: 'integration-detach',
      })
    );
    expect(
      entityManager.getComponentData(partIds.leftArm, 'anatomy:joint')
    ).toBeNull();
    expect(service.hasCache(actorId)).toBe(false);

    expect(queryCache.invalidations).toContain(actorId);

    await service.buildAdjacencyCache(actorId);
    expect(buildCacheSpy).toHaveBeenCalledTimes(2);

    const armsAfterDetach = service.findPartsByType(actorId, 'arm');
    expect(findPartsSpy).toHaveBeenCalledTimes(2);
    expect(armsAfterDetach).toEqual([partIds.rightArm]);

    const heartDetach = await service.detachPart(partIds.heart, {
      cascade: false,
      reason: 'manual-check',
    });
    expect(heartDetach).toEqual({
      detached: [partIds.heart],
      parentId: partIds.torso,
      socketId: 'chest',
    });

    await service.buildAdjacencyCache(actorId);

    await expect(service.detachPart(orphanPartId)).rejects.toThrow(
      InvalidArgumentError
    );

    const legDetach = await service.detachPart(partIds.leftLeg);
    expect(legDetach).toEqual({
      detached: [partIds.leftLeg],
      parentId: partIds.torso,
      socketId: 'hip',
    });
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({ reason: 'manual' })
    );

    expect(
      queryCache.allPartsCaches.map((entry) => entry.rootId)
    ).toEqual(expect.arrayContaining([partIds.torso, actorId]));
    expect(
      queryCache.findPartsCaches.map((entry) => entry.rootId)
    ).toContain(actorId);
    expect(
      queryCache.invalidations.filter((rootId) => rootId === actorId).length
    ).toBeGreaterThanOrEqual(2);
    expect(eventDispatcher.dispatch).toHaveBeenCalledTimes(3);
  });
});
