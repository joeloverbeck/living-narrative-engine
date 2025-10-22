import { beforeEach, describe, expect, it } from '@jest/globals';

import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import {
  AnatomyQueryCache,
  CacheKeyGenerators,
} from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

class InMemoryEntityManager {
  constructor(initialEntities = {}) {
    this.entities = new Map();
    this.getEntitiesWithComponentCalls = 0;

    Object.entries(initialEntities).forEach(([entityId, components]) => {
      const componentMap = new Map();
      Object.entries(components).forEach(([componentId, value]) => {
        componentMap.set(componentId, value);
      });
      this.entities.set(entityId, componentMap);
    });
  }

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
    this.entities.get(entityId).set(componentId, value);
  }

  async removeComponent(entityId, componentId) {
    this.entities.get(entityId)?.delete(componentId);
  }

  getComponentData(entityId, componentId) {
    if (!this.entities.has(entityId)) {
      return null;
    }

    const value = this.entities.get(entityId).get(componentId);
    return value === undefined ? null : value;
  }

  getEntitiesWithComponent(componentId) {
    this.getEntitiesWithComponentCalls += 1;
    const results = [];
    for (const [entityId, components] of this.entities.entries()) {
      if (components.has(componentId)) {
        results.push({ id: entityId });
      }
    }
    return results;
  }

  getEntityInstance(entityId) {
    if (!this.entities.has(entityId)) {
      throw new Error(`Entity ${entityId} not found`);
    }

    return {
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

const createLogger = () => {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const capture = (level) => (...args) => {
    const rendered = args
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');
    messages[level].push(rendered);
  };

  return {
    messages,
    debug: capture('debug'),
    info: capture('info'),
    warn: capture('warn'),
    error: capture('error'),
  };
};

const createBodySet = (actorId, label) => {
  const torsoId = `${actorId}:${label}:torso`;
  const leftArmId = `${actorId}:${label}:leftArm`;
  const rightArmId = `${actorId}:${label}:rightArm`;
  const leftHandId = `${actorId}:${label}:leftHand`;
  const rightHandId = `${actorId}:${label}:rightHand`;
  const headId = `${actorId}:${label}:head`;
  const heartId = `${actorId}:${label}:heart`;

  const structure = {
    rootPartId: torsoId,
    parts: {
      [torsoId]: {
        children: [leftArmId, rightArmId, headId, heartId],
        partType: 'torso',
      },
      [leftArmId]: { children: [leftHandId], partType: 'arm' },
      [rightArmId]: { children: [rightHandId], partType: 'arm' },
      [leftHandId]: { children: [], partType: 'hand' },
      [rightHandId]: { children: [], partType: 'hand' },
      [headId]: { children: [], partType: 'head' },
      [heartId]: { children: [], partType: 'organ' },
    },
  };

  const bodyComponent = {
    recipeId: `${actorId}.recipe`,
    body: { root: actorId },
    root: torsoId,
    structure,
  };

  const components = {
    [actorId]: {
      'anatomy:body': bodyComponent,
    },
    [torsoId]: {
      'anatomy:part': { subType: 'torso' },
      'anatomy:joint': { parentId: actorId, socketId: `${label}-core` },
    },
    [leftArmId]: {
      'anatomy:part': { subType: 'arm' },
      'anatomy:joint': { parentId: torsoId, socketId: `${label}-shoulder-left` },
      'custom:decor': {},
    },
    [rightArmId]: {
      'anatomy:part': { subType: 'arm' },
      'anatomy:joint': { parentId: torsoId, socketId: `${label}-shoulder-right` },
    },
    [leftHandId]: {
      'anatomy:part': { subType: 'hand' },
      'anatomy:joint': { parentId: leftArmId, socketId: `${label}-wrist-left` },
      'sensors:touch': { details: { sensitivity: 'high' } },
    },
    [rightHandId]: {
      'anatomy:part': { subType: 'hand' },
      'anatomy:joint': { parentId: rightArmId, socketId: `${label}-wrist-right` },
    },
    [headId]: {
      'anatomy:part': { subType: 'head' },
      'anatomy:joint': { parentId: torsoId, socketId: `${label}-neck` },
    },
    [heartId]: {
      'anatomy:part': { subType: 'organ' },
      'anatomy:joint': { parentId: torsoId, socketId: `${label}-chest` },
    },
  };

  return {
    actorId,
    ids: {
      torsoId,
      leftArmId,
      rightArmId,
      leftHandId,
      rightHandId,
      headId,
      heartId,
    },
    bodyComponent,
    components,
  };
};

const createEntitySeed = (...bodySets) => {
  const base = {
    spectator: {},
    'loose:trinket': {
      'anatomy:part': { subType: 'ornament' },
    },
  };

  for (const set of bodySets) {
    Object.entries(set.components).forEach(([entityId, components]) => {
      base[entityId] = { ...components };
    });
  }

  return base;
};

describe('BodyGraphService integration – multi-root cache coordination', () => {
  let logger;
  let dispatcher;
  let entityManager;
  let queryCache;
  let service;
  let actorA;
  let actorB;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = new RecordingDispatcher();
    actorA = createBodySet('actor-alpha', 'alpha');
    actorB = createBodySet('actor-beta', 'beta');
    entityManager = new InMemoryEntityManager(createEntitySeed(actorA, actorB));
    queryCache = new AnatomyQueryCache({ logger });
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache,
    });
  });

  it('validates required dependencies and supports default query cache', async () => {
    const minimalBody = createBodySet('actor-gamma', 'gamma');
    const minimalManager = new InMemoryEntityManager(
      createEntitySeed(minimalBody)
    );
    const minimalLogger = createLogger();
    const minimalDispatcher = new RecordingDispatcher();

    expect(() =>
      new BodyGraphService({
        logger: minimalLogger,
        eventDispatcher: minimalDispatcher,
      })
    ).toThrow(InvalidArgumentError);
    expect(() =>
      new BodyGraphService({
        entityManager: minimalManager,
        eventDispatcher: minimalDispatcher,
      })
    ).toThrow(InvalidArgumentError);
    expect(() =>
      new BodyGraphService({ entityManager: minimalManager, logger: minimalLogger })
    ).toThrow(InvalidArgumentError);

    const defaultCacheService = new BodyGraphService({
      entityManager: minimalManager,
      logger: minimalLogger,
      eventDispatcher: minimalDispatcher,
    });

    await defaultCacheService.buildAdjacencyCache(minimalBody.actorId);
    const parts = defaultCacheService.getAllParts(
      minimalBody.bodyComponent,
      minimalBody.actorId
    );
    expect(parts).toEqual(
      expect.arrayContaining([
        minimalBody.ids.torsoId,
        minimalBody.ids.leftArmId,
        minimalBody.ids.rightArmId,
      ])
    );

    const secondPass = defaultCacheService.getAllParts(
      minimalBody.bodyComponent,
      minimalBody.actorId
    );
    expect(secondPass).toEqual(parts);
  });

  it('performs cache orchestration and graph traversal across multiple anatomies', async () => {
    expect(service.hasCache(actorA.actorId)).toBe(false);
    await service.buildAdjacencyCache(actorA.actorId);
    const initialBuildCalls = entityManager.getEntitiesWithComponentCalls;
    await service.buildAdjacencyCache(actorA.actorId);
    expect(entityManager.getEntitiesWithComponentCalls).toBe(initialBuildCalls);

    await service.buildAdjacencyCache(actorB.actorId);
    expect(service.hasCache(actorB.actorId)).toBe(true);

    expect(service.getChildren(actorA.ids.torsoId)).toEqual(
      expect.arrayContaining([
        actorA.ids.leftArmId,
        actorA.ids.rightArmId,
        actorA.ids.headId,
        actorA.ids.heartId,
      ])
    );
    expect(service.getChildren('unknown')).toEqual([]);

    expect(service.getParent(actorA.ids.leftArmId)).toBe(actorA.ids.torsoId);
    expect(service.getParent('missing')).toBeNull();

    expect(service.getAncestors(actorA.ids.leftHandId)).toEqual([
      actorA.ids.leftArmId,
      actorA.ids.torsoId,
      actorA.actorId,
    ]);
    expect(service.getAncestors(actorA.actorId)).toEqual([]);

    const descendants = service.getAllDescendants(actorA.ids.torsoId);
    expect(descendants).toEqual(
      expect.arrayContaining([
        actorA.ids.leftArmId,
        actorA.ids.leftHandId,
        actorA.ids.rightArmId,
        actorA.ids.rightHandId,
        actorA.ids.headId,
        actorA.ids.heartId,
      ])
    );
    expect(descendants).not.toContain(actorA.ids.torsoId);

    expect(service.findPartsByType()).toEqual([]);
    const armsFirst = service.findPartsByType(actorA.actorId, 'arm');
    expect(armsFirst.sort()).toEqual([
      actorA.ids.leftArmId,
      actorA.ids.rightArmId,
    ]);
    const findArmsKey = CacheKeyGenerators.findPartsByType(
      actorA.actorId,
      'arm'
    );
    expect(queryCache.has(findArmsKey)).toBe(true);
    queryCache.set(findArmsKey, ['cached-arm'], actorA.actorId);
    expect(service.findPartsByType(actorA.actorId, 'arm')).toEqual([
      'cached-arm',
    ]);
    queryCache.invalidateRoot(actorA.actorId);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);
    const blueprintOnly = { root: actorA.ids.torsoId };
    expect(service.getAllParts(blueprintOnly)).toEqual(
      expect.arrayContaining([
        actorA.ids.torsoId,
        actorA.ids.leftArmId,
        actorA.ids.rightArmId,
      ])
    );
    const ghostLookup = service.getAllParts(actorA.bodyComponent, 'ghost-actor');
    expect(ghostLookup).toEqual(expect.arrayContaining(armsFirst));
    const allParts = service.getAllParts(actorA.bodyComponent, actorA.actorId);
    expect(allParts).toEqual(expect.arrayContaining(armsFirst));
    const getAllKey = CacheKeyGenerators.getAllParts(actorA.actorId);
    expect(queryCache.has(getAllKey)).toBe(true);
    queryCache.set(getAllKey, ['cached-root'], actorA.actorId);
    expect(service.getAllParts(actorA.bodyComponent, actorA.actorId)).toEqual([
      'cached-root',
    ]);
    queryCache.invalidateRoot(actorA.actorId);

    expect(service.hasPartWithComponent(actorA.bodyComponent, 'custom:decor')).toBe(
      false
    );
    entityManager.setComponent(actorA.ids.leftArmId, 'custom:decor', {
      details: { color: 'blue' },
    });
    expect(service.hasPartWithComponent(actorA.bodyComponent, 'custom:decor')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(actorA.bodyComponent, 'missing:component')
    ).toBe(false);

    const valueHit = service.hasPartWithComponentValue(
      actorA.bodyComponent,
      'custom:decor',
      'details.color',
      'blue'
    );
    expect(valueHit).toEqual({ found: true, partId: actorA.ids.leftArmId });
    const valueMiss = service.hasPartWithComponentValue(
      actorA.bodyComponent,
      'custom:decor',
      'details.pattern',
      'striped'
    );
    expect(valueMiss).toEqual({ found: false });

    expect(service.getAnatomyRoot(actorA.ids.leftHandId)).toBe(actorA.actorId);
    expect(service.getAnatomyRoot('spectator')).toBe('spectator');

    expect(service.getPath(actorA.ids.leftHandId, actorA.ids.leftHandId)).toEqual([
      actorA.ids.leftHandId,
    ]);
    expect(service.getPath(actorA.ids.leftHandId, 'loose:trinket')).toBeNull();
    expect(service.getPath(actorA.ids.leftHandId, actorA.ids.rightHandId)).toEqual([
      actorA.ids.leftHandId,
      actorA.ids.leftArmId,
      actorA.ids.torsoId,
      actorA.ids.rightArmId,
      actorA.ids.rightHandId,
    ]);

    const graph = await service.getBodyGraph(actorA.actorId);
    expect(graph.getAllPartIds()).toEqual(expect.arrayContaining(allParts));
    expect(graph.getConnectedParts(actorA.ids.leftArmId)).toEqual([
      actorA.ids.leftHandId,
    ]);
    await expect(service.getBodyGraph('spectator')).rejects.toThrow(
      'has no anatomy:body component'
    );
    await expect(service.getBodyGraph(42)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    const anatomyData = await service.getAnatomyData(actorA.actorId);
    expect(anatomyData).toEqual({
      recipeId: actorA.bodyComponent.recipeId,
      rootEntityId: actorA.actorId,
    });
    expect(await service.getAnatomyData('spectator')).toBeNull();
    await expect(service.getAnatomyData()).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    const cacheValidation = service.validateCache();
    expect(cacheValidation).toEqual({ valid: true, issues: [] });

    service.findPartsByType(actorA.actorId, 'arm');
    service.getAllParts(actorA.bodyComponent, actorA.actorId);
    const detachCascade = await service.detachPart(actorA.ids.leftArmId, {
      reason: 'accident',
    });
    expect(detachCascade.detached.sort()).toEqual([
      actorA.ids.leftArmId,
      actorA.ids.leftHandId,
    ]);
    expect(detachCascade.parentId).toBe(actorA.ids.torsoId);
    expect(detachCascade.socketId).toContain('shoulder-left');
    expect(
      entityManager.getComponentData(actorA.ids.leftArmId, 'anatomy:joint')
    ).toBeNull();
    expect(service.hasCache(actorA.actorId)).toBe(false);
    const armsKeyAfterDetach = CacheKeyGenerators.findPartsByType(
      actorA.actorId,
      'arm'
    );
    expect(queryCache.has(armsKeyAfterDetach)).toBe(false);
    expect(dispatcher.events.at(-1)).toMatchObject({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({
        detachedEntityId: actorA.ids.leftArmId,
        parentEntityId: actorA.ids.torsoId,
        socketId: expect.stringContaining('shoulder-left'),
        detachedCount: 2,
        reason: 'accident',
      }),
    });
    expect(dispatcher.events.at(-1).payload.timestamp).toBeGreaterThan(0);

    entityManager.setComponent(actorA.ids.leftArmId, 'anatomy:joint', {
      parentId: actorA.ids.torsoId,
      socketId: 'alpha-shoulder-left',
    });
    await service.buildAdjacencyCache(actorA.actorId);

    const detachNoCascade = await service.detachPart(actorB.ids.rightArmId, {
      cascade: false,
      reason: 'maintenance',
    });
    expect(detachNoCascade.detached).toEqual([actorB.ids.rightArmId]);
    expect(detachNoCascade.parentId).toBe(actorB.ids.torsoId);
    expect(detachNoCascade.socketId).toContain('shoulder-right');
    expect(
      dispatcher.events.some((event) => event.payload.reason === 'maintenance')
    ).toBe(true);

    await expect(service.detachPart('loose:trinket')).rejects.toThrow(
      InvalidArgumentError
    );
  });
});
