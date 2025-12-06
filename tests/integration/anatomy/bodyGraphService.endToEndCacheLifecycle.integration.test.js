import { beforeEach, describe, expect, it } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const ACTOR_ID = 'actor-1';
const TORSO_ID = 'torso';
const HEAD_ID = 'head';
const LEFT_ARM_ID = 'left-arm';
const LEFT_HAND_ID = 'left-hand';
const RIGHT_ARM_ID = 'right-arm';
const RIGHT_HAND_ID = 'right-hand';
const HEART_ID = 'heart';
const SENSOR_ID = 'sensor-array';
const DECOR_ID = 'decor-shell';
const FLOATING_ID = 'floating-probe';
const LOOSE_ID = 'loose-gear';
const EXTRA_DIGIT_ID = 'spare-finger';

class InMemoryEntityManager {
  constructor(initial = {}) {
    this.entities = new Set();
    this.components = new Map();
    this.componentIndex = new Map();

    for (const [entityId, componentMap] of Object.entries(initial)) {
      for (const [componentId, data] of Object.entries(componentMap)) {
        this.addComponent(entityId, componentId, data);
      }
    }
  }

  #key(entityId, componentId) {
    return `${entityId}:::${componentId}`;
  }

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    try {
      return structuredClone(value);
    } catch (error) {
      return JSON.parse(JSON.stringify(value));
    }
  }

  addComponent(entityId, componentId, data) {
    this.entities.add(entityId);
    const key = this.#key(entityId, componentId);
    this.components.set(key, this.#clone(data));

    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Map());
    }
    this.componentIndex.get(componentId).set(entityId, { id: entityId });
  }

  updateComponent(entityId, componentId, data) {
    this.addComponent(entityId, componentId, data);
  }

  getComponentData(entityId, componentId) {
    const key = this.#key(entityId, componentId);
    const value = this.components.get(key);
    return value === undefined ? null : this.#clone(value);
  }

  async removeComponent(entityId, componentId) {
    const key = this.#key(entityId, componentId);
    this.components.delete(key);

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

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

/**
 *
 */
function createLogger() {
  const entries = { debug: [], info: [], warn: [], error: [] };

  const formatMessage = (args) =>
    args
      .map((value) => {
        if (typeof value === 'string') {
          return value;
        }
        try {
          return JSON.stringify(value);
        } catch (error) {
          return String(value);
        }
      })
      .join(' ');

  return {
    entries,
    debug: (...args) => entries.debug.push(formatMessage(args)),
    info: (...args) => entries.info.push(formatMessage(args)),
    warn: (...args) => entries.warn.push(formatMessage(args)),
    error: (...args) => entries.error.push(formatMessage(args)),
  };
}

/**
 *
 */
function createFixture() {
  const entityManager = new InMemoryEntityManager();

  entityManager.addComponent(ACTOR_ID, 'anatomy:body', {
    recipeId: 'recipe:hero-prototype',
    body: { root: ACTOR_ID },
    structure: { rootPartId: TORSO_ID },
  });

  entityManager.addComponent(TORSO_ID, 'anatomy:part', { subType: 'torso' });
  entityManager.addComponent(TORSO_ID, 'anatomy:joint', {
    parentId: ACTOR_ID,
    socketId: 'core',
  });

  entityManager.addComponent(HEAD_ID, 'anatomy:part', { subType: 'head' });
  entityManager.addComponent(HEAD_ID, 'anatomy:joint', {
    parentId: TORSO_ID,
    socketId: 'neck',
  });

  entityManager.addComponent(LEFT_ARM_ID, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(LEFT_ARM_ID, 'anatomy:joint', {
    parentId: TORSO_ID,
    socketId: 'shoulder-left',
  });

  entityManager.addComponent(LEFT_HAND_ID, 'anatomy:part', { subType: 'hand' });
  entityManager.addComponent(LEFT_HAND_ID, 'anatomy:joint', {
    parentId: LEFT_ARM_ID,
    socketId: 'wrist-left',
  });
  entityManager.addComponent(LEFT_HAND_ID, 'custom:metadata', {
    style: { color: 'silver' },
  });

  entityManager.addComponent(RIGHT_ARM_ID, 'anatomy:part', { subType: 'arm' });
  entityManager.addComponent(RIGHT_ARM_ID, 'anatomy:joint', {
    parentId: TORSO_ID,
    socketId: 'shoulder-right',
  });

  entityManager.addComponent(RIGHT_HAND_ID, 'anatomy:part', {
    subType: 'hand',
  });
  entityManager.addComponent(RIGHT_HAND_ID, 'anatomy:joint', {
    parentId: RIGHT_ARM_ID,
    socketId: 'wrist-right',
  });

  entityManager.addComponent(HEART_ID, 'anatomy:part', { subType: 'organ' });
  entityManager.addComponent(HEART_ID, 'anatomy:joint', {
    parentId: TORSO_ID,
    socketId: 'core-internal',
  });
  entityManager.addComponent(HEART_ID, 'vital:status', { beating: true });

  entityManager.addComponent(SENSOR_ID, 'anatomy:part', { subType: 'sensor' });
  entityManager.addComponent(SENSOR_ID, 'anatomy:joint', {
    parentId: HEAD_ID,
    socketId: 'crown-mount',
  });

  entityManager.addComponent(DECOR_ID, 'anatomy:part', { subType: 'shell' });
  entityManager.addComponent(DECOR_ID, 'anatomy:joint', {
    parentId: TORSO_ID,
    socketId: 'outer-shell',
  });
  entityManager.addComponent(DECOR_ID, 'decor:empty', {});

  entityManager.addComponent(FLOATING_ID, 'anatomy:part', { subType: 'drone' });
  entityManager.addComponent(FLOATING_ID, 'anatomy:joint', {
    parentId: null,
    socketId: 'hover',
  });

  entityManager.addComponent(LOOSE_ID, 'anatomy:part', { subType: 'spare' });

  const logger = createLogger();
  const dispatcher = new RecordingDispatcher();

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: dispatcher,
  });

  const bodyComponent = entityManager.getComponentData(
    ACTOR_ID,
    'anatomy:body'
  );
  const directBodyComponent = { root: ACTOR_ID };

  return {
    service,
    entityManager,
    logger,
    dispatcher,
    bodyComponent,
    directBodyComponent,
  };
}

const expectedAllParts = [
  ACTOR_ID,
  TORSO_ID,
  HEAD_ID,
  LEFT_ARM_ID,
  LEFT_HAND_ID,
  RIGHT_ARM_ID,
  RIGHT_HAND_ID,
  HEART_ID,
  SENSOR_ID,
  DECOR_ID,
];

describe('BodyGraphService integration – end-to-end cache lifecycle', () => {
  let fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('builds caches, resolves traversal helpers, and reuses cached query results', async () => {
    const {
      service,
      entityManager,
      logger,
      bodyComponent,
      directBodyComponent,
    } = fixture;

    expect(service.hasCache(ACTOR_ID)).toBe(false);

    await service.buildAdjacencyCache(ACTOR_ID);
    expect(service.hasCache(ACTOR_ID)).toBe(true);

    await service.buildAdjacencyCache(ACTOR_ID);
    const buildLogs = logger.entries.debug.filter((message) =>
      message.includes(
        `AnatomyCacheManager: Building cache for anatomy rooted at '${ACTOR_ID}'`
      )
    );
    expect(buildLogs).toHaveLength(1);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({})).toEqual([]);

    const allFromBody = service.getAllParts(bodyComponent);
    expect(new Set(allFromBody)).toEqual(new Set(expectedAllParts));

    const allFromDirect = service.getAllParts(directBodyComponent);
    expect(new Set(allFromDirect)).toEqual(new Set(expectedAllParts));

    const cachedAllParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(cachedAllParts).toBe(allFromBody);

    entityManager.addComponent(EXTRA_DIGIT_ID, 'anatomy:part', {
      subType: 'finger',
    });
    entityManager.addComponent(EXTRA_DIGIT_ID, 'anatomy:joint', {
      parentId: LEFT_HAND_ID,
      socketId: 'extra-digit',
    });

    const ancestors = service.getAncestors(LEFT_HAND_ID);
    expect(ancestors).toEqual([LEFT_ARM_ID, TORSO_ID, ACTOR_ID]);
    expect(service.getAncestors(ACTOR_ID)).toEqual([]);

    const descendants = service.getAllDescendants(TORSO_ID);
    expect(new Set(descendants)).toEqual(
      new Set([
        LEFT_ARM_ID,
        LEFT_HAND_ID,
        RIGHT_ARM_ID,
        RIGHT_HAND_ID,
        HEAD_ID,
        SENSOR_ID,
        HEART_ID,
        DECOR_ID,
      ])
    );
    expect(service.getAllDescendants(FLOATING_ID)).toEqual([]);

    const children = service.getChildren(TORSO_ID);
    expect(new Set(children)).toEqual(
      new Set([LEFT_ARM_ID, RIGHT_ARM_ID, HEAD_ID, HEART_ID, DECOR_ID])
    );
    expect(service.getChildren(LEFT_HAND_ID)).toEqual([]);

    expect(service.getParent(LEFT_HAND_ID)).toBe(LEFT_ARM_ID);
    expect(service.getParent(ACTOR_ID)).toBeNull();
    expect(service.getParent(FLOATING_ID)).toBeNull();

    const pathSelf = service.getPath(LEFT_HAND_ID, LEFT_HAND_ID);
    expect(pathSelf).toEqual([LEFT_HAND_ID]);

    const pathBetweenHands = service.getPath(LEFT_HAND_ID, RIGHT_HAND_ID);
    expect(pathBetweenHands).toEqual([
      LEFT_HAND_ID,
      LEFT_ARM_ID,
      TORSO_ID,
      RIGHT_ARM_ID,
      RIGHT_HAND_ID,
    ]);
    expect(service.getPath(TORSO_ID, FLOATING_ID)).toBeNull();

    const partsByTypeInitial = service.findPartsByType(ACTOR_ID, 'arm');
    expect(new Set(partsByTypeInitial)).toEqual(
      new Set([LEFT_ARM_ID, RIGHT_ARM_ID])
    );
    const partsByTypeCached = service.findPartsByType(ACTOR_ID, 'arm');
    expect(partsByTypeCached).toBe(partsByTypeInitial);

    expect(service.getAnatomyRoot(LEFT_HAND_ID)).toBe(ACTOR_ID);
    expect(service.getAnatomyRoot(EXTRA_DIGIT_ID)).toBe(ACTOR_ID);
    expect(service.getAnatomyRoot(FLOATING_ID)).toBeNull();
    expect(service.getAnatomyRoot(null)).toBeNull();
    expect(service.getAnatomyRoot('ghost-id')).toBe('ghost-id');

    const hasVitalComponent = service.hasPartWithComponent(
      bodyComponent,
      'vital:status'
    );
    expect(hasVitalComponent).toBe(true);
    expect(service.hasPartWithComponent(bodyComponent, 'decor:empty')).toBe(
      false
    );

    const hasStyleColor = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:metadata',
      'style.color',
      'silver'
    );
    expect(hasStyleColor).toEqual({ found: true, partId: LEFT_HAND_ID });

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:metadata',
        'style.texture',
        'brushed'
      )
    ).toEqual({ found: false });
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'unknown:component',
        'style.color',
        'silver'
      )
    ).toEqual({ found: false });

    const graph = await service.getBodyGraph(ACTOR_ID);
    expect(new Set(graph.getAllPartIds())).toEqual(new Set(expectedAllParts));
    expect(new Set(graph.getConnectedParts(TORSO_ID))).toEqual(
      new Set([LEFT_ARM_ID, RIGHT_ARM_ID, HEAD_ID, HEART_ID, DECOR_ID])
    );
    expect(graph.getConnectedParts(LEFT_HAND_ID)).toEqual([]);

    await expect(service.getBodyGraph(FLOATING_ID)).rejects.toThrow(
      'has no anatomy:body component'
    );
    await expect(service.getBodyGraph(123)).rejects.toThrow(
      InvalidArgumentError
    );

    const anatomyData = await service.getAnatomyData(ACTOR_ID);
    expect(anatomyData).toEqual({
      recipeId: 'recipe:hero-prototype',
      rootEntityId: ACTOR_ID,
    });
    await expect(service.getAnatomyData(0)).rejects.toThrow(
      InvalidArgumentError
    );
    expect(await service.getAnatomyData(FLOATING_ID)).toBeNull();

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);

    const bodyLogs = logger.entries.debug.filter((message) =>
      message.includes('AnatomyGraphAlgorithms returned')
    );
    expect(bodyLogs.length).toBeGreaterThan(0);
  });

  it('detaches parts, invalidates caches, and reports joint errors', async () => {
    const firstRun = createFixture();
    const { service, entityManager, dispatcher, logger } = firstRun;

    await service.buildAdjacencyCache(ACTOR_ID);
    const initialArms = service.findPartsByType(ACTOR_ID, 'arm');
    expect(new Set(initialArms)).toEqual(new Set([LEFT_ARM_ID, RIGHT_ARM_ID]));

    const firstCached = service.findPartsByType(ACTOR_ID, 'arm');
    expect(firstCached).toBe(initialArms);

    const sensorDetach = await service.detachPart(SENSOR_ID, {
      cascade: false,
      reason: 'maintenance',
    });
    expect(sensorDetach).toEqual({
      detached: [SENSOR_ID],
      parentId: HEAD_ID,
      socketId: 'crown-mount',
    });

    expect(service.hasCache(ACTOR_ID)).toBe(false);
    const maintenanceEvent = dispatcher.events.find(
      (event) => event.payload && event.payload.reason === 'maintenance'
    );
    expect(maintenanceEvent?.eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(maintenanceEvent?.payload.detachedCount).toBe(1);

    await service.buildAdjacencyCache(ACTOR_ID);
    const postMaintenanceArms = service.findPartsByType(ACTOR_ID, 'arm');
    expect(postMaintenanceArms).not.toBe(initialArms);
    expect(new Set(postMaintenanceArms)).toEqual(
      new Set([LEFT_ARM_ID, RIGHT_ARM_ID])
    );

    entityManager.addComponent(SENSOR_ID, 'anatomy:joint', {
      parentId: HEAD_ID,
      socketId: 'crown-mount',
    });

    await service.buildAdjacencyCache(ACTOR_ID);
    service.findPartsByType(ACTOR_ID, 'arm');

    const limbDetach = await service.detachPart(LEFT_ARM_ID, {
      cascade: true,
      reason: 'injury',
    });
    expect(new Set(limbDetach.detached)).toEqual(
      new Set([LEFT_ARM_ID, LEFT_HAND_ID])
    );
    expect(limbDetach.parentId).toBe(TORSO_ID);
    expect(limbDetach.socketId).toBe('shoulder-left');

    const injuryEvent = dispatcher.events.find(
      (event) => event.payload && event.payload.reason === 'injury'
    );
    expect(injuryEvent?.eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(injuryEvent?.payload.detachedCount).toBe(2);
    expect(injuryEvent?.payload.parentEntityId).toBe(TORSO_ID);
    expect(injuryEvent?.payload.detachedEntityId).toBe(LEFT_ARM_ID);
    expect(typeof injuryEvent?.payload.timestamp).toBe('number');

    expect(service.hasCache(ACTOR_ID)).toBe(false);
    const detachLogs = logger.entries.info.filter((message) =>
      message.includes('BodyGraphService: Detached')
    );
    expect(detachLogs.length).toBeGreaterThanOrEqual(2);

    await service.buildAdjacencyCache(ACTOR_ID);
    const armsAfterDetach = service.findPartsByType(ACTOR_ID, 'arm');
    expect(new Set(armsAfterDetach)).toEqual(new Set([RIGHT_ARM_ID]));

    await expect(
      service.detachPart(LOOSE_ID, { reason: 'no-joint' })
    ).rejects.toThrow('has no joint component - cannot detach');
  });
});
