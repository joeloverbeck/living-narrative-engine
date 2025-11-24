import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
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

const buildAnatomyFixture = (entityManager) => {
  entityManager.createEntity('blueprint-root', {
    'anatomy:body': {
      recipeId: 'humanoid_blueprint',
      body: { root: 'bp:torso' },
      structure: { rootPartId: 'bp:torso' },
    },
  });
  entityManager.createEntity('bp:torso', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'blueprint-root', socketId: 'bp-core' },
  });
  entityManager.createEntity('bp:arm-left', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'bp:torso', socketId: 'bp-arm-left' },
  });
  entityManager.createEntity('bp:hand-left', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'bp:arm-left', socketId: 'bp-hand-left' },
  });

  entityManager.createEntity('actor-1', {
    'core:name': { text: 'Primary Actor' },
    'anatomy:body': {
      recipeId: 'humanoid_runtime',
      body: { root: 'actor:torso' },
      structure: { rootPartId: 'bp:torso' },
    },
  });
  entityManager.createEntity('actor:torso', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'actor-1', socketId: 'core-socket' },
  });
  entityManager.createEntity('actor:arm-left', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'actor:torso', socketId: 'arm-left-socket' },
    'anatomy:tag': { strength: 7 },
  });
  entityManager.createEntity('actor:hand-left', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'actor:arm-left', socketId: 'hand-left-socket' },
  });
  entityManager.createEntity('actor:arm-right', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'actor:torso', socketId: 'arm-right-socket' },
  });
  entityManager.createEntity('actor:leg-left', {
    'anatomy:part': { subType: 'leg' },
    'anatomy:joint': { parentId: 'actor:torso', socketId: 'leg-left-socket' },
    'anatomy:sensors': { status: { engaged: true, sealed: false } },
  });
  entityManager.createEntity('actor:foot-left', {
    'anatomy:part': { subType: 'foot' },
    'anatomy:joint': { parentId: 'actor:leg-left', socketId: 'foot-left-socket' },
  });
  entityManager.createEntity('actor:head', {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: 'actor:torso', socketId: 'head-socket' },
  });
  entityManager.createEntity('floating-part', {
    'anatomy:part': { subType: 'floating' },
  });
  entityManager.createEntity('no-body', {
    'core:name': { text: 'Ghost' },
  });

  return {
    actorBody: entityManager.getComponentData('actor-1', 'anatomy:body'),
    blueprintBody: entityManager.getComponentData('blueprint-root', 'anatomy:body'),
  };
};

const collectDebugMessages = (logger, predicate) =>
  logger.messages('debug').filter(predicate);

describe('BodyGraphService multi-root cache integration', () => {
  let entityManager;
  let logger;
  let eventDispatcher;
  let queryCache;
  let service;
  let actorBody;
  let blueprintBody;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    entityManager = new TestEntityManager();
    ({ actorBody, blueprintBody } = buildAnatomyFixture(entityManager));

    logger = new TestLogger();
    eventDispatcher = new TestEventDispatcher();
    queryCache = new AnatomyQueryCache({ logger });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher,
      queryCache,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds caches for actor and blueprint roots and reuses query results', async () => {
    await service.buildAdjacencyCache('actor-1');
    expect(service.hasCache('actor-1')).toBe(true);
    expect(service.getChildren('actor-1')).toEqual(['actor:torso']);

    const allPartsFirst = service.getAllParts(actorBody, 'actor-1');
    expect(allPartsFirst).toEqual(
      expect.arrayContaining([
        'actor-1',
        'actor:torso',
        'actor:arm-left',
        'actor:hand-left',
        'actor:arm-right',
        'actor:leg-left',
        'actor:foot-left',
        'actor:head',
      ])
    );

    const allPartsSecond = service.getAllParts(actorBody, 'actor-1');
    expect(allPartsSecond).toEqual(allPartsFirst);
    expect(
      logger
        .messages('info')
        .filter(
          (msg) =>
            typeof msg === 'string' &&
            msg.includes(
              "BodyGraphService.getAllParts: CACHE HIT for cache root 'actor-1'"
            )
        ).length
    ).toBeGreaterThanOrEqual(1);

    const blueprintParts = service.getAllParts(blueprintBody);
    expect(blueprintParts).toEqual(
      expect.arrayContaining(['bp:torso', 'bp:arm-left', 'bp:hand-left'])
    );

    const actorViewOfBlueprint = service.getAllParts(blueprintBody, 'actor-1');
    expect(actorViewOfBlueprint).toEqual(allPartsFirst);

    const directRootLookup = service.getAllParts({ root: 'actor:torso' });
    expect(directRootLookup).toEqual(
      expect.arrayContaining([
        'actor:torso',
        'actor:arm-left',
        'actor:hand-left',
        'actor:arm-right',
        'actor:leg-left',
        'actor:foot-left',
        'actor:head',
      ])
    );

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);
  });

  it('supports graph navigation, caching and invalidation across detach operations', async () => {
    await service.buildAdjacencyCache('actor-1');

    expect(service.getParent('actor:arm-left')).toBe('actor:torso');
    expect(service.getAncestors('actor:foot-left')).toEqual([
      'actor:leg-left',
      'actor:torso',
      'actor-1',
    ]);

    const descendants = service.getAllDescendants('actor:torso');
    expect(descendants).toEqual(
      expect.arrayContaining([
        'actor:arm-left',
        'actor:hand-left',
        'actor:arm-right',
        'actor:leg-left',
        'actor:foot-left',
        'actor:head',
      ])
    );

    const path = service.getPath('actor:hand-left', 'actor:foot-left');
    expect(path).toEqual([
      'actor:hand-left',
      'actor:arm-left',
      'actor:torso',
      'actor:leg-left',
      'actor:foot-left',
    ]);

    const armsFirst = service.findPartsByType('actor-1', 'arm');
    expect(armsFirst).toEqual(
      expect.arrayContaining(['actor:arm-left', 'actor:arm-right'])
    );
    expect(armsFirst).toHaveLength(2);

    entityManager.setComponent('actor:arm-left', 'anatomy:part', {
      subType: 'claw',
    });
    const armsCached = service.findPartsByType('actor-1', 'arm');
    expect(armsCached).toEqual(
      expect.arrayContaining(['actor:arm-left', 'actor:arm-right'])
    );
    expect(armsCached).toHaveLength(2);

    const detachResult = await service.detachPart('actor:arm-left', {
      cascade: true,
      reason: 'injury',
    });

    expect(detachResult).toEqual({
      detached: ['actor:arm-left', 'actor:hand-left'],
      parentId: 'actor:torso',
      socketId: 'arm-left-socket',
    });
    expect(service.hasCache('actor-1')).toBe(false);
    expect(eventDispatcher.events).toHaveLength(1);
    expect(eventDispatcher.events[0]).toEqual({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({
        detachedEntityId: 'actor:arm-left',
        detachedCount: 2,
        parentEntityId: 'actor:torso',
        reason: 'injury',
        timestamp: 1700000000000,
      }),
    });

    expect(
      logger.messages('info').some((msg) =>
        typeof msg === 'string' && msg.includes('Detached 2 entities')
      )
    ).toBe(true);

    entityManager.setComponent('actor:arm-replacement', 'anatomy:part', {
      subType: 'arm',
    });
    entityManager.setComponent('actor:arm-replacement', 'anatomy:joint', {
      parentId: 'actor:torso',
      socketId: 'arm-replacement-socket',
    });

    await service.buildAdjacencyCache('actor-1');
    const armsAfterDetach = service.findPartsByType('actor-1', 'arm');
    expect(armsAfterDetach).toEqual(
      expect.arrayContaining(['actor:arm-right', 'actor:arm-replacement'])
    );
    expect(armsAfterDetach).toHaveLength(2);
  });

  it('retrieves body graphs, evaluates components, and handles error cases', async () => {
    await expect(service.getBodyGraph('')).rejects.toThrow(InvalidArgumentError);
    await expect(service.getBodyGraph('no-body')).rejects.toThrow(
      'Entity no-body has no anatomy:body component'
    );

    await service.buildAdjacencyCache('actor-1');

    const bodyGraph = await service.getBodyGraph('actor-1');
    expect(bodyGraph.getAllPartIds()).toEqual(
      expect.arrayContaining([
        'actor-1',
        'actor:torso',
        'actor:arm-left',
        'actor:hand-left',
        'actor:arm-right',
        'actor:leg-left',
        'actor:foot-left',
        'actor:head',
      ])
    );
    expect(bodyGraph.getConnectedParts('actor:torso')).toEqual(
      expect.arrayContaining([
        'actor:arm-left',
        'actor:arm-right',
        'actor:leg-left',
        'actor:head',
      ])
    );

    expect(service.getAnatomyRoot('actor:hand-left')).toBe('actor-1');

    const hasTag = service.hasPartWithComponent(actorBody, 'anatomy:tag');
    expect(hasTag).toBe(true);

    entityManager.setComponent('actor:arm-left', 'anatomy:tag', {});
    const hasTagAfterClear = service.hasPartWithComponent(
      actorBody,
      'anatomy:tag'
    );
    expect(hasTagAfterClear).toBe(false);

    const valueMatch = service.hasPartWithComponentValue(
      actorBody,
      'anatomy:sensors',
      'status.engaged',
      true
    );
    expect(valueMatch).toEqual({ found: true, partId: 'actor:leg-left' });

    const noValueMatch = service.hasPartWithComponentValue(
      actorBody,
      'anatomy:sensors',
      'status.sealed',
      true
    );
    expect(noValueMatch).toEqual({ found: false });

    await expect(service.getAnatomyData('')).rejects.toThrow(InvalidArgumentError);
    const missingData = await service.getAnatomyData('no-body');
    expect(missingData).toBeNull();
    expect(
      collectDebugMessages(logger, (msg) =>
        typeof msg === 'string' && msg.includes('has no anatomy:body component')
      ).length
    ).toBeGreaterThanOrEqual(1);

    const anatomyData = await service.getAnatomyData('actor-1');
    expect(anatomyData).toEqual({
      recipeId: 'humanoid_runtime',
      rootEntityId: 'actor-1',
    });

    await expect(service.detachPart('floating-part')).rejects.toThrow(
      "Entity 'floating-part' has no joint component"
    );
  });
});
