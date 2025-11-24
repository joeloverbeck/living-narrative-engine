import { beforeEach, describe, expect, it } from '@jest/globals';

import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
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
    Object.entries(initialEntities).forEach(([entityId, components]) => {
      const componentMap = new Map();
      Object.entries(components).forEach(([componentId, value]) => {
        componentMap.set(componentId, value);
      });
      this.entities.set(entityId, componentMap);
    });
  }

  entities;

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

  removeEntity(entityId) {
    this.entities.delete(entityId);
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

const createBodyComponent = () => ({
  recipeId: 'humanoid.basic',
  body: { root: 'actor' },
  root: 'torso',
  structure: {
    rootPartId: 'torso',
    parts: {
      torso: { children: ['leftArm', 'rightArm', 'head', 'heart'], partType: 'torso' },
      leftArm: { children: ['leftHand'], partType: 'arm' },
      rightArm: { children: [], partType: 'arm' },
      leftHand: { children: [], partType: 'hand' },
      head: { children: [], partType: 'head' },
      heart: { children: [], partType: 'organ' },
    },
  },
});

describe('BodyGraphService integration – realistic coverage', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let service;
  let bodyComponent;
  const actorId = 'actor';

  const setupService = async () => {
    logger = createLogger();
    dispatcher = new RecordingDispatcher();
    bodyComponent = createBodyComponent();

    entityManager = new InMemoryEntityManager({
      actor: {
        'anatomy:body': bodyComponent,
      },
      torso: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:joint': { parentId: 'actor', socketId: 'spine' },
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

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    await service.buildAdjacencyCache(actorId);
  };

  beforeEach(async () => {
    await setupService();
  });

  it('validates required constructor dependencies', () => {
    expect(() => new BodyGraphService({ logger, eventDispatcher: dispatcher })).toThrow(
      'entityManager is required',
    );
    expect(() => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })).toThrow(
      'logger is required',
    );
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      'eventDispatcher is required',
    );
  });

  it('builds adjacency caches and provides cached queries', async () => {
    await service.buildAdjacencyCache(actorId);

    expect(service.hasCache(actorId)).toBe(true);

    const blueprintParts = service.getAllParts({ root: 'torso' });
    expect([...blueprintParts].sort()).toEqual(
      ['torso', 'leftArm', 'leftHand', 'rightArm', 'head', 'heart'].sort(),
    );

    const actorParts = service.getAllParts(bodyComponent, actorId);
    expect([...actorParts].sort()).toEqual(
      ['actor', 'torso', 'leftArm', 'leftHand', 'rightArm', 'head', 'heart'].sort(),
    );

    const repeatCall = service.getAllParts(bodyComponent, actorId);
    expect([...repeatCall].sort()).toEqual([...actorParts].sort());
    expect(
      logger.messages.info.some((message) =>
        message.includes('BodyGraphService.getAllParts: CACHE HIT for cache root'),
      ),
    ).toBe(true);

    const arms = service.findPartsByType(actorId, 'arm');
    expect(arms.sort()).toEqual(['leftArm', 'rightArm'].sort());

    const cachedArms = service.findPartsByType(actorId, 'arm');
    expect(cachedArms.sort()).toEqual(['leftArm', 'rightArm'].sort());
    expect(
      logger.messages.debug.some((message) =>
        message.includes("AnatomyQueryCache: Cache hit for key 'findPartsByType"),
      ),
    ).toBe(true);

    expect(service.getChildren('torso').sort()).toEqual(
      ['leftArm', 'rightArm', 'head', 'heart'].sort(),
    );
    expect(service.getChildren('missing')).toEqual([]);
    expect(service.getParent('leftHand')).toBe('leftArm');
    expect(service.getParent('actor')).toBeNull();
    expect(service.getAncestors('leftHand')).toEqual(['leftArm', 'torso', 'actor']);
    expect(service.getAncestors('actor')).toEqual([]);
    expect(service.getAllDescendants('torso').sort()).toEqual(
      ['leftArm', 'leftHand', 'rightArm', 'head', 'heart'].sort(),
    );
    expect(service.getAllDescendants('head')).toEqual([]);

    expect(service.getAnatomyRoot('leftHand')).toBe(actorId);
    expect(service.getAnatomyRoot('missing')).toBe('missing');

    const path = service.getPath('leftHand', 'heart');
    expect(path).toEqual(['leftHand', 'leftArm', 'torso', 'heart']);

    const sensorsResult = service.hasPartWithComponent(bodyComponent, 'sensors:touch');
    expect(sensorsResult).toBe(true);
    expect(service.hasPartWithComponent(bodyComponent, 'inventory:slot')).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:decor',
        'details.color',
        'blue',
      ),
    ).toEqual({ found: true, partId: 'leftArm' });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:decor',
        'details.color',
        'green',
      ),
    ).toEqual({ found: false });

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);

    const validation = service.validateCache();
    expect(validation).toEqual({ valid: true, issues: [] });
  });

  it('detaches limbs, invalidates caches, and dispatches events', async () => {
    const warmup = service.getAllParts(bodyComponent, actorId);
    expect(warmup).toContain('leftArm');

    const cascadeResult = await service.detachPart('leftArm');
    expect(cascadeResult).toEqual({
      detached: ['leftArm', 'leftHand'],
      parentId: 'torso',
      socketId: 'shoulder-left',
    });

    expect(service.hasCache(actorId)).toBe(false);
    expect(
      dispatcher.events.some((event) =>
        event.eventId === LIMB_DETACHED_EVENT_ID && event.payload.detachedCount === 2,
      ),
    ).toBe(true);

    const nonCascade = await service.detachPart('rightArm', {
      cascade: false,
      reason: 'surgical',
    });
    expect(nonCascade.detached).toEqual(['rightArm']);
    expect(dispatcher.events.at(-1).payload.reason).toBe('surgical');

    await expect(service.detachPart('ornament')).rejects.toThrow(
      "Entity 'ornament' has no joint component - cannot detach",
    );
  });

  it('provides body graph helpers and anatomy metadata', async () => {
    const graph = await service.getBodyGraph(actorId);
    expect(graph.getAllPartIds().sort()).toEqual(
      ['actor', 'torso', 'leftArm', 'leftHand', 'rightArm', 'head', 'heart'].sort(),
    );
    expect(graph.getConnectedParts('actor')).toEqual(['torso']);
    expect(graph.getConnectedParts('torso').sort()).toEqual(
      ['leftArm', 'rightArm', 'head', 'heart'].sort(),
    );

    await expect(service.getBodyGraph(null)).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getBodyGraph(42)).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getBodyGraph('spectator')).rejects.toThrow(
      'has no anatomy:body component',
    );

    await expect(service.getAnatomyData(actorId)).resolves.toEqual({
      recipeId: 'humanoid.basic',
      rootEntityId: actorId,
    });
    await expect(service.getAnatomyData('spectator')).resolves.toBeNull();
    await expect(service.getAnatomyData(0)).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('detects cache integrity problems', () => {
    let result = service.validateCache();
    expect(result.valid).toBe(true);

    entityManager.setComponent('leftHand', 'anatomy:joint', {
      parentId: 'actor',
      socketId: 'wrist-left',
    });
    result = service.validateCache();
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes('Parent mismatch'))).toBe(true);

    entityManager.removeEntity('leftArm');
    result = service.validateCache();
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) => issue.includes("Cached entity 'leftArm' no longer exists")),
    ).toBe(true);
  });
});
