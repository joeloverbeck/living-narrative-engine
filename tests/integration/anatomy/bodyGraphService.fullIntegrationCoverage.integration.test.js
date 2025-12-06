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

class InMemoryEntityInstance {
  constructor(manager, entityId) {
    this.#manager = manager;
    this.#entityId = entityId;
  }

  #manager;
  #entityId;

  getComponentData(componentId) {
    return this.#manager.getComponentData(this.#entityId, componentId);
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

  entities;
  getEntitiesWithComponentCalls;

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
    return new InMemoryEntityInstance(this, entityId);
  }
}

const ACTOR_ID = 'actor';

const createLogger = () => {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const capture =
    (level) =>
    (...args) => {
      const rendered = args
        .map((value) =>
          typeof value === 'string' ? value : JSON.stringify(value)
        )
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

const createBodyComponent = () => ({
  recipeId: 'humanoid.basic',
  body: { root: ACTOR_ID },
  root: 'torso',
  structure: {
    rootPartId: 'torso',
    parts: {
      torso: {
        children: ['leftArm', 'rightArm', 'head', 'heart'],
        partType: 'torso',
      },
      leftArm: { children: ['leftHand'], partType: 'arm' },
      rightArm: { children: ['rightHand'], partType: 'arm' },
      leftHand: { children: [], partType: 'hand' },
      rightHand: { children: [], partType: 'hand' },
      head: { children: [], partType: 'head' },
      heart: { children: [], partType: 'organ' },
    },
  },
});

const createEntitySeed = (bodyComponent) => ({
  [ACTOR_ID]: {
    'anatomy:body': bodyComponent,
  },
  torso: {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: ACTOR_ID, socketId: 'spine' },
  },
  leftArm: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-left' },
    'custom:decor': { details: { color: 'blue' } },
  },
  leftHand: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'leftArm', socketId: 'wrist-left' },
    'sensors:touch': { sensitivity: 'high' },
  },
  rightArm: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-right' },
    'custom:decor': {},
  },
  rightHand: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'rightArm', socketId: 'wrist-right' },
  },
  head: {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: 'torso', socketId: 'neck' },
  },
  heart: {
    'anatomy:part': { subType: 'organ' },
    'anatomy:joint': { parentId: 'torso', socketId: 'chest' },
  },
  ornament: {
    'anatomy:part': { subType: 'ornament' },
  },
  spectator: {},
});

describe('BodyGraphService integration – end-to-end cache and graph behaviors', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let queryCache;
  let service;
  let bodyComponent;

  beforeEach(() => {
    logger = createLogger();
    dispatcher = new RecordingDispatcher();
    bodyComponent = createBodyComponent();
    entityManager = new InMemoryEntityManager(createEntitySeed(bodyComponent));
    queryCache = new AnatomyQueryCache({ logger });
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache,
    });
  });

  it('builds caches once, resolves anatomy graph queries, and reuses cached results', async () => {
    const altService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    expect(altService.hasCache(ACTOR_ID)).toBe(false);

    await service.buildAdjacencyCache(ACTOR_ID);
    expect(service.hasCache(ACTOR_ID)).toBe(true);
    const buildCallCount = entityManager.getEntitiesWithComponentCalls;
    await service.buildAdjacencyCache(ACTOR_ID);
    expect(entityManager.getEntitiesWithComponentCalls).toBe(buildCallCount);

    expect(service.getChildren('torso')).toEqual(
      expect.arrayContaining(['leftArm', 'rightArm', 'head', 'heart'])
    );
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('leftArm')).toBe('torso');
    expect(service.getParent('missing')).toBeNull();
    expect(service.getAncestors('leftHand')).toEqual([
      'leftArm',
      'torso',
      ACTOR_ID,
    ]);
    expect(service.getAncestors('torso')).toEqual([ACTOR_ID]);

    const descendants = service.getAllDescendants('torso');
    expect(descendants).toEqual(
      expect.arrayContaining([
        'leftArm',
        'leftHand',
        'rightArm',
        'rightHand',
        'head',
        'heart',
      ])
    );

    expect(service.findPartsByType()).toEqual([]);
    const armsFirst = service.findPartsByType(ACTOR_ID, 'arm');
    expect(armsFirst.sort()).toEqual(['leftArm', 'rightArm']);
    const findArmsKey = CacheKeyGenerators.findPartsByType(ACTOR_ID, 'arm');
    expect(queryCache.has(findArmsKey)).toBe(true);
    queryCache.set(findArmsKey, ['cached-arm'], ACTOR_ID);
    expect(service.findPartsByType(ACTOR_ID, 'arm')).toEqual(['cached-arm']);
    queryCache.invalidateRoot(ACTOR_ID);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);
    const blueprintOnly = { root: bodyComponent.structure.rootPartId };
    expect(service.getAllParts(blueprintOnly).length).toBeGreaterThan(0);
    const allParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(allParts).toEqual(
      expect.arrayContaining([
        'torso',
        'leftArm',
        'leftHand',
        'rightArm',
        'rightHand',
        'head',
        'heart',
      ])
    );
    expect(service.getAllParts(bodyComponent, 'untracked-actor')).toEqual(
      expect.arrayContaining([
        'torso',
        'leftArm',
        'leftHand',
        'rightArm',
        'rightHand',
        'head',
        'heart',
      ])
    );
    const getAllPartsKey = CacheKeyGenerators.getAllParts(ACTOR_ID);
    expect(queryCache.has(getAllPartsKey)).toBe(true);
    queryCache.set(getAllPartsKey, ['cached-root'], ACTOR_ID);
    expect(service.getAllParts(bodyComponent, ACTOR_ID)).toEqual([
      'cached-root',
    ]);
    queryCache.invalidateRoot(ACTOR_ID);

    entityManager.setComponent('leftArm', 'custom:decor', {});
    entityManager.setComponent('rightArm', 'custom:decor', {});
    expect(service.hasPartWithComponent(bodyComponent, 'custom:decor')).toBe(
      false
    );
    entityManager.setComponent('leftArm', 'custom:decor', {
      details: { color: 'blue' },
    });
    expect(service.hasPartWithComponent(bodyComponent, 'custom:decor')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'missing:component')
    ).toBe(false);

    const valueMatch = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:decor',
      'details.color',
      'blue'
    );
    expect(valueMatch).toEqual({ found: true, partId: 'leftArm' });
    const valueMiss = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:decor',
      'details.color',
      'green'
    );
    expect(valueMiss).toEqual({ found: false });

    expect(service.getAnatomyRoot('leftHand')).toBe(ACTOR_ID);
    expect(service.getAnatomyRoot('spectator')).toBe('spectator');

    expect(service.getPath('torso', 'torso')).toEqual(['torso']);
    expect(service.getPath('leftHand', 'ornament')).toBeNull();
    expect(service.getPath('leftHand', 'rightHand')).toEqual([
      'leftHand',
      'leftArm',
      'torso',
      'rightArm',
      'rightHand',
    ]);

    const graph = await service.getBodyGraph(ACTOR_ID);
    expect(graph.getAllPartIds()).toEqual(expect.arrayContaining(allParts));
    expect(graph.getConnectedParts('leftArm')).toEqual(['leftHand']);
    await expect(service.getBodyGraph('spectator')).rejects.toThrow(
      'Entity spectator has no anatomy:body component'
    );
    await expect(service.getBodyGraph(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    const anatomyData = await service.getAnatomyData(ACTOR_ID);
    expect(anatomyData).toEqual({
      recipeId: 'humanoid.basic',
      rootEntityId: ACTOR_ID,
    });
    expect(await service.getAnatomyData('spectator')).toBeNull();
    await expect(service.getAnatomyData()).rejects.toThrow(
      'Entity ID is required and must be a string'
    );

    const cacheValidation = service.validateCache();
    expect(cacheValidation).toEqual({ valid: true, issues: [] });
  });

  it('detaches parts, invalidates caches, and reports invalid operations', async () => {
    await service.buildAdjacencyCache(ACTOR_ID);
    service.findPartsByType(ACTOR_ID, 'arm');
    service.getAllParts(bodyComponent, ACTOR_ID);
    const armsKey = CacheKeyGenerators.findPartsByType(ACTOR_ID, 'arm');
    const getAllKey = CacheKeyGenerators.getAllParts(ACTOR_ID);
    expect(queryCache.has(armsKey)).toBe(true);
    expect(queryCache.has(getAllKey)).toBe(true);

    const detachResult = await service.detachPart('leftArm', {
      reason: 'injury',
    });
    expect(detachResult.detached.sort()).toEqual(['leftArm', 'leftHand']);
    expect(detachResult.parentId).toBe('torso');
    expect(detachResult.socketId).toBe('shoulder-left');
    expect(
      entityManager.getComponentData('leftArm', 'anatomy:joint')
    ).toBeNull();
    expect(service.hasCache(ACTOR_ID)).toBe(false);
    expect(queryCache.has(armsKey)).toBe(false);
    expect(queryCache.has(getAllKey)).toBe(false);
    expect(dispatcher.events[0]).toMatchObject({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({
        detachedEntityId: 'leftArm',
        parentEntityId: 'torso',
        socketId: 'shoulder-left',
        detachedCount: 2,
        reason: 'injury',
      }),
    });
    expect(dispatcher.events[0].payload.timestamp).toBeGreaterThan(0);

    entityManager.setComponent('leftArm', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'shoulder-left',
    });
    entityManager.setComponent('leftArm', 'anatomy:part', { subType: 'arm' });
    entityManager.setComponent('leftHand', 'anatomy:joint', {
      parentId: 'leftArm',
      socketId: 'wrist-left',
    });

    await service.buildAdjacencyCache(ACTOR_ID);
    const noCascadeResult = await service.detachPart('rightArm', {
      cascade: false,
      reason: 'surgery',
    });
    expect(noCascadeResult.detached).toEqual(['rightArm']);
    expect(noCascadeResult.parentId).toBe('torso');
    expect(noCascadeResult.socketId).toBe('shoulder-right');
    expect(
      dispatcher.events.some((event) => event.payload.reason === 'surgery')
    ).toBe(true);

    await expect(service.detachPart('ornament')).rejects.toThrow(
      InvalidArgumentError
    );
  });
});
