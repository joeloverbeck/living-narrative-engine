import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class TestLogger {
  constructor() {
    this.debugCalls = [];
    this.infoCalls = [];
    this.warnCalls = [];
    this.errorCalls = [];
  }

  debug(...args) {
    this.debugCalls.push(args);
  }

  info(...args) {
    this.infoCalls.push(args);
  }

  warn(...args) {
    this.warnCalls.push(args);
  }

  error(...args) {
    this.errorCalls.push(args);
  }

  messages(level) {
    const map = {
      debug: this.debugCalls,
      info: this.infoCalls,
      warn: this.warnCalls,
      error: this.errorCalls,
    };
    return (map[level] || []).map((entry) => entry[0]);
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
    'core:name': { text: 'Protagonist' },
    'anatomy:body': {
      recipeId: 'humanoid_base',
      body: { root: 'torso' },
      structure: { rootPartId: 'torso' },
    },
  });

  entityManager.createEntity('torso', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'actor-1', socketId: 'core-socket' },
  });

  entityManager.createEntity('arm-left', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'arm-left-socket' },
    'anatomy:tag': { strength: 8 },
  });

  entityManager.createEntity('hand-left', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'arm-left', socketId: 'hand-left-socket' },
  });

  entityManager.createEntity('leg-left', {
    'anatomy:part': { subType: 'leg' },
    'anatomy:joint': { parentId: 'torso', socketId: 'leg-left-socket' },
    'anatomy:sensors': { status: { active: true } },
  });

  entityManager.createEntity('foot-left', {
    'anatomy:part': { subType: 'foot' },
    'anatomy:joint': { parentId: 'leg-left', socketId: 'foot-left-socket' },
  });

  entityManager.createEntity('heart', {
    'anatomy:part': { subType: 'heart' },
    'anatomy:joint': { parentId: 'torso', socketId: 'heart-socket' },
  });

  entityManager.createEntity('floating', {
    'anatomy:part': { subType: 'mystery' },
  });
};

const createService = () => {
  const entityManager = new TestEntityManager();
  const logger = new TestLogger();
  const eventDispatcher = new TestEventDispatcher();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  return { service, entityManager, logger, eventDispatcher };
};

describe('BodyGraphService real module integration', () => {
  let service;
  let entityManager;
  let logger;
  let eventDispatcher;

  beforeEach(() => {
    ({ service, entityManager, logger, eventDispatcher } = createService());
    populateAnatomy(entityManager);
  });

  it('validates constructor dependencies', () => {
    const loggerOnly = new TestLogger();
    const dispatcherOnly = new TestEventDispatcher();
    expect(
      () =>
        new BodyGraphService({
          logger: loggerOnly,
          eventDispatcher: dispatcherOnly,
        })
    ).toThrow('entityManager is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager: new TestEntityManager(),
          eventDispatcher: dispatcherOnly,
        })
    ).toThrow('logger is required');

    expect(
      () =>
        new BodyGraphService({
          entityManager: new TestEntityManager(),
          logger: loggerOnly,
        })
    ).toThrow('eventDispatcher is required');
  });

  it('builds adjacency cache and exposes navigation helpers', async () => {
    await service.buildAdjacencyCache('actor-1');
    expect(service.hasCache('actor-1')).toBe(true);
    expect(service.getChildren('actor-1')).toEqual(['torso']);
    expect(service.getChildren('torso')).toEqual(
      expect.arrayContaining(['arm-left', 'leg-left', 'heart'])
    );
    expect(service.getParent('arm-left')).toBe('torso');
    expect(service.getParent('unknown')).toBeNull();
    expect(service.getAncestors('foot-left')).toEqual([
      'leg-left',
      'torso',
      'actor-1',
    ]);
    expect(service.getAllDescendants('torso')).toEqual(
      expect.arrayContaining([
        'arm-left',
        'hand-left',
        'leg-left',
        'foot-left',
        'heart',
      ])
    );
    expect(service.getPath('hand-left', 'foot-left')).toEqual([
      'hand-left',
      'arm-left',
      'torso',
      'leg-left',
      'foot-left',
    ]);
    expect(service.validateCache()).toEqual({ valid: true, issues: [] });

    await service.buildAdjacencyCache('actor-1');
    expect(service.getChildren('actor-1')).toEqual(['torso']);
  });

  it('falls back to entity manager when cache is empty for root lookup', () => {
    const secondaryLogger = new TestLogger();
    const fallbackService = new BodyGraphService({
      entityManager,
      logger: secondaryLogger,
      eventDispatcher: new TestEventDispatcher(),
    });

    expect(fallbackService.getAnatomyRoot('hand-left')).toBe('actor-1');
  });

  it('detaches cascading parts, invalidates caches, and emits events', async () => {
    await service.buildAdjacencyCache('actor-1');
    const result = await service.detachPart('arm-left', { reason: 'injury' });

    expect(result).toEqual({
      detached: ['arm-left', 'hand-left'],
      parentId: 'torso',
      socketId: 'arm-left-socket',
    });
    expect(
      entityManager.getComponentData('arm-left', 'anatomy:joint')
    ).toBeNull();
    expect(service.hasCache('actor-1')).toBe(false);
    expect(eventDispatcher.events).toHaveLength(1);
    const [event] = eventDispatcher.events;
    expect(event.eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(event.payload).toEqual(
      expect.objectContaining({
        detachedEntityId: 'arm-left',
        detachedCount: 2,
        parentEntityId: 'torso',
        reason: 'injury',
      })
    );
    expect(
      logger.messages('info').some((msg) => msg.includes('Detached 2 entities'))
    ).toBe(true);
  });

  it('supports non-cascading detach operations', async () => {
    await service.buildAdjacencyCache('actor-1');
    const result = await service.detachPart('leg-left', {
      cascade: false,
      reason: 'manual',
    });

    expect(result).toEqual({
      detached: ['leg-left'],
      parentId: 'torso',
      socketId: 'leg-left-socket',
    });
    expect(
      entityManager.getComponentData('leg-left', 'anatomy:joint')
    ).toBeNull();
    expect(eventDispatcher.events).toHaveLength(1);
    expect(eventDispatcher.events[0].payload.detachedCount).toBe(1);
  });

  it('finds parts by type with caching and invalidation after detach', async () => {
    await service.buildAdjacencyCache('actor-1');
    const initial = service.findPartsByType('actor-1', 'arm');
    expect(initial).toEqual(['arm-left']);

    entityManager.setComponent('arm-left', 'anatomy:part', { subType: 'wing' });
    const cached = service.findPartsByType('actor-1', 'arm');
    expect(cached).toEqual(['arm-left']);

    await service.detachPart('arm-left');
    entityManager.setComponent('arm-right', 'anatomy:part', { subType: 'arm' });
    entityManager.setComponent('arm-right', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'arm-right-socket',
    });
    entityManager.setComponent('hand-right', 'anatomy:part', {
      subType: 'hand',
    });
    entityManager.setComponent('hand-right', 'anatomy:joint', {
      parentId: 'arm-right',
      socketId: 'hand-right-socket',
    });

    await service.buildAdjacencyCache('actor-1');
    const updated = service.findPartsByType('actor-1', 'arm');
    expect(updated).toEqual(['arm-right']);
  });

  it('caches all parts and prefers actor cache roots', async () => {
    const bodyComponent = entityManager.getComponentData(
      'actor-1',
      'anatomy:body'
    );
    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);

    await service.buildAdjacencyCache('actor-1');
    const actorParts = service.getAllParts(bodyComponent, 'actor-1');
    expect(actorParts).toEqual(
      expect.arrayContaining([
        'actor-1',
        'torso',
        'arm-left',
        'hand-left',
        'leg-left',
        'foot-left',
        'heart',
      ])
    );

    const blueprintParts = service.getAllParts({ body: { root: 'torso' } });
    expect(blueprintParts).toEqual(
      expect.arrayContaining([
        'torso',
        'arm-left',
        'hand-left',
        'leg-left',
        'foot-left',
        'heart',
      ])
    );

    entityManager.setComponent('heart', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'heart-socket',
    });
    const cached = service.getAllParts({ body: { root: 'torso' } });
    entityManager.setComponent('heart', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'updated',
    });
    const cachedAgain = service.getAllParts({ body: { root: 'torso' } });
    expect(cachedAgain).toEqual(cached);
    expect(
      logger
        .messages('debug')
        .some(
          (msg) =>
            typeof msg === 'string' &&
            msg.includes("CACHE HIT for cache root 'torso'")
        )
    ).toBe(true);

    await service.detachPart('heart');
    await service.buildAdjacencyCache('actor-1');
    const actorAfterDetach = service.getAllParts(bodyComponent, 'actor-1');
    expect(actorAfterDetach).not.toContain('heart');
  });

  it('detects components and nested values across the anatomy', async () => {
    await service.buildAdjacencyCache('actor-1');
    const bodyComponent = entityManager.getComponentData(
      'actor-1',
      'anatomy:body'
    );
    expect(service.hasPartWithComponent(bodyComponent, 'anatomy:tag')).toBe(
      true
    );

    entityManager.setComponent('arm-left', 'anatomy:tag', {});
    expect(service.hasPartWithComponent(bodyComponent, 'anatomy:tag')).toBe(
      false
    );

    const valueMatch = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:sensors',
      'status.active',
      true
    );
    expect(valueMatch).toEqual({ found: true, partId: 'leg-left' });

    const noMatch = service.hasPartWithComponentValue(
      bodyComponent,
      'anatomy:sensors',
      'status.disabled',
      true
    );
    expect(noMatch).toEqual({ found: false });
  });

  it('retrieves body graphs and anatomy data while validating input', async () => {
    await expect(service.getBodyGraph('')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph('missing')).rejects.toThrow(
      'Entity missing has no anatomy:body component'
    );

    const bodyGraph = await service.getBodyGraph('actor-1');
    expect(bodyGraph.getAllPartIds()).toEqual(
      expect.arrayContaining(['actor-1', 'torso', 'arm-left', 'leg-left'])
    );
    expect(bodyGraph.getConnectedParts('torso')).toEqual(
      expect.arrayContaining(['arm-left', 'leg-left', 'heart'])
    );

    await expect(service.getAnatomyData('')).rejects.toThrow(
      InvalidArgumentError
    );
    const missingData = await service.getAnatomyData('missing');
    expect(missingData).toBeNull();
    expect(
      logger
        .messages('debug')
        .some(
          (msg) =>
            typeof msg === 'string' &&
            msg.includes('has no anatomy:body component')
        )
    ).toBe(true);

    const anatomyData = await service.getAnatomyData('actor-1');
    expect(anatomyData).toEqual({
      recipeId: 'humanoid_base',
      rootEntityId: 'actor-1',
    });
  });

  it('rejects detach attempts when part lacks a joint', async () => {
    await expect(service.detachPart('floating')).rejects.toThrow(
      "Entity 'floating' has no joint component"
    );
  });
});
