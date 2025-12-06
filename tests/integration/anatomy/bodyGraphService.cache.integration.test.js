/**
 * @file High coverage integration tests for BodyGraphService using a simplified
 * fake entity manager.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  BodyGraphService,
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

/**
 * Simple in-memory entity implementation used to simulate IEntityManager
 * behaviour for the anatomy graph.
 */
class FakeEntity {
  constructor(id) {
    this.id = id;
    this.components = new Map();
  }

  addComponent(componentId, data) {
    this.components.set(componentId, data);
    return true;
  }

  getComponentData(componentId) {
    return this.components.has(componentId)
      ? this.components.get(componentId)
      : null;
  }

  removeComponent(componentId) {
    return this.components.delete(componentId);
  }
}

/**
 * Lightweight entity manager that exposes only the operations used by
 * BodyGraphService and AnatomyCacheManager.
 */
class FakeEntityManager {
  constructor() {
    this.entities = new Map();
    this.idCounter = 0;
  }

  addEntity(id, components = {}) {
    const entity = new FakeEntity(id);
    for (const [componentId, data] of Object.entries(components)) {
      entity.addComponent(componentId, data);
    }
    this.entities.set(id, entity);
    return entity;
  }

  createEntityInstance(definitionId) {
    const id = `${definitionId}-${++this.idCounter}`;
    return this.addEntity(id);
  }

  getEntityInstance(id) {
    const entity = this.entities.get(id);
    if (!entity) {
      throw new Error(`Entity ${id} not found`);
    }
    return entity;
  }

  getComponentData(id, componentId) {
    const entity = this.entities.get(id);
    if (!entity) return null;
    return entity.getComponentData(componentId);
  }

  getEntitiesWithComponent(componentId) {
    const result = [];
    for (const entity of this.entities.values()) {
      if (entity.getComponentData(componentId)) {
        result.push(entity);
      }
    }
    return result;
  }

  removeComponent(id, componentId) {
    const entity = this.entities.get(id);
    if (!entity) return false;
    return entity.removeComponent(componentId);
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('BodyGraphService targeted coverage integration', () => {
  let entityManager;
  let bodyGraphService;
  let logger;
  let eventDispatcher;
  let bodyComponent;

  beforeEach(() => {
    logger = createLogger();
    eventDispatcher = { dispatch: jest.fn(async () => {}) };
    entityManager = new FakeEntityManager();

    entityManager.addEntity('actor-1', {
      'anatomy:body': {
        recipeId: 'test:recipe',
        body: {
          root: 'torso',
          parts: {
            torso: { children: ['arm'] },
            arm: { children: ['hand'] },
            hand: { children: ['finger'] },
          },
        },
        structure: {
          rootPartId: 'torso',
        },
      },
    });

    entityManager.addEntity('torso', {
      'anatomy:part': { subType: 'torso' },
      'anatomy:joint': { parentId: 'actor-1', socketId: 'core' },
    });

    entityManager.addEntity('arm', {
      'anatomy:part': { subType: 'arm' },
      'anatomy:joint': { parentId: 'torso', socketId: 'shoulder' },
    });

    entityManager.addEntity('hand', {
      'anatomy:part': { subType: 'hand' },
      'anatomy:joint': { parentId: 'arm', socketId: 'wrist' },
    });

    entityManager.addEntity('finger', {
      'anatomy:part': { subType: 'finger' },
      'anatomy:joint': { parentId: 'hand', socketId: 'finger-socket' },
    });

    entityManager.addEntity('floating', {
      'anatomy:part': { subType: 'floating' },
    });

    entityManager.addEntity('no-body');
    entityManager.addEntity('no-recipe', {
      'anatomy:body': {
        body: { root: 'torso' },
      },
    });

    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
    });
    bodyComponent = entityManager.getComponentData('actor-1', 'anatomy:body');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor validation', () => {
    it('throws when required dependencies are missing', () => {
      expect(
        () =>
          new BodyGraphService({
            entityManager: null,
            logger,
            eventDispatcher,
          })
      ).toThrow('entityManager is required');

      expect(
        () =>
          new BodyGraphService({
            entityManager,
            logger: null,
            eventDispatcher,
          })
      ).toThrow('logger is required');

      expect(
        () =>
          new BodyGraphService({
            entityManager,
            logger,
            eventDispatcher: null,
          })
      ).toThrow('eventDispatcher is required');
    });

    it('uses a provided query cache instance when supplied', async () => {
      const providedQueryCache = {
        getCachedFindPartsByType: jest.fn().mockReturnValue(['cached']),
        cacheFindPartsByType: jest.fn(),
        getCachedGetAllParts: jest.fn().mockReturnValue(undefined),
        cacheGetAllParts: jest.fn(),
        invalidateRoot: jest.fn(),
      };

      const service = new BodyGraphService({
        entityManager,
        logger,
        eventDispatcher,
        queryCache: providedQueryCache,
      });

      await service.buildAdjacencyCache('actor-1');
      const result = service.findPartsByType('actor-1', 'hand');

      expect(providedQueryCache.getCachedFindPartsByType).toHaveBeenCalledWith(
        'actor-1',
        'hand'
      );
      expect(result).toEqual(['cached']);
    });
  });

  describe('cache lifecycle', () => {
    it('builds adjacency cache only once per root', async () => {
      const buildCacheSpy = jest.spyOn(
        AnatomyCacheManager.prototype,
        'buildCache'
      );

      await bodyGraphService.buildAdjacencyCache('actor-1');
      expect(buildCacheSpy).toHaveBeenCalledTimes(1);
      expect(bodyGraphService.hasCache('actor-1')).toBe(true);

      await bodyGraphService.buildAdjacencyCache('actor-1');
      expect(buildCacheSpy).toHaveBeenCalledTimes(1);
    });

    it('validates and exposes cache data', async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
      const validation = bodyGraphService.validateCache();

      expect(validation.valid).toBe(true);
      expect(Array.isArray(validation.issues)).toBe(true);
      expect(bodyGraphService.getChildren('torso')).toEqual(['arm']);
      expect(bodyGraphService.getParent('torso')).toBe('actor-1');
      expect(bodyGraphService.getParent('actor-1')).toBeNull();
    });
  });

  describe('detaching parts', () => {
    it('detaches cascaded parts and invalidates caches', async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
      bodyGraphService.getAllParts(bodyComponent.body, 'actor-1');

      const getSubgraphSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getSubgraph');
      const invalidateCacheSpy = jest.spyOn(
        AnatomyCacheManager.prototype,
        'invalidateCacheForRoot'
      );
      const invalidateQuerySpy = jest.spyOn(
        AnatomyQueryCache.prototype,
        'invalidateRoot'
      );

      const result = await bodyGraphService.detachPart('arm', {
        cascade: true,
        reason: 'testing',
      });

      expect(result.detached).toEqual(expect.arrayContaining(['arm', 'hand']));
      expect(getSubgraphSpy).toHaveBeenCalled();
      expect(invalidateCacheSpy).toHaveBeenCalledWith('actor-1');
      expect(bodyGraphService.hasCache('actor-1')).toBe(false);
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'arm',
          parentEntityId: 'torso',
          socketId: 'shoulder',
          detachedCount: result.detached.length,
          reason: 'testing',
        })
      );
      expect(entityManager.getComponentData('arm', 'anatomy:joint')).toBeNull();
      expect(invalidateQuerySpy).toHaveBeenCalledWith('actor-1');
    });

    it('detaches only the target when cascade is disabled', async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
      const getSubgraphSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getSubgraph');

      const result = await bodyGraphService.detachPart('hand', {
        cascade: false,
      });

      expect(getSubgraphSpy).not.toHaveBeenCalled();
      expect(result.detached).toEqual(['hand']);
      expect(result.parentId).toBe('arm');
      expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
        LIMB_DETACHED_EVENT_ID,
        expect.objectContaining({
          detachedEntityId: 'hand',
          detachedCount: 1,
          reason: 'manual',
        })
      );
    });

    it('throws when attempting to detach a part without a joint', async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
      const initialDispatches = eventDispatcher.dispatch.mock.calls.length;

      await expect(bodyGraphService.detachPart('floating')).rejects.toThrow(
        InvalidArgumentError
      );
      expect(eventDispatcher.dispatch.mock.calls.length).toBe(
        initialDispatches
      );
    });
  });

  describe('part lookups and caching', () => {
    it('finds parts by type and reuses the query cache', async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
      const findSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');

      const first = bodyGraphService.findPartsByType('actor-1', 'hand');
      expect(first).toContain('hand');
      expect(findSpy).toHaveBeenCalledTimes(1);

      const second = bodyGraphService.findPartsByType('actor-1', 'hand');
      expect(second).toEqual(first);
      expect(findSpy).toHaveBeenCalledTimes(1);
    });

    it('returns cached results for getAllParts and handles root detection', async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
      const getAllPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');

      const nestedResult = bodyGraphService.getAllParts(
        bodyComponent,
        'actor-1'
      );
      expect(nestedResult).toEqual(
        expect.arrayContaining(['torso', 'arm', 'hand', 'finger'])
      );
      expect(getAllPartsSpy).toHaveBeenCalledTimes(1);
      expect(getAllPartsSpy.mock.calls[0][0]).toBe('actor-1');

      const blueprintResult = bodyGraphService.getAllParts(
        { root: 'torso' },
        'unknown-actor'
      );
      expect(blueprintResult).toEqual(
        expect.arrayContaining(['torso', 'arm', 'hand', 'finger'])
      );
      expect(blueprintResult).not.toContain('actor-1');
      expect(getAllPartsSpy.mock.calls[1][0]).toBe('torso');

      const cachedAgain = bodyGraphService.getAllParts(
        bodyComponent,
        'actor-1'
      );
      expect(cachedAgain).toEqual(nestedResult);
      expect(getAllPartsSpy).toHaveBeenCalledTimes(2);

      expect(bodyGraphService.getAllParts(null)).toEqual([]);
      expect(bodyGraphService.getAllParts(undefined)).toEqual([]);
      expect(bodyGraphService.getAllParts({})).toEqual([]);
    });

    it('detects parts with specific components and values', async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');

      expect(
        bodyGraphService.hasPartWithComponent(
          bodyComponent.body,
          'anatomy:part'
        )
      ).toBe(true);
      expect(
        bodyGraphService.hasPartWithComponent(
          bodyComponent.body,
          'missing:component'
        )
      ).toBe(false);

      const hand = entityManager.getEntityInstance('hand');
      hand.addComponent('test:nested', { details: { label: 'grip' } });

      const match = bodyGraphService.hasPartWithComponentValue(
        bodyComponent.body,
        'test:nested',
        'details.label',
        'grip'
      );
      expect(match).toEqual({ found: true, partId: 'hand' });

      const miss = bodyGraphService.hasPartWithComponentValue(
        bodyComponent.body,
        'test:nested',
        'details.label',
        'missing'
      );
      expect(miss).toEqual({ found: false });
    });
  });

  describe('graph traversal utilities', () => {
    beforeEach(async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
    });

    it('returns connected part data through getBodyGraph', async () => {
      const graph = await bodyGraphService.getBodyGraph('actor-1');

      const ids = graph.getAllPartIds();
      expect(ids).toEqual(
        expect.arrayContaining(['torso', 'arm', 'hand', 'finger'])
      );

      expect(graph.getConnectedParts('torso')).toEqual(['arm']);
    });

    it('rejects invalid inputs for getBodyGraph', async () => {
      await expect(bodyGraphService.getBodyGraph(null)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(bodyGraphService.getBodyGraph('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(bodyGraphService.getBodyGraph(123)).rejects.toThrow(
        InvalidArgumentError
      );

      await expect(bodyGraphService.getBodyGraph('no-body')).rejects.toThrow(
        `Entity no-body has no anatomy:body component`
      );
    });

    it('computes ancestry and descendant information', () => {
      expect(bodyGraphService.getAncestors('finger')).toEqual([
        'hand',
        'arm',
        'torso',
        'actor-1',
      ]);
      expect(bodyGraphService.getAncestors('actor-1')).toEqual([]);

      expect(bodyGraphService.getAllDescendants('torso')).toEqual([
        'arm',
        'hand',
        'finger',
      ]);
      expect(bodyGraphService.getAllDescendants('finger')).toEqual([]);

      expect(bodyGraphService.getPath('torso', 'finger')).toEqual([
        'torso',
        'arm',
        'hand',
        'finger',
      ]);
    });
  });

  describe('anatomy metadata access', () => {
    beforeEach(async () => {
      await bodyGraphService.buildAdjacencyCache('actor-1');
    });

    it('retrieves anatomy data and handles missing components', async () => {
      await expect(bodyGraphService.getAnatomyData(null)).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(bodyGraphService.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(bodyGraphService.getAnatomyData(123)).rejects.toThrow(
        InvalidArgumentError
      );

      expect(await bodyGraphService.getAnatomyData('no-body')).toBeNull();

      const data = await bodyGraphService.getAnatomyData('actor-1');
      expect(data).toEqual({
        recipeId: 'test:recipe',
        rootEntityId: 'actor-1',
      });

      const noRecipe = await bodyGraphService.getAnatomyData('no-recipe');
      expect(noRecipe).toEqual({ recipeId: null, rootEntityId: 'no-recipe' });
    });
  });
});
