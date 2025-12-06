import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

class IntegrationEntityManager {
  constructor() {
    this.entities = new Set();
    this.components = new Map();
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

  addComponent(entityId, componentId, data) {
    this.entities.add(entityId);
    const key = this.#key(entityId, componentId);
    this.components.set(key, this.#clone(data));

    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  async removeComponent(entityId, componentId) {
    const key = this.#key(entityId, componentId);
    this.components.delete(key);
    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }
  }

  getComponentData(entityId, componentId) {
    const key = this.#key(entityId, componentId);
    if (!this.components.has(key)) {
      return null;
    }
    return this.#clone(this.components.get(key));
  }

  getEntitiesWithComponent(componentId) {
    const index = this.componentIndex.get(componentId);
    if (!index) return [];
    return Array.from(index.values());
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity '${entityId}' not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

describe('BodyGraphService integration – edge branch coverage', () => {
  /** @type {IntegrationEntityManager} */
  let entityManager;
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  /** @type {ReturnType<typeof createDispatcher>} */
  let eventDispatcher;
  /** @type {BodyGraphService} */
  let service;
  /** @type {ReturnType<IntegrationEntityManager['getComponentData']>} */
  let actorBodyComponent;
  let actorId;
  let blankActorId;
  let partIds;
  let cacheInvalidateSpy;
  let queryInvalidateSpy;

  beforeEach(async () => {
    cacheInvalidateSpy = jest.spyOn(
      AnatomyCacheManager.prototype,
      'invalidateCacheForRoot'
    );
    queryInvalidateSpy = jest.spyOn(
      AnatomyQueryCache.prototype,
      'invalidateRoot'
    );

    entityManager = new IntegrationEntityManager();
    logger = createLogger();
    eventDispatcher = createDispatcher();

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });

    actorId = 'actor-edge';
    blankActorId = 'actor-blank';
    partIds = {
      torso: 'torso-edge',
      attachment: 'attachment-edge',
      rootless: 'rootless-edge',
    };

    entityManager.addComponent(actorId, 'core:name', { text: 'Edge Actor' });
    entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'edge:humanoid',
      body: { root: partIds.torso },
      structure: { rootPartId: partIds.torso },
    });

    entityManager.addComponent(partIds.torso, 'anatomy:part', {
      subType: 'torso',
    });
    entityManager.addComponent(partIds.torso, 'anatomy:joint', {
      parentId: actorId,
      socketId: 'core',
    });

    entityManager.addComponent(partIds.attachment, 'anatomy:part', {
      subType: 'attachment',
    });
    entityManager.addComponent(partIds.attachment, 'anatomy:joint', {
      parentId: partIds.torso,
      socketId: 'attachment-socket',
    });
    entityManager.addComponent(partIds.attachment, 'anatomy:status', {
      posture: { state: 'raised', detail: { tension: 'high' } },
    });
    entityManager.addComponent(partIds.attachment, 'custom:empty', {});

    entityManager.addComponent(partIds.rootless, 'anatomy:part', {
      subType: 'growth',
    });
    entityManager.addComponent(partIds.rootless, 'anatomy:joint', {
      parentId: null,
      socketId: 'mysterious-root',
    });

    entityManager.addComponent(blankActorId, 'anatomy:body', {
      body: { root: 'blank-root' },
      structure: { rootPartId: 'blank-root' },
    });

    await service.buildAdjacencyCache(actorId);

    actorBodyComponent = entityManager.getComponentData(
      actorId,
      'anatomy:body'
    );

    // Warm caches so the branch that returns cached values is exercised
    service.getAllParts(actorBodyComponent, actorId);
    service.getAllParts(actorBodyComponent, actorId);
    service.findPartsByType(actorId, 'attachment');
    service.findPartsByType(actorId, 'attachment');
  });

  afterEach(() => {
    cacheInvalidateSpy.mockRestore();
    queryInvalidateSpy.mockRestore();
  });

  it('skips cache invalidation when detaching parts without a resolvable root', async () => {
    cacheInvalidateSpy.mockClear();
    queryInvalidateSpy.mockClear();

    const cachedBeforeDetach = service.getAllParts(actorBodyComponent, actorId);

    const detachResult = await service.detachPart(partIds.rootless, {
      cascade: true,
      reason: 'rootless-branch',
    });

    expect(detachResult).toEqual({
      detached: [partIds.rootless],
      parentId: null,
      socketId: 'mysterious-root',
    });

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: partIds.rootless,
        parentEntityId: null,
        socketId: 'mysterious-root',
        detachedCount: 1,
        reason: 'rootless-branch',
      })
    );

    expect(cacheInvalidateSpy).not.toHaveBeenCalled();
    expect(queryInvalidateSpy).not.toHaveBeenCalled();

    const cachedAfterDetach = service.getAllParts(actorBodyComponent, actorId);
    expect(cachedAfterDetach).toBe(cachedBeforeDetach);
    expect(service.hasCache(actorId)).toBe(true);
    expect(
      entityManager.getComponentData(partIds.rootless, 'anatomy:joint')
    ).toBeNull();
  });

  it('handles nested component lookups and empty component data gracefully', () => {
    expect(
      service.hasPartWithComponent(actorBodyComponent, 'custom:empty')
    ).toBe(false);

    const nestedFound = service.hasPartWithComponentValue(
      actorBodyComponent,
      'anatomy:status',
      'posture.state',
      'raised'
    );
    expect(nestedFound).toEqual({ found: true, partId: partIds.attachment });

    const missingNested = service.hasPartWithComponentValue(
      actorBodyComponent,
      'anatomy:status',
      'posture.detail.absent',
      'none'
    );
    expect(missingNested).toEqual({ found: false });
  });

  it('provides fallback data for incomplete anatomy metadata and unknown cache lookups', async () => {
    await expect(service.getAnatomyData(blankActorId)).resolves.toEqual({
      recipeId: null,
      rootEntityId: blankActorId,
    });

    expect(service.getChildren('ghost-node')).toEqual([]);
    expect(service.getParent('ghost-node')).toBeNull();
    expect(service.getAllDescendants('ghost-node')).toEqual([]);

    const graph = await service.getBodyGraph(actorId);
    expect(graph.getConnectedParts('non-existent-node')).toEqual([]);
  });
});
