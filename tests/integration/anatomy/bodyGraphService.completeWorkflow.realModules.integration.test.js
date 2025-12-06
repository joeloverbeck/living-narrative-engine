import { describe, it, expect, beforeEach } from '@jest/globals';

import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

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

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
    this.entities.get(entityId).set(componentId, value);
  }

  getComponentData(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (!components) {
      return null;
    }
    const value = components.get(componentId);
    return value === undefined ? null : value;
  }

  async removeComponent(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (components) {
      components.delete(componentId);
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
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
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

const buildActorBody = () => ({
  recipeId: 'humanoid.test',
  body: {
    root: 'actor',
  },
  structure: {
    rootPartId: 'torso',
    parts: {
      torso: {
        children: [
          'leftArm',
          'rightArm',
          'head',
          'cyberArm',
          'floatingWing',
          'droneDock',
        ],
        partType: 'torso',
      },
      leftArm: {
        children: ['leftHand'],
        partType: 'arm',
      },
      leftHand: {
        children: [],
        partType: 'hand',
      },
      rightArm: {
        children: ['rightHand'],
        partType: 'arm',
      },
      rightHand: {
        children: [],
        partType: 'hand',
      },
      head: {
        children: [],
        partType: 'head',
      },
      cyberArm: {
        children: [],
        partType: 'arm',
      },
      floatingWing: {
        children: [],
        partType: 'wing',
      },
      droneDock: {
        children: [],
        partType: 'dock',
      },
    },
  },
});

const buildSpectatorBody = () => ({
  recipeId: 'spectator.test',
  body: {
    root: 'spectator',
  },
  structure: {
    rootPartId: 'spectatorTorso',
    parts: {
      spectatorTorso: {
        children: ['spectatorHead'],
        partType: 'torso',
      },
      spectatorHead: {
        children: [],
        partType: 'head',
      },
    },
  },
});

const expectSameMembers = (actual, expected) => {
  expect([...actual].sort()).toEqual([...expected].sort());
  expect(actual).toHaveLength(expected.length);
};

describe('BodyGraphService complete workflow with real cache + query modules', () => {
  let entityManager;
  let service;
  let logger;
  let dispatcher;
  let queryCache;
  let actorBody;
  let spectatorBody;

  beforeEach(async () => {
    logger = createLogger();
    dispatcher = new RecordingEventDispatcher();
    queryCache = new AnatomyQueryCache({ logger });

    actorBody = buildActorBody();
    spectatorBody = buildSpectatorBody();

    entityManager = new InMemoryEntityManager({
      actor: {
        'anatomy:body': actorBody,
      },
      torso: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:joint': { parentId: 'actor', socketId: 'spine' },
      },
      leftArm: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-left' },
      },
      leftHand: {
        'anatomy:part': { subType: 'hand' },
        'anatomy:joint': { parentId: 'leftArm', socketId: 'wrist-left' },
        'sensors:touch': { level: 'sensitive' },
      },
      rightArm: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: 'torso', socketId: 'shoulder-right' },
      },
      rightHand: {
        'anatomy:part': { subType: 'hand' },
        'anatomy:joint': { parentId: 'rightArm', socketId: 'wrist-right' },
      },
      head: {
        'anatomy:part': { subType: 'head' },
        'anatomy:joint': { parentId: 'torso', socketId: 'neck' },
      },
      cyberArm: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': {
          parentEntityId: 'torso',
          parentId: 'torso',
          socketId: 'torso-augmentation',
          childSocketId: 'augmentation-child',
        },
        'custom:decor': {
          details: {
            finish: 'polished',
          },
        },
      },
      floatingWing: {
        'anatomy:part': { subType: 'wing' },
        'anatomy:joint': { parentId: 'torso', socketId: 'wing-socket' },
      },
      droneDock: {
        'anatomy:part': { subType: 'dock' },
        'anatomy:joint': { parentId: 'torso', childSocketId: 'drone-slot' },
      },
      spectator: {
        'anatomy:body': spectatorBody,
      },
      spectatorTorso: {
        'anatomy:part': { subType: 'torso' },
        // No joint to spectator to trigger disconnected actor handling
      },
      spectatorHead: {
        'anatomy:part': { subType: 'head' },
        'anatomy:joint': {
          parentId: 'spectatorTorso',
          socketId: 'spectator-neck',
        },
      },
    });

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
      queryCache,
    });

    await service.buildAdjacencyCache('actor');
    await service.buildAdjacencyCache('spectator');
  });

  it('builds caches, resolves queries, and reuses cached results across blueprint and actor roots', async () => {
    expect(service.hasCache('actor')).toBe(true);
    expect(service.hasCache('spectator')).toBe(true);

    const actorPartsFirst = service.getAllParts(actorBody, 'actor');
    expectSameMembers(actorPartsFirst, [
      'actor',
      'torso',
      'leftArm',
      'leftHand',
      'rightArm',
      'rightHand',
      'head',
      'cyberArm',
      'floatingWing',
      'droneDock',
    ]);

    const actorPartsSecond = service.getAllParts(actorBody, 'actor');
    expect(actorPartsSecond).toBe(actorPartsFirst);

    const blueprintStructure = { root: 'torso' };
    const blueprintParts = service.getAllParts(blueprintStructure);
    expectSameMembers(blueprintParts, [
      'torso',
      'leftArm',
      'leftHand',
      'rightArm',
      'rightHand',
      'head',
      'cyberArm',
      'floatingWing',
      'droneDock',
    ]);

    const ghostPerspective = service.getAllParts(actorBody, 'ghost-actor');
    expectSameMembers(ghostPerspective, [
      'actor',
      'torso',
      'leftArm',
      'leftHand',
      'rightArm',
      'rightHand',
      'head',
      'cyberArm',
      'floatingWing',
      'droneDock',
    ]);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);

    const spectatorParts = service.getAllParts(spectatorBody, 'spectator');
    expectSameMembers(spectatorParts, [
      'spectator',
      'spectatorTorso',
      'spectatorHead',
    ]);

    const firstArms = service.findPartsByType('actor', 'arm');
    expectSameMembers(firstArms, ['leftArm', 'rightArm', 'cyberArm']);
    const secondArms = service.findPartsByType('actor', 'arm');
    expect(secondArms).toBe(firstArms);

    const path = service.getPath('leftHand', 'cyberArm');
    expect(path).toEqual(['leftHand', 'leftArm', 'torso', 'cyberArm']);
    expect(service.getPath('leftHand', 'missing')).toBeNull();

    expect(service.getAnatomyRoot('leftHand')).toBe('actor');
    expect(service.getAnatomyRoot('spectatorHead')).toBe('spectator');
    expect(service.getAnatomyRoot('unknown')).toBe('unknown');

    expect(service.getChildren('torso')).toEqual(
      expect.arrayContaining([
        'leftArm',
        'rightArm',
        'head',
        'cyberArm',
        'floatingWing',
        'droneDock',
      ])
    );
    expect(service.getParent('leftHand')).toBe('leftArm');
    expect(service.getAncestors('leftHand')).toEqual([
      'leftArm',
      'torso',
      'actor',
    ]);
    expect(service.getAllDescendants('torso')).toEqual(
      expect.arrayContaining([
        'leftArm',
        'leftHand',
        'rightArm',
        'rightHand',
        'head',
        'cyberArm',
        'floatingWing',
        'droneDock',
      ])
    );

    expect(
      service.hasPartWithComponentValue(
        actorBody,
        'custom:decor',
        'details.finish',
        'polished'
      )
    ).toEqual({ found: true, partId: 'cyberArm' });

    expect(
      service.hasPartWithComponentValue(
        actorBody,
        'custom:decor',
        'details.finish',
        'matte'
      )
    ).toEqual({ found: false });

    expect(service.hasPartWithComponent(actorBody, 'sensors:touch')).toBe(true);
    expect(service.hasPartWithComponent(actorBody, 'inventory:slot')).toBe(
      false
    );

    const graph = await service.getBodyGraph('actor');
    expectSameMembers(graph.getAllPartIds(), actorPartsFirst);
    expect(graph.getConnectedParts('actor')).toEqual(['torso']);
    expect(graph.getConnectedParts('torso')).toEqual(
      expect.arrayContaining([
        'leftArm',
        'rightArm',
        'head',
        'cyberArm',
        'floatingWing',
        'droneDock',
      ])
    );

    const validation = service.validateCache();
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual([
      "Entity 'spectatorTorso' in cache has parent but no joint component",
    ]);
  });

  it('reuses existing caches, supports detachment flows, and invalidates query results', async () => {
    const buildMessagesBefore = logger.messages.debug.filter((message) =>
      message.includes("Building cache for anatomy rooted at 'actor'")
    ).length;

    await service.buildAdjacencyCache('actor');

    const buildMessagesAfter = logger.messages.debug.filter((message) =>
      message.includes("Building cache for anatomy rooted at 'actor'")
    ).length;
    expect(buildMessagesAfter).toBe(buildMessagesBefore);

    const detachSingle = await service.detachPart('cyberArm', {
      cascade: false,
      reason: 'upgrade',
    });
    expect(detachSingle).toEqual({
      detached: ['cyberArm'],
      parentId: 'torso',
      socketId: 'torso-augmentation',
    });

    expect(dispatcher.events.at(-1)).toEqual(
      expect.objectContaining({
        eventId: LIMB_DETACHED_EVENT_ID,
        payload: expect.objectContaining({
          detachedEntityId: 'cyberArm',
          detachedCount: 1,
          reason: 'upgrade',
        }),
      })
    );

    expect(service.hasCache('actor')).toBe(false);
    expect(queryCache.getCachedGetAllParts('actor')).toBeUndefined();

    entityManager.setComponent('cyberArm', 'anatomy:joint', {
      parentEntityId: 'torso',
      parentId: 'torso',
      socketId: 'torso-augmentation',
      childSocketId: 'augmentation-child',
    });

    await service.buildAdjacencyCache('actor');

    const detachCascade = await service.detachPart('leftArm');
    expect(detachCascade.detached).toEqual(['leftArm', 'leftHand']);
    expect(detachCascade.parentId).toBe('torso');
    expect(detachCascade.socketId).toBe('shoulder-left');

    expect(service.hasCache('actor')).toBe(false);
    expect(
      dispatcher.events.filter(
        (event) => event.eventId === LIMB_DETACHED_EVENT_ID
      )
    ).toHaveLength(2);

    expect(
      logger.messages.info.some((message) =>
        message.includes('AnatomyQueryCache: Invalidated')
      )
    ).toBe(true);
  });

  it('enforces validation rules and surfaces anatomy metadata', async () => {
    const defaultCacheService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });
    await defaultCacheService.buildAdjacencyCache('actor');

    await expect(service.getBodyGraph(123)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(service.getBodyGraph('ghost')).rejects.toThrow(
      'has no anatomy:body component'
    );

    await expect(service.getAnatomyData(0)).rejects.toThrow(
      'Entity ID is required and must be a string'
    );
    await expect(service.getAnatomyData('ghost')).resolves.toBeNull();
    await expect(service.getAnatomyData('actor')).resolves.toEqual({
      recipeId: 'humanoid.test',
      rootEntityId: 'actor',
    });

    await expect(service.detachPart('spectatorTorso')).rejects.toThrow(
      "Entity 'spectatorTorso' has no joint component - cannot detach"
    );

    const arms = defaultCacheService.findPartsByType('actor', 'arm');
    expectSameMembers(arms, ['leftArm', 'rightArm', 'cyberArm']);
  });
});
