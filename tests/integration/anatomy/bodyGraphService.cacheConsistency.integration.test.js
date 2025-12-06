import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(...args) {
    this.debugEntries.push(args);
  }

  info(...args) {
    this.infoEntries.push(args);
  }

  warn(...args) {
    this.warnEntries.push(args);
  }

  error(...args) {
    this.errorEntries.push(args);
  }
}

class RecordingEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload, options) {
    this.events.push({ eventId, payload, options });
    return true;
  }
}

class RecordingQueryCache {
  constructor() {
    this.findPartsCache = new Map();
    this.allPartsCache = new Map();
    this.invalidatedRoots = [];
  }

  cacheFindPartsByType(rootId, partType, result) {
    this.findPartsCache.set(`${rootId}:${partType}`, result);
  }

  getCachedFindPartsByType(rootId, partType) {
    return this.findPartsCache.get(`${rootId}:${partType}`);
  }

  cacheGetAllParts(rootId, result) {
    this.allPartsCache.set(rootId, result);
  }

  getCachedGetAllParts(rootId) {
    return this.allPartsCache.get(rootId);
  }

  invalidateRoot(rootId) {
    this.invalidatedRoots.push(rootId);
    for (const key of [...this.findPartsCache.keys()]) {
      if (key.startsWith(`${rootId}:`)) {
        this.findPartsCache.delete(key);
      }
    }
    this.allPartsCache.delete(rootId);
  }
}

class IntegrationEntityManager {
  constructor() {
    this.entities = new Map();
  }

  createEntity(entityId, components = {}) {
    const clone = JSON.parse(JSON.stringify(components));
    this.entities.set(entityId, clone);
  }

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, {});
    }
    this.entities.get(entityId)[componentId] = JSON.parse(
      JSON.stringify(value)
    );
  }

  getComponentData(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (!components || !(componentId in components)) {
      return null;
    }
    return components[componentId];
  }

  async removeComponent(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (components && componentId in components) {
      delete components[componentId];
    }
  }

  getEntitiesWithComponent(componentId) {
    const matches = [];
    for (const [entityId, components] of this.entities.entries()) {
      if (componentId in components) {
        matches.push({ id: entityId });
      }
    }
    return matches;
  }

  getEntityInstance(entityId) {
    const components = this.entities.get(entityId);
    if (!components) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) =>
        this.getComponentData(entityId, componentId),
    };
  }
}

const populateAnatomy = (entityManager) => {
  entityManager.createEntity('actor', {
    'core:name': { text: 'Integration Hero' },
    'anatomy:body': {
      recipeId: 'humanoid_main',
      body: { root: 'blueprint-torso' },
      structure: { rootPartId: 'torso' },
    },
  });

  entityManager.createEntity('torso', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'actor', socketId: 'core-socket' },
  });

  entityManager.createEntity('leftArm', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-left' },
    'anatomy:tag': { muscle: 'strong' },
  });

  entityManager.createEntity('leftHand', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'leftArm', socketId: 'wrist-left' },
  });

  entityManager.createEntity('rightArm', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-right' },
  });

  entityManager.createEntity('rightHand', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'rightArm', socketId: 'wrist-right' },
  });

  entityManager.createEntity('heart', {
    'anatomy:part': { subType: 'heart' },
    'anatomy:joint': { parentId: 'torso', socketId: 'chest-cavity' },
    'anatomy:sensors': { status: { active: true } },
  });

  entityManager.createEntity('floating', {
    'anatomy:part': { subType: 'spectral' },
  });

  entityManager.createEntity('blueprint-actor', {
    'anatomy:body': {
      recipeId: 'humanoid_blueprint',
      body: { root: 'blueprint-torso' },
      structure: { rootPartId: 'blueprint-torso' },
    },
  });

  entityManager.createEntity('blueprint-torso', {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'blueprint-actor', socketId: 'template-root' },
  });

  entityManager.createEntity('blueprint-arm', {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': {
      parentId: 'blueprint-torso',
      socketId: 'template-shoulder',
    },
  });

  entityManager.createEntity('blueprint-hand', {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'blueprint-arm', socketId: 'template-wrist' },
  });
};

describe('BodyGraphService integration – cache consistency and workflows', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let queryCache;
  let service;
  let bodyComponent;
  let blueprintBodyComponent;

  beforeEach(() => {
    entityManager = new IntegrationEntityManager();
    populateAnatomy(entityManager);
    logger = new RecordingLogger();
    dispatcher = new RecordingEventDispatcher();
    queryCache = new RecordingQueryCache();
    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache,
    });
    bodyComponent = entityManager.getComponentData('actor', 'anatomy:body');
    blueprintBodyComponent = entityManager.getComponentData(
      'blueprint-actor',
      'anatomy:body'
    );
  });

  it('constructs with default query cache when none is provided', () => {
    const alternateService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    expect(alternateService).toBeInstanceOf(BodyGraphService);
  });

  it('builds caches, performs queries, and reuses cached results', async () => {
    await service.buildAdjacencyCache('actor');
    await service.buildAdjacencyCache('actor');

    expect(service.hasCache('actor')).toBe(true);
    expect(service.hasCache('missing-root')).toBe(false);

    const children = service.getChildren('torso').slice().sort();
    expect(children).toEqual(['heart', 'leftArm', 'rightArm']);
    expect(service.getChildren('unknown')).toEqual([]);
    expect(service.getParent('actor')).toBeNull();
    expect(service.getParent('torso')).toBe('actor');

    expect(service.getAncestors('leftHand')).toEqual([
      'leftArm',
      'torso',
      'actor',
    ]);
    expect(service.getAllDescendants('rightArm')).toEqual(['rightHand']);

    expect(service.getPath('leftHand', 'heart')).toEqual([
      'leftHand',
      'leftArm',
      'torso',
      'heart',
    ]);
    expect(service.getPath('leftHand', 'floating')).toBeNull();

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    const actorParts = service.getAllParts(bodyComponent, 'actor');
    expect(actorParts).toEqual(
      expect.arrayContaining([
        'actor',
        'torso',
        'leftArm',
        'leftHand',
        'rightArm',
        'rightHand',
        'heart',
      ])
    );
    const cachedActorParts = service.getAllParts(bodyComponent, 'actor');
    expect(cachedActorParts).toBe(actorParts);

    const structureParts = service.getAllParts({ root: 'torso' });
    expect(structureParts).toEqual(
      expect.arrayContaining(['torso', 'leftArm', 'rightArm', 'heart'])
    );

    const blueprintParts = service.getAllParts(
      blueprintBodyComponent,
      'nobody'
    );
    expect(blueprintParts).toEqual(
      expect.arrayContaining([
        'blueprint-torso',
        'blueprint-arm',
        'blueprint-hand',
      ])
    );

    const armParts = service.findPartsByType('actor', 'arm').sort();
    expect(armParts).toEqual(['leftArm', 'rightArm']);

    entityManager.setComponent('rightArm', 'anatomy:part', {
      subType: 'wing',
    });
    const cachedArmParts = service.findPartsByType('actor', 'arm');
    expect(cachedArmParts).toEqual(armParts);

    expect(queryCache.getCachedFindPartsByType('actor', 'arm')).toEqual(
      armParts
    );
    expect(queryCache.getCachedGetAllParts('actor')).toEqual(actorParts);

    expect(service.hasPartWithComponent({ root: 'torso' }, 'anatomy:tag')).toBe(
      true
    );
    entityManager.setComponent('leftArm', 'anatomy:tag', {});
    expect(service.hasPartWithComponent({ root: 'torso' }, 'anatomy:tag')).toBe(
      false
    );

    expect(
      service.hasPartWithComponentValue(
        { root: 'torso' },
        'anatomy:sensors',
        'status.active',
        true
      )
    ).toEqual({ found: true, partId: 'heart' });
    expect(
      service.hasPartWithComponentValue(
        { root: 'torso' },
        'anatomy:sensors',
        'status.inactive',
        true
      )
    ).toEqual({ found: false });

    const rootFromHand = service.getAnatomyRoot('leftHand');
    expect(rootFromHand).toBe('actor');
    const rootFromFloating = service.getAnatomyRoot('floating');
    expect(rootFromFloating).toBe('floating');

    const bodyGraph = await service.getBodyGraph('actor');
    expect(bodyGraph.getAllPartIds()).toEqual(
      expect.arrayContaining(actorParts)
    );
    expect(bodyGraph.getConnectedParts('torso').sort()).toEqual([
      'heart',
      'leftArm',
      'rightArm',
    ]);
    expect(bodyGraph.getConnectedParts('unknown')).toEqual([]);

    await expect(service.getBodyGraph(42)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph('floating')).rejects.toThrow(
      'Entity floating has no anatomy:body component'
    );

    await expect(service.getAnatomyData(123)).rejects.toThrow(
      InvalidArgumentError
    );
    expect(await service.getAnatomyData('floating')).toBeNull();
    expect(await service.getAnatomyData('actor')).toEqual({
      recipeId: 'humanoid_main',
      rootEntityId: 'actor',
    });

    const validationResult = service.validateCache();
    expect(validationResult.valid).toBe(true);

    await service.buildAdjacencyCache('blueprint-actor');
    expect(service.hasCache('blueprint-actor')).toBe(true);
  });

  it('handles detachments, cache invalidation, and validation issues', async () => {
    await service.buildAdjacencyCache('actor');
    const armParts = service.findPartsByType('actor', 'arm');
    expect(armParts).toHaveLength(2);

    const detachCascade = await service.detachPart('leftArm', {
      reason: 'injury',
    });
    expect(detachCascade).toEqual({
      detached: ['leftArm', 'leftHand'],
      parentId: 'torso',
      socketId: 'shoulder-left',
    });
    expect(queryCache.invalidatedRoots).toContain('actor');
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0].eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(service.hasCache('actor')).toBe(false);
    expect(
      entityManager.getComponentData('leftArm', 'anatomy:joint')
    ).toBeNull();

    entityManager.setComponent('leftArm', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'shoulder-left',
    });
    entityManager.setComponent('leftHand', 'anatomy:joint', {
      parentId: 'leftArm',
      socketId: 'wrist-left',
    });
    await service.buildAdjacencyCache('actor');

    const detachSingle = await service.detachPart('heart', {
      cascade: false,
      reason: 'surgery',
    });
    expect(detachSingle).toEqual({
      detached: ['heart'],
      parentId: 'torso',
      socketId: 'chest-cavity',
    });

    await expect(service.detachPart('floating')).rejects.toThrow(
      InvalidArgumentError
    );

    entityManager.setComponent('heart', 'anatomy:joint', {
      parentId: 'torso',
      socketId: 'chest-cavity',
    });
    await service.buildAdjacencyCache('actor');

    await service.buildAdjacencyCache('actor');
    await entityManager.removeComponent('rightArm', 'anatomy:joint');
    const validationAfterBreak = service.validateCache();
    expect(validationAfterBreak.valid).toBe(false);
    expect(
      validationAfterBreak.issues.some((issue) =>
        issue.includes("Entity 'rightArm' in cache has parent but no joint")
      )
    ).toBe(true);
  });
});
