import { beforeEach, describe, expect, it } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.messages = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  #capture(level, args) {
    const rendered = args
      .map((value) =>
        typeof value === 'string' ? value : JSON.stringify(value)
      )
      .join(' ');
    this.messages[level].push(rendered);
  }

  debug(...args) {
    this.#capture('debug', args);
  }

  info(...args) {
    this.#capture('info', args);
  }

  warn(...args) {
    this.#capture('warn', args);
  }

  error(...args) {
    this.#capture('error', args);
  }
}

class RecordingEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

class InMemoryEntityManager {
  constructor() {
    this.entities = new Map();
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
    const components = this.entities.get(entityId);
    if (!components) {
      return null;
    }

    const value = components.get(componentId);
    return value === undefined ? null : this.#clone(value);
  }

  async removeComponent(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (components) {
      components.delete(componentId);
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
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

describe('BodyGraphService integration - graph traversal and cache coordination', () => {
  const actorId = 'actor-root';
  const torsoId = 'part-torso';
  const leftArmId = 'part-left-arm';
  const leftHandId = 'part-left-hand';
  const rightArmId = 'part-right-arm';
  const rightHandId = 'part-right-hand';
  const headId = 'part-head';
  const sensorId = 'part-sensor';
  const wingId = 'part-wing';

  let entityManager;
  let logger;
  let dispatcher;
  let queryCache;
  let service;
  let bodyComponent;

  beforeEach(async () => {
    logger = new RecordingLogger();
    dispatcher = new RecordingEventDispatcher();
    queryCache = new AnatomyQueryCache({ logger });
    entityManager = new InMemoryEntityManager();

    bodyComponent = {
      recipeId: 'integration.recipe',
      body: { root: actorId },
      structure: {
        rootPartId: torsoId,
        parts: {
          [torsoId]: {
            children: [leftArmId, rightArmId, headId, sensorId],
            partType: 'torso',
          },
          [leftArmId]: { children: [leftHandId], partType: 'arm' },
          [leftHandId]: { children: [], partType: 'hand' },
          [rightArmId]: { children: [rightHandId], partType: 'arm' },
          [rightHandId]: { children: [], partType: 'hand' },
          [headId]: { children: [], partType: 'head' },
          [sensorId]: { children: [], partType: 'sensor' },
        },
      },
    };

    entityManager.addComponent(actorId, 'anatomy:body', bodyComponent);

    entityManager.addComponent(torsoId, 'anatomy:part', { subType: 'torso' });
    entityManager.addComponent(torsoId, 'anatomy:joint', {
      parentId: actorId,
      socketId: 'socket-torso',
    });
    entityManager.addComponent(torsoId, 'vitals:core', { status: 'stable' });

    entityManager.addComponent(leftArmId, 'anatomy:part', { subType: 'arm' });
    entityManager.addComponent(leftArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'socket-left-shoulder',
    });

    entityManager.addComponent(leftHandId, 'anatomy:part', { subType: 'hand' });
    entityManager.addComponent(leftHandId, 'anatomy:joint', {
      parentId: leftArmId,
      socketId: 'socket-left-wrist',
    });
    entityManager.addComponent(leftHandId, 'equipment:weapon', {
      name: 'knife',
      metadata: { damage: { base: 5 }, rarity: 'common' },
    });

    entityManager.addComponent(rightArmId, 'anatomy:part', { subType: 'arm' });
    entityManager.addComponent(rightArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'socket-right-shoulder',
    });

    entityManager.addComponent(rightHandId, 'anatomy:part', {
      subType: 'hand',
    });
    entityManager.addComponent(rightHandId, 'anatomy:joint', {
      parentId: rightArmId,
      socketId: 'socket-right-wrist',
    });
    entityManager.addComponent(rightHandId, 'appearance:details', {
      color: 'silver',
    });

    entityManager.addComponent(headId, 'anatomy:part', { subType: 'head' });
    entityManager.addComponent(headId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'socket-neck',
    });

    entityManager.addComponent(sensorId, 'anatomy:part', { subType: 'sensor' });
    entityManager.addComponent(sensorId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'socket-sensor',
    });
    entityManager.addComponent(sensorId, 'perception:scanner', {
      type: 'thermal',
      calibrated: true,
    });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache,
    });

    await service.buildAdjacencyCache(actorId);
  });

  it('navigates, queries, and mutates the body graph using real caches and algorithms', async () => {
    const initialAllParts = service.getAllParts(bodyComponent, actorId);
    expect(initialAllParts).toEqual(
      expect.arrayContaining([
        actorId,
        torsoId,
        leftArmId,
        leftHandId,
        rightArmId,
        rightHandId,
        headId,
        sensorId,
      ])
    );
    expect(service.getAllParts(bodyComponent, actorId)).toBe(initialAllParts);

    const fallbackAllParts = service.getAllParts({ root: actorId });
    expect(fallbackAllParts).toEqual(expect.arrayContaining(initialAllParts));
    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    expect(
      service.hasPartWithComponent(bodyComponent, 'equipment:weapon')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'perception:scanner')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'nonexistent:component')
    ).toBe(false);

    const valueLookup = service.hasPartWithComponentValue(
      bodyComponent,
      'equipment:weapon',
      'metadata.damage.base',
      5
    );
    expect(valueLookup).toEqual({ found: true, partId: leftHandId });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'equipment:weapon',
        'metadata.damage.base',
        999
      )
    ).toEqual({ found: false });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'equipment:weapon',
        'metadata.enchantments.tier',
        'legendary'
      )
    ).toEqual({ found: false });

    const firstHandLookup = service.findPartsByType(actorId, 'hand');
    expect(firstHandLookup).toEqual(
      expect.arrayContaining([leftHandId, rightHandId])
    );
    const cachedHandLookup = service.findPartsByType(actorId, 'hand');
    expect(cachedHandLookup).toBe(firstHandLookup);

    const pathBetweenHands = service.getPath(leftHandId, rightHandId);
    expect(pathBetweenHands).toEqual([
      leftHandId,
      leftArmId,
      torsoId,
      rightArmId,
      rightHandId,
    ]);

    expect(service.getParent(leftHandId)).toBe(leftArmId);
    expect(service.getParent(actorId)).toBeNull();
    expect(service.getChildren(torsoId)).toEqual(
      expect.arrayContaining([leftArmId, rightArmId, headId, sensorId])
    );
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getAncestors(rightHandId)).toEqual([
      rightArmId,
      torsoId,
      actorId,
    ]);
    expect(service.getAncestors('unknown')).toEqual([]);
    expect(service.getAllDescendants(torsoId)).toEqual(
      expect.arrayContaining([
        leftArmId,
        leftHandId,
        rightArmId,
        rightHandId,
        headId,
        sensorId,
      ])
    );
    expect(service.getAllDescendants('unknown')).toEqual([]);

    const graph = await service.getBodyGraph(actorId);
    expect(graph.getAllPartIds()).toEqual(
      expect.arrayContaining(initialAllParts)
    );
    expect(graph.getConnectedParts(torsoId)).toEqual(
      expect.arrayContaining([leftArmId, rightArmId, headId, sensorId])
    );
    expect(graph.getConnectedParts('non-existent')).toEqual([]);

    const anatomyData = await service.getAnatomyData(actorId);
    expect(anatomyData).toEqual({
      recipeId: bodyComponent.recipeId,
      rootEntityId: actorId,
    });
    expect(await service.getAnatomyData(leftArmId)).toBeNull();

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
    expect(service.hasCache(actorId)).toBe(true);

    const miniActorId = 'mini-actor';
    const miniRootId = 'mini-root';
    entityManager.addComponent(miniActorId, 'anatomy:body', {
      body: { root: miniActorId },
      structure: {
        rootPartId: miniRootId,
        parts: {
          [miniRootId]: { children: [], partType: 'core' },
        },
      },
    });
    entityManager.addComponent(miniRootId, 'anatomy:part', { subType: 'core' });
    entityManager.addComponent(miniRootId, 'anatomy:joint', {
      parentId: miniActorId,
      socketId: 'socket-mini-root',
    });
    await service.buildAdjacencyCache(miniActorId);
    const minimalParts = service.getAllParts(
      entityManager.getComponentData(miniActorId, 'anatomy:body'),
      miniActorId
    );
    expect(minimalParts).toEqual([miniActorId, miniRootId]);

    entityManager.addComponent(wingId, 'anatomy:part', { subType: 'wing' });
    entityManager.addComponent(wingId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'socket-wing',
    });
    expect(service.getAnatomyRoot(wingId)).toBe(actorId);
    expect(service.getAnatomyRoot(null)).toBeNull();

    const wingDetach = await service.detachPart(wingId);
    expect(wingDetach.detached).toEqual([wingId]);
    expect(service.hasCache(actorId)).toBe(false);
    entityManager.addComponent(wingId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'socket-wing',
    });
    await service.buildAdjacencyCache(actorId);

    const firstAllPartsArray = service.getAllParts(bodyComponent, actorId);
    const detachResult = await service.detachPart(leftArmId, {
      cascade: false,
      reason: 'maintenance',
    });
    expect(detachResult).toEqual({
      detached: [leftArmId],
      parentId: torsoId,
      socketId: 'socket-left-shoulder',
    });
    expect(service.hasCache(actorId)).toBe(false);
    expect(service.getChildren(torsoId)).toEqual([]);
    expect(dispatcher.events[dispatcher.events.length - 1]).toMatchObject({
      eventId: LIMB_DETACHED_EVENT_ID,
      payload: expect.objectContaining({
        detachedEntityId: leftArmId,
        parentEntityId: torsoId,
        socketId: 'socket-left-shoulder',
        detachedCount: 1,
        reason: 'maintenance',
      }),
    });

    entityManager.addComponent(leftArmId, 'anatomy:joint', {
      parentId: torsoId,
      socketId: 'socket-left-shoulder',
    });
    await service.buildAdjacencyCache(actorId);
    expect(service.hasCache(actorId)).toBe(true);

    const rebuiltAllParts = service.getAllParts(bodyComponent, actorId);
    expect(rebuiltAllParts).toEqual(
      expect.arrayContaining([
        actorId,
        torsoId,
        leftArmId,
        leftHandId,
        rightArmId,
        rightHandId,
        headId,
        sensorId,
        wingId,
      ])
    );
    expect(rebuiltAllParts).not.toBe(firstAllPartsArray);

    const rebuiltHands = service.findPartsByType(actorId, 'hand');
    expect(rebuiltHands).toEqual(
      expect.arrayContaining([leftHandId, rightHandId])
    );

    const danglingId = 'part-dangling';
    entityManager.addComponent(danglingId, 'anatomy:part', {
      subType: 'tether',
    });
    entityManager.addComponent(danglingId, 'anatomy:joint', {
      parentId: null,
      socketId: 'socket-dangling',
    });
    const danglingDetach = await service.detachPart(danglingId);
    expect(danglingDetach).toEqual({
      detached: [danglingId],
      parentId: null,
      socketId: 'socket-dangling',
    });

    const serviceWithInternalCache = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    await serviceWithInternalCache.buildAdjacencyCache(actorId);
    const internalCacheParts = serviceWithInternalCache.getAllParts(
      bodyComponent,
      actorId
    );
    expect(internalCacheParts).toEqual(expect.arrayContaining(rebuiltAllParts));

    await expect(service.getBodyGraph('missing-actor')).rejects.toThrow(
      'has no anatomy:body component'
    );
    await expect(service.getBodyGraph(123)).rejects.toThrow(
      InvalidArgumentError
    );

    await expect(service.getAnatomyData(0)).rejects.toThrow(
      InvalidArgumentError
    );
    const blankActorId = 'blank-actor';
    const blankRootId = 'blank-root';
    entityManager.addComponent(blankActorId, 'anatomy:body', {
      body: { root: blankActorId },
      structure: {
        rootPartId: blankRootId,
        parts: {
          [blankRootId]: { children: [], partType: 'core' },
        },
      },
    });
    entityManager.addComponent(blankRootId, 'anatomy:part', {
      subType: 'core',
    });
    entityManager.addComponent(blankRootId, 'anatomy:joint', {
      parentId: blankActorId,
      socketId: 'socket-blank-root',
    });
    await service.buildAdjacencyCache(blankActorId);
    const blankAnatomy = await service.getAnatomyData(blankActorId);
    expect(blankAnatomy).toEqual({
      recipeId: null,
      rootEntityId: blankActorId,
    });
    await expect(service.detachPart(actorId)).rejects.toThrow(
      "Entity 'actor-root' has no joint component - cannot detach"
    );
  });

  it('enforces constructor dependency requirements', () => {
    const logger = new RecordingLogger();
    const dispatcher = new RecordingEventDispatcher();
    const entityManager = new InMemoryEntityManager();
    const queryCache = new AnatomyQueryCache({ logger });

    expect(
      () =>
        new BodyGraphService({
          logger,
          eventDispatcher: dispatcher,
          queryCache,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          eventDispatcher: dispatcher,
          queryCache,
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new BodyGraphService({
          entityManager,
          logger,
          queryCache,
        })
    ).toThrow(InvalidArgumentError);
  });
});
