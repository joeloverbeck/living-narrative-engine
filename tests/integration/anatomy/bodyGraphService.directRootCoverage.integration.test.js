import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

class InstrumentedQueryCache extends AnatomyQueryCache {
  constructor({ logger }) {
    super({ logger });
    this.cachedAllParts = new Map();
    this.cachedFindByType = new Map();
  }

  cacheGetAllParts(rootId, parts) {
    this.cachedAllParts.set(rootId, [...parts]);
    super.cacheGetAllParts(rootId, parts);
  }

  cacheFindPartsByType(rootId, partType, result) {
    this.cachedFindByType.set(`${rootId}:${partType}`, [...result]);
    super.cacheFindPartsByType(rootId, partType, result);
  }
}

class TestLogger {
  constructor() {
    this.debugCalls = [];
    this.infoCalls = [];
  }

  debug(message, context) {
    this.debugCalls.push({ message, context });
  }

  info(message, context) {
    this.infoCalls.push({ message, context });
  }
}

class TestEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

class TestEntityManager {
  constructor() {
    this.entities = new Map();
  }

  createEntity(entityId, components = {}) {
    this.entities.set(entityId, { ...components });
  }

  setComponent(entityId, componentId, data) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, {});
    }
    this.entities.get(entityId)[componentId] = data;
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    return Object.prototype.hasOwnProperty.call(entity, componentId)
      ? entity[componentId]
      : null;
  }

  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity && Object.prototype.hasOwnProperty.call(entity, componentId)) {
      delete entity[componentId];
    }
  }

  getEntitiesWithComponent(componentId) {
    const results = [];
    for (const [entityId, components] of this.entities.entries()) {
      if (Object.prototype.hasOwnProperty.call(components, componentId)) {
        results.push({ id: entityId });
      }
    }
    return results;
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      return null;
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

const populateAnatomy = (entityManager) => {
  entityManager.createEntity('actor-1', {
    'core:name': { text: 'Hero' },
    'anatomy:body': {
      recipeId: 'humanoid_base',
      body: { root: 'torso' },
      structure: { rootPartId: 'torso' },
    },
  });

  entityManager.createEntity('torso', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'actor-1', socketId: 'core' },
  });

  entityManager.createEntity('arm-left', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'left-arm' },
    'anatomy:tag': { category: 'primary' },
  });

  entityManager.createEntity('hand-left', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'arm-left', socketId: 'left-hand' },
  });

  entityManager.createEntity('leg-left', {
    'anatomy:part': { subType: 'leg' },
    'anatomy:joint': { parentId: 'torso', socketId: 'left-leg' },
    'anatomy:sensors': { status: { active: true } },
  });

  entityManager.createEntity('foot-left', {
    'anatomy:part': { subType: 'foot' },
    'anatomy:joint': { parentId: 'leg-left', socketId: 'left-foot' },
  });
};

const createService = () => {
  const entityManager = new TestEntityManager();
  const logger = new TestLogger();
  const eventDispatcher = new TestEventDispatcher();
  const queryCache = new InstrumentedQueryCache({ logger });
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
    queryCache,
  });

  return { service, entityManager, logger, eventDispatcher, queryCache };
};

describe('BodyGraphService direct root coverage (integration)', () => {
  let service;
  let entityManager;
  let logger;
  let eventDispatcher;
  let queryCache;

  beforeEach(() => {
    ({ service, entityManager, logger, eventDispatcher, queryCache } =
      createService());
    populateAnatomy(entityManager);
  });

  it('resolves blueprint-style roots and updates caches through the query cache API', async () => {
    const directBodyComponent = { root: 'torso' };

    // Without an actor cache we should fall back to the blueprint root branch.
    const initialParts = service.getAllParts(directBodyComponent);
    expect(initialParts).toEqual(
      expect.arrayContaining([
        'torso',
        'arm-left',
        'hand-left',
        'leg-left',
        'foot-left',
      ])
    );
    expect(queryCache.cachedAllParts.get('torso')).toEqual(initialParts);

    // Build the actor cache and confirm we now prefer the actor root id.
    await service.buildAdjacencyCache('actor-1');
    const actorAware = service.getAllParts(
      entityManager.getComponentData('actor-1', 'anatomy:body'),
      'actor-1'
    );
    expect(actorAware).toEqual(
      expect.arrayContaining([
        'actor-1',
        'torso',
        'arm-left',
        'hand-left',
        'leg-left',
        'foot-left',
      ])
    );
    expect(queryCache.cachedAllParts.get('actor-1')).toEqual(actorAware);

    // Ensure cached results are served even if the underlying data mutates until cache invalidation occurs.
    entityManager.setComponent('arm-left', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'relocated',
    });
    const cachedAgain = service.getAllParts(directBodyComponent);
    expect(cachedAgain).toEqual(initialParts);

    // A detach invalidates caches and rebuilds when requested again.
    await service.detachPart('arm-left', { reason: 'injury' });
    await service.buildAdjacencyCache('actor-1');
    const afterDetach = service.getAllParts(
      entityManager.getComponentData('actor-1', 'anatomy:body'),
      'actor-1'
    );
    expect(afterDetach).not.toContain('arm-left');
    expect(afterDetach).not.toContain('hand-left');
    expect(queryCache.cachedAllParts.get('actor-1')).toEqual(afterDetach);
    expect(eventDispatcher.events.at(-1).payload.detachedCount).toBe(2);
    expect(
      logger.infoCalls.some(({ message }) => message.includes('Detached'))
    ).toBe(true);
  });

  it('logs and returns empty results when no root id is available', () => {
    const result = service.getAllParts({});
    expect(result).toEqual([]);
    expect(
      logger.debugCalls.some(({ message }) =>
        message.includes('No root ID found in bodyComponent')
      )
    ).toBe(true);
  });
});
