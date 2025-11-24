import { describe, it, expect, beforeEach } from '@jest/globals';

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

  getComponentData(entityId, componentId) {
    if (!this.entities.has(entityId)) {
      return null;
    }
    const value = this.entities.get(entityId).get(componentId);
    return value === undefined ? null : value;
  }

  async removeComponent(entityId, componentId) {
    if (this.entities.has(entityId)) {
      this.entities.get(entityId).delete(componentId);
    }
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
      return null;
    }
    return new InMemoryEntityInstance(this, entityId);
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
  body: {
    root: 'actor',
  },
  structure: {
    rootPartId: 'torso',
    parts: {
      torso: {
        children: ['leftArm', 'rightArm', 'head'],
        partType: 'torso',
      },
      leftArm: {
        children: ['leftHand'],
        partType: 'arm',
      },
      rightArm: {
        children: [],
        partType: 'arm',
      },
      leftHand: {
        children: [],
        partType: 'hand',
      },
      head: {
        children: [],
        partType: 'head',
      },
    },
  },
});

describe('BodyGraphService integration with real cache + query modules', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let service;
  let bodyComponent;

  const expectArrayToContainSameMembers = (actual, expected) => {
    expect([...actual].sort()).toEqual([...expected].sort());
  };

  beforeEach(async () => {
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
        'custom:decor': {
          details: {
            marking: 'tattoo',
            color: 'blue',
          },
        },
      },
      rightArm: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-right' },
      },
      leftHand: {
        'anatomy:part': { subType: 'hand' },
        'anatomy:joint': { parentId: 'leftArm', socketId: 'wrist-left' },
        'sensors:touch': { level: 'sensitive' },
      },
      head: {
        'anatomy:part': { subType: 'head' },
        'anatomy:joint': { parentId: 'torso', socketId: 'neck' },
      },
    });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    await service.buildAdjacencyCache('actor');
  });

  it('builds adjacency cache and exposes resolved relationships', () => {
    expect(service.hasCache('actor')).toBe(true);

    const allFromBlueprintRoot = service.getAllParts({ root: 'torso' });
    expectArrayToContainSameMembers(allFromBlueprintRoot, [
      'torso',
      'leftArm',
      'leftHand',
      'rightArm',
      'head',
    ]);

    const allFromActor = service.getAllParts(bodyComponent, 'actor');
    expectArrayToContainSameMembers(allFromActor, [
      'actor',
      'torso',
      'leftArm',
      'leftHand',
      'rightArm',
      'head',
    ]);

    const secondCall = service.getAllParts(bodyComponent, 'actor');
    expectArrayToContainSameMembers(secondCall, allFromActor);
    expect(
      logger.messages.info.some((message) =>
        message.includes('CACHE HIT for cache root')
      )
    ).toBe(true);

    expect(service.getChildren('torso')).toEqual([
      'leftArm',
      'rightArm',
      'head',
    ]);
    expect(service.getParent('leftHand')).toBe('leftArm');
    expect(service.getAncestors('leftHand')).toEqual([
      'leftArm',
      'torso',
      'actor',
    ]);
    expectArrayToContainSameMembers(service.getAllDescendants('torso'), [
      'leftArm',
      'leftHand',
      'rightArm',
      'head',
    ]);
  });

  it('finds parts by type and reuses query cache', () => {
    const firstLookup = service.findPartsByType('actor', 'arm');
    expectArrayToContainSameMembers(firstLookup, ['leftArm', 'rightArm']);

    const secondLookup = service.findPartsByType('actor', 'arm');
    expectArrayToContainSameMembers(secondLookup, ['leftArm', 'rightArm']);

    expect(
      logger.messages.debug.some((message) =>
        message.includes('AnatomyQueryCache: Cache hit for key')
      )
    ).toBe(true);
  });

  it('computes paths and identifies common roots', () => {
    expect(service.getAnatomyRoot('leftHand')).toBe('actor');
    expect(service.getAnatomyRoot('head')).toBe('actor');

    const path = service.getPath('leftHand', 'rightArm');
    expect(path).toEqual(['leftHand', 'leftArm', 'torso', 'rightArm']);
  });

  it('detects component presence and nested property values', () => {
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:decor',
        'details.color',
        'blue'
      )
    ).toEqual({ found: true, partId: 'leftArm' });

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:decor',
        'details.color',
        'green'
      )
    ).toEqual({ found: false });

    expect(
      service.hasPartWithComponent(bodyComponent, 'sensors:touch')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'inventory:slot')
    ).toBe(false);
  });

  it('detaches cascading parts and invalidates caches', async () => {
    const result = await service.detachPart('leftArm');

    expect(result).toEqual({
      detached: ['leftArm', 'leftHand'],
      parentId: 'torso',
      socketId: 'shoulder-left',
    });

    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0]).toEqual(
      expect.objectContaining({
        eventId: LIMB_DETACHED_EVENT_ID,
        payload: expect.objectContaining({
          detachedEntityId: 'leftArm',
          detachedCount: 2,
          reason: 'manual',
        }),
      })
    );

    expect(service.hasCache('actor')).toBe(false);
    expect(
      logger.messages.info.some((message) =>
        message.includes('AnatomyQueryCache: Invalidated')
      )
    ).toBe(true);
  });

  it('supports non-cascading detachment with custom reason', async () => {
    const outcome = await service.detachPart('rightArm', {
      cascade: false,
      reason: 'surgical',
    });

    expect(outcome.detached).toEqual(['rightArm']);
    expect(dispatcher.events.at(-1).payload).toEqual(
      expect.objectContaining({ reason: 'surgical', detachedCount: 1 })
    );
  });

  it('throws informative error when joint component is missing', async () => {
    await expect(service.detachPart('headless')).rejects.toThrow(
      "Entity 'headless' has no joint component - cannot detach"
    );
  });

  it('provides body graph helpers and anatomy metadata', async () => {
    const graph = await service.getBodyGraph('actor');
    expectArrayToContainSameMembers(graph.getAllPartIds(), [
      'actor',
      'torso',
      'leftArm',
      'leftHand',
      'rightArm',
      'head',
    ]);
    expect(graph.getConnectedParts('actor')).toEqual(['torso']);
    expect(graph.getConnectedParts('torso')).toEqual([
      'leftArm',
      'rightArm',
      'head',
    ]);

    await expect(service.getBodyGraph(123)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph('ghost')).rejects.toThrow(
      'has no anatomy:body component'
    );

    await expect(service.getAnatomyData(0)).rejects.toBeInstanceOf(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData('ghost')).resolves.toBeNull();
    await expect(service.getAnatomyData('actor')).resolves.toEqual({
      recipeId: 'humanoid.basic',
      rootEntityId: 'actor',
    });
  });

  it('handles degenerate inputs gracefully when enumerating parts', () => {
    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);
  });
});
