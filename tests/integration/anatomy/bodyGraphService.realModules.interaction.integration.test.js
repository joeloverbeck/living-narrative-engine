import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

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
    this.componentIndex = new Map();

    Object.entries(initialEntities).forEach(([entityId, components]) => {
      const componentMap = new Map();
      Object.entries(components).forEach(([componentId, value]) => {
        componentMap.set(componentId, this.#clone(value));
        if (!this.componentIndex.has(componentId)) {
          this.componentIndex.set(componentId, new Map());
        }
        this.componentIndex.get(componentId).set(entityId, { id: entityId });
      });
      this.entities.set(entityId, componentMap);
    });
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

  setComponent(entityId, componentId, value) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
    this.entities.get(entityId).set(componentId, this.#clone(value));

    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  getComponentData(entityId, componentId) {
    const components = this.entities.get(entityId);
    if (!components) {
      return null;
    }
    const data = components.get(componentId);
    return data !== undefined ? this.#clone(data) : null;
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
    const components = this.entities.get(entityId);
    if (!components) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return {
      id: entityId,
      getComponentData: (componentId) => this.getComponentData(entityId, componentId),
    };
  }
}

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const buildEntityBlueprint = () => ({
  actor: {
    'anatomy:body': {
      recipeId: 'humanoid.test',
      body: { root: 'actor' },
      structure: {
        rootPartId: 'torso',
        parts: {
          torso: {
            partType: 'torso',
            children: [
              'leftArm',
              'rightArm',
              'head',
              'cyberArm',
              'floatingWing',
              'droneDock',
            ],
          },
          leftArm: { partType: 'arm', children: ['leftHand'] },
          leftHand: { partType: 'hand', children: [] },
          rightArm: { partType: 'arm', children: ['rightHand'] },
          rightHand: { partType: 'hand', children: [] },
          head: { partType: 'head', children: [] },
          cyberArm: { partType: 'arm', children: [] },
          floatingWing: { partType: 'wing', children: [] },
          droneDock: { partType: 'dock', children: [] },
        },
      },
    },
  },
  torso: {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: 'actor', socketId: 'core' },
  },
  leftArm: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'left_shoulder' },
    'appearance:color': { primary: 'blue' },
  },
  leftHand: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'leftArm', socketId: 'left_wrist' },
    'sensation:touch': { strength: 'high' },
  },
  rightArm: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'right_shoulder' },
    'cybernetic:status': { systems: { power: 'online' } },
  },
  rightHand: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: 'rightArm', socketId: 'right_wrist' },
  },
  head: {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: 'torso', socketId: 'neck' },
  },
  cyberArm: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: 'torso', socketId: 'cybernetic_mount' },
  },
  floatingWing: {
    'anatomy:part': { subType: 'wing' },
    'anatomy:joint': { parentId: 'torso', socketId: 'wing_mount' },
  },
  droneDock: {
    'anatomy:part': { subType: 'dock' },
    'anatomy:joint': { parentId: 'torso', socketId: 'utility_mount' },
    'inventory:slots': { capacity: 2 },
  },
});

const createTestContext = () => {
  const entityManager = new InMemoryEntityManager(buildEntityBlueprint());
  const dispatcher = new RecordingEventDispatcher();
  const logger = createLogger();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: dispatcher,
  });

  return { entityManager, dispatcher, logger, service };
};

const expectSameMembers = (actual, expected) => {
  expect(new Set(actual)).toEqual(new Set(expected));
  expect(actual).toHaveLength(expected.length);
};

describe('BodyGraphService real module interactions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  let context;
  let service;
  let entityManager;
  let dispatcher;
  let bodyComponent;

  beforeEach(() => {
    context = createTestContext();
    service = context.service;
    entityManager = context.entityManager;
    dispatcher = context.dispatcher;
    bodyComponent = entityManager.getComponentData('actor', 'anatomy:body');
  });

  it('builds caches, reuses query results, and supports cascade detach workflows', async () => {
    const buildSpy = jest.spyOn(AnatomyCacheManager.prototype, 'buildCache');

    await service.buildAdjacencyCache('actor');
    await service.buildAdjacencyCache('actor');
    expect(buildSpy).toHaveBeenCalledTimes(1);

    const findSpy = jest.spyOn(AnatomyGraphAlgorithms, 'findPartsByType');
    const allPartsSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getAllParts');

    const armsFirst = service.findPartsByType('actor', 'arm');
    expectSameMembers(armsFirst, ['leftArm', 'rightArm', 'cyberArm']);

    const armsSecond = service.findPartsByType('actor', 'arm');
    expectSameMembers(armsSecond, armsFirst);
    expect(findSpy).toHaveBeenCalledTimes(1);

    const allPartsFirst = service.getAllParts(bodyComponent, 'actor');
    expectSameMembers(allPartsFirst, [
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

    const allPartsSecond = service.getAllParts(bodyComponent, 'actor');
    expectSameMembers(allPartsSecond, allPartsFirst);
    expect(allPartsSpy).toHaveBeenCalledTimes(1);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    expect(service.getAnatomyRoot('leftHand')).toBe('actor');
    expect(service.getPath('leftHand', 'head')).toEqual([
      'leftHand',
      'leftArm',
      'torso',
      'head',
    ]);

    expect(service.getParent('leftHand')).toBe('leftArm');
    expect(service.getChildren('torso').sort()).toEqual(
      ['leftArm', 'rightArm', 'head', 'cyberArm', 'floatingWing', 'droneDock'].sort()
    );
    expect(service.getAncestors('leftHand')).toEqual(['leftArm', 'torso', 'actor']);
    expect(service.getAllDescendants('leftHand')).toEqual([]);
    expect(service.getAllDescendants('torso').sort()).toEqual(
      [
        'leftArm',
        'leftHand',
        'rightArm',
        'rightHand',
        'head',
        'cyberArm',
        'floatingWing',
        'droneDock',
      ].sort()
    );

    expect(service.hasPartWithComponent(bodyComponent, 'appearance:color')).toBe(true);
    expect(service.hasPartWithComponent(bodyComponent, 'unknown:component')).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'cybernetic:status',
        'systems.power',
        'online'
      )
    ).toEqual({ found: true, partId: 'rightArm' });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'cybernetic:status',
        'systems.power',
        'offline'
      )
    ).toEqual({ found: false });

    await expect(service.getBodyGraph(123)).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.getBodyGraph('torso')).rejects.toThrow(
      'has no anatomy:body component'
    );

    const graph = await service.getBodyGraph('actor');
    expectSameMembers(graph.getAllPartIds(), allPartsFirst);
    expect(graph.getConnectedParts('torso').sort()).toEqual(
      service.getChildren('torso').sort()
    );

    expect(service.validateCache()).toEqual({ valid: true, issues: [] });
    expect(service.hasCache('actor')).toBe(true);

    const cachedPartsBeforeDetach = service.getAllParts(bodyComponent, 'actor');
    expectSameMembers(cachedPartsBeforeDetach, allPartsFirst);

    const subgraphSpy = jest.spyOn(AnatomyGraphAlgorithms, 'getSubgraph');
    const detachResult = await service.detachPart('leftArm', { reason: 'injury' });
    expect(subgraphSpy).toHaveBeenCalledWith('leftArm', expect.anything());
    expect(detachResult.parentId).toBe('torso');
    expect(detachResult.socketId).toBe('left_shoulder');
    expectSameMembers(detachResult.detached, ['leftArm', 'leftHand']);
    expect(service.hasCache('actor')).toBe(false);
    expect(dispatcher.events).toHaveLength(1);

    const dispatchedEvent = dispatcher.events[0];
    expect(dispatchedEvent.eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(dispatchedEvent.payload.detachedEntityId).toBe('leftArm');
    expect(dispatchedEvent.payload.parentEntityId).toBe('torso');
    expect(dispatchedEvent.payload.detachedCount).toBe(2);
    expect(dispatchedEvent.payload.reason).toBe('injury');

    await service.buildAdjacencyCache('actor');
    expect(service.hasCache('actor')).toBe(true);

    const armsAfterDetach = service.findPartsByType('actor', 'arm');
    expectSameMembers(armsAfterDetach, ['rightArm', 'cyberArm']);
    expect(findSpy).toHaveBeenCalledTimes(2);

    const partsAfterDetach = service.getAllParts(bodyComponent, 'actor');
    expectSameMembers(partsAfterDetach, [
      'actor',
      'torso',
      'rightArm',
      'rightHand',
      'head',
      'cyberArm',
      'floatingWing',
      'droneDock',
    ]);
    expect(allPartsSpy).toHaveBeenCalledTimes(2);

    expect(service.validateCache()).toEqual({ valid: true, issues: [] });

    await expect(service.detachPart('actor')).rejects.toBeInstanceOf(InvalidArgumentError);
    await expect(service.detachPart('missing')).rejects.toBeInstanceOf(InvalidArgumentError);
  });

  it('supports non-cascade detachment and anatomy data lookups', async () => {
    const initialParts = service.getAllParts(bodyComponent);
    expectSameMembers(initialParts, [
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

    await service.buildAdjacencyCache('actor');

    await expect(service.getAnatomyData(42)).rejects.toBeInstanceOf(InvalidArgumentError);
    expect(await service.getAnatomyData('unknown')).toBeNull();
    expect(await service.getAnatomyData('torso')).toBeNull();
    expect(await service.getAnatomyData('actor')).toEqual({
      recipeId: 'humanoid.test',
      rootEntityId: 'actor',
    });

    const result = await service.detachPart('rightArm', {
      cascade: false,
      reason: 'maintenance',
    });

    expect(result.detached).toEqual(['rightArm']);
    expect(result.parentId).toBe('torso');
    expect(result.socketId).toBe('right_shoulder');

    const latestEvent = dispatcher.events.at(-1);
    expect(latestEvent.payload.detachedCount).toBe(1);
    expect(latestEvent.payload.reason).toBe('maintenance');

    await service.buildAdjacencyCache('actor');
    const partsAfterDetachingRightArm = service.getAllParts(bodyComponent, 'actor');
    expectSameMembers(partsAfterDetachingRightArm, [
      'actor',
      'torso',
      'leftArm',
      'leftHand',
      'head',
      'cyberArm',
      'floatingWing',
      'droneDock',
    ]);

    expect(service.validateCache()).toEqual({ valid: true, issues: [] });
  });
});
