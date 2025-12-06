import { beforeEach, describe, expect, it } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
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
    (...entries) => {
      const rendered = entries
        .map((entry) =>
          typeof entry === 'string' ? entry : JSON.stringify(entry, null, 2)
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

class InMemoryEntityManager {
  constructor(initialEntities = {}) {
    this.entities = new Map();
    this.componentIndex = new Map();
    this.getEntitiesWithComponentCalls = 0;
    this.removedComponents = [];

    Object.entries(initialEntities).forEach(([entityId, components]) => {
      Object.entries(components).forEach(([componentId, value]) => {
        this.setComponent(entityId, componentId, value);
      });
    });
  }

  entities;
  componentIndex;
  getEntitiesWithComponentCalls;
  removedComponents;

  #clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  #ensureEntity(entityId) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, new Map());
    }
  }

  #ensureIndex(componentId) {
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Set());
    }
  }

  setComponent(entityId, componentId, value) {
    this.#ensureEntity(entityId);
    this.entities.get(entityId).set(componentId, this.#clone(value));
    this.#ensureIndex(componentId);
    this.componentIndex.get(componentId).add(entityId);
  }

  async removeComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.delete(componentId);
    }

    const index = this.componentIndex.get(componentId);
    if (index) {
      index.delete(entityId);
      if (index.size === 0) {
        this.componentIndex.delete(componentId);
      }
    }

    this.removedComponents.push({ entityId, componentId });
  }

  getComponentData(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return null;
    }
    const value = entity.get(componentId);
    return value === undefined ? null : this.#clone(value);
  }

  getEntitiesWithComponent(componentId) {
    this.getEntitiesWithComponentCalls += 1;
    const index = this.componentIndex.get(componentId);
    if (!index) {
      return [];
    }
    return Array.from(index).map((entityId) => ({ id: entityId }));
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

const ACTOR_ID = 'actor-root';
const TORSO_ID = 'torso-part';
const LEFT_ARM_ID = 'left-arm';
const LEFT_HAND_ID = 'left-hand';
const RIGHT_ARM_ID = 'right-arm';
const RIGHT_HAND_ID = 'right-hand';
const HEAD_ID = 'head';
const HEART_ID = 'heart';

const createBodyComponent = () => ({
  recipeId: 'humanoid.basic',
  body: { root: ACTOR_ID },
  root: TORSO_ID,
  structure: {
    rootPartId: TORSO_ID,
    parts: {
      [TORSO_ID]: {
        children: [LEFT_ARM_ID, RIGHT_ARM_ID, HEAD_ID, HEART_ID],
        partType: 'torso',
      },
      [LEFT_ARM_ID]: { children: [LEFT_HAND_ID], partType: 'arm' },
      [RIGHT_ARM_ID]: { children: [RIGHT_HAND_ID], partType: 'arm' },
      [LEFT_HAND_ID]: { children: [], partType: 'hand' },
      [RIGHT_HAND_ID]: { children: [], partType: 'hand' },
      [HEAD_ID]: { children: [], partType: 'head' },
      [HEART_ID]: { children: [], partType: 'organ' },
    },
  },
});

const seedEntities = (bodyComponent) => ({
  [ACTOR_ID]: {
    'anatomy:body': bodyComponent,
  },
  [TORSO_ID]: {
    'anatomy:part': { subType: 'torso' },
    'anatomy:joint': { parentId: ACTOR_ID, socketId: 'spine' },
    'custom:emptyOnly': {},
  },
  [LEFT_ARM_ID]: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: TORSO_ID, socketId: 'shoulder-left' },
    'custom:decor': { details: { color: 'blue' } },
  },
  [LEFT_HAND_ID]: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: LEFT_ARM_ID, socketId: 'wrist-left' },
    'sensors:touch': { sensitivity: 'high' },
  },
  [RIGHT_ARM_ID]: {
    'anatomy:part': { subType: 'arm' },
    'anatomy:joint': { parentId: TORSO_ID, socketId: 'shoulder-right' },
    'custom:decor': {},
  },
  [RIGHT_HAND_ID]: {
    'anatomy:part': { subType: 'hand' },
    'anatomy:joint': { parentId: RIGHT_ARM_ID, socketId: 'wrist-right' },
  },
  [HEAD_ID]: {
    'anatomy:part': { subType: 'head' },
    'anatomy:joint': { parentId: TORSO_ID, socketId: 'neck' },
  },
  [HEART_ID]: {
    'anatomy:part': { subType: 'organ' },
    'anatomy:joint': { parentId: TORSO_ID, socketId: 'thoracic-cavity' },
  },
});

const createFixture = () => {
  const bodyComponent = createBodyComponent();
  const entityManager = new InMemoryEntityManager(seedEntities(bodyComponent));
  const eventDispatcher = new RecordingDispatcher();
  const logger = createLogger();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  return {
    bodyComponent,
    entityManager,
    eventDispatcher,
    logger,
    service,
  };
};

describe('BodyGraphService integration: cache refresh & graph queries', () => {
  let bodyComponent;
  let entityManager;
  let eventDispatcher;
  let logger;
  let service;

  beforeEach(() => {
    ({ bodyComponent, entityManager, eventDispatcher, logger, service } =
      createFixture());
  });

  it('coordinates caches, queries, and traversal across real modules', async () => {
    expect(service.hasCache(ACTOR_ID)).toBe(false);
    expect(service.getAnatomyRoot(LEFT_HAND_ID)).toBe(ACTOR_ID);

    await service.buildAdjacencyCache(ACTOR_ID);
    const firstBuildCalls = entityManager.getEntitiesWithComponentCalls;
    expect(firstBuildCalls).toBeGreaterThanOrEqual(1);

    await service.buildAdjacencyCache(ACTOR_ID);
    expect(entityManager.getEntitiesWithComponentCalls).toBe(firstBuildCalls);

    const allFromBlueprint = service.getAllParts(bodyComponent);
    expect(new Set(allFromBlueprint)).toEqual(
      new Set([
        ACTOR_ID,
        TORSO_ID,
        LEFT_ARM_ID,
        LEFT_HAND_ID,
        RIGHT_ARM_ID,
        RIGHT_HAND_ID,
        HEAD_ID,
        HEART_ID,
      ])
    );

    expect(service.getAllParts(bodyComponent)).toBe(allFromBlueprint);

    expect(service.getAllParts(bodyComponent, ACTOR_ID)).toBe(allFromBlueprint);

    const fallbackAll = service.getAllParts(bodyComponent, 'missing-actor');
    expect(new Set(fallbackAll)).toEqual(new Set(allFromBlueprint));

    const torsoSubtree = service.getAllParts({ root: TORSO_ID });
    expect(new Set(torsoSubtree)).toEqual(
      new Set([
        TORSO_ID,
        LEFT_ARM_ID,
        LEFT_HAND_ID,
        RIGHT_ARM_ID,
        RIGHT_HAND_ID,
        HEAD_ID,
        HEART_ID,
      ])
    );

    expect(service.getAllParts(null)).toEqual([]);

    const arms = service.findPartsByType(ACTOR_ID, 'arm');
    expect(new Set(arms)).toEqual(new Set([LEFT_ARM_ID, RIGHT_ARM_ID]));
    expect(service.findPartsByType(ACTOR_ID, 'arm')).toBe(arms);

    expect(service.hasPartWithComponent(bodyComponent, 'sensors:touch')).toBe(
      true
    );
    expect(
      service.hasPartWithComponent(bodyComponent, 'custom:emptyOnly')
    ).toBe(false);
    expect(
      service.hasPartWithComponent(bodyComponent, 'missing:component')
    ).toBe(false);

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:decor',
        'details.color',
        'blue'
      )
    ).toEqual({ found: true, partId: LEFT_ARM_ID });

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'custom:decor',
        'details.intensity',
        'high'
      )
    ).toEqual({ found: false });

    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'sensors:touch',
        'sensitivity',
        'medium'
      )
    ).toEqual({ found: false });

    const path = service.getPath(LEFT_HAND_ID, RIGHT_HAND_ID);
    expect(path).toEqual([
      LEFT_HAND_ID,
      LEFT_ARM_ID,
      TORSO_ID,
      RIGHT_ARM_ID,
      RIGHT_HAND_ID,
    ]);

    expect(service.getChildren(TORSO_ID)).toEqual([
      LEFT_ARM_ID,
      RIGHT_ARM_ID,
      HEAD_ID,
      HEART_ID,
    ]);
    expect(service.getParent(LEFT_HAND_ID)).toBe(LEFT_ARM_ID);
    expect(service.getAncestors(LEFT_HAND_ID)).toEqual([
      LEFT_ARM_ID,
      TORSO_ID,
      ACTOR_ID,
    ]);
    const descendants = service.getAllDescendants(TORSO_ID);
    expect(descendants).toHaveLength(6);
    expect(new Set(descendants)).toEqual(
      new Set([
        LEFT_ARM_ID,
        LEFT_HAND_ID,
        RIGHT_ARM_ID,
        RIGHT_HAND_ID,
        HEAD_ID,
        HEART_ID,
      ])
    );

    const bodyGraph = await service.getBodyGraph(ACTOR_ID);
    expect(new Set(bodyGraph.getAllPartIds())).toEqual(
      new Set(allFromBlueprint)
    );
    expect(bodyGraph.getConnectedParts(LEFT_ARM_ID)).toEqual([LEFT_HAND_ID]);
    await expect(service.getBodyGraph(LEFT_ARM_ID)).rejects.toThrow(
      `Entity ${LEFT_ARM_ID} has no anatomy:body component`
    );

    await expect(service.getAnatomyData(ACTOR_ID)).resolves.toEqual({
      recipeId: 'humanoid.basic',
      rootEntityId: ACTOR_ID,
    });
    await expect(service.getAnatomyData(LEFT_ARM_ID)).resolves.toBeNull();

    const validation = service.validateCache();
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
    expect(service.hasCache(ACTOR_ID)).toBe(true);
  });

  it('detaches parts and refreshes caches alongside query invalidation', async () => {
    await service.buildAdjacencyCache(ACTOR_ID);
    expect(entityManager.getEntitiesWithComponentCalls).toBe(1);

    const initialAll = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(initialAll).toEqual(
      expect.arrayContaining([
        LEFT_ARM_ID,
        RIGHT_ARM_ID,
        LEFT_HAND_ID,
        RIGHT_HAND_ID,
      ])
    );
    const initialArms = service.findPartsByType(ACTOR_ID, 'arm');
    expect(initialArms).toHaveLength(2);

    const detachCascade = await service.detachPart(LEFT_ARM_ID, {
      reason: 'injury',
    });
    expect(detachCascade.detached).toEqual(
      expect.arrayContaining([LEFT_ARM_ID, LEFT_HAND_ID])
    );
    expect(detachCascade.parentId).toBe(TORSO_ID);
    expect(detachCascade.socketId).toBe('shoulder-left');

    expect(eventDispatcher.events).toHaveLength(1);
    const firstEvent = eventDispatcher.events[0];
    expect(firstEvent.eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(firstEvent.payload.detachedCount).toBe(2);
    expect(firstEvent.payload.reason).toBe('injury');
    expect(firstEvent.payload.parentEntityId).toBe(TORSO_ID);
    expect(firstEvent.payload.detachedEntityId).toBe(LEFT_ARM_ID);
    expect(typeof firstEvent.payload.timestamp).toBe('number');

    expect(
      entityManager.getComponentData(LEFT_ARM_ID, 'anatomy:joint')
    ).toBeNull();
    expect(entityManager.removedComponents).toContainEqual({
      entityId: LEFT_ARM_ID,
      componentId: 'anatomy:joint',
    });

    expect(service.hasCache(ACTOR_ID)).toBe(false);

    const callsBeforeCascadeRebuild =
      entityManager.getEntitiesWithComponentCalls;
    await service.buildAdjacencyCache(ACTOR_ID);
    expect(entityManager.getEntitiesWithComponentCalls).toBe(
      callsBeforeCascadeRebuild + 1
    );

    const afterCascade = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(afterCascade).not.toBe(initialAll);
    expect(new Set(afterCascade)).not.toContain(LEFT_ARM_ID);
    expect(new Set(afterCascade)).not.toContain(LEFT_HAND_ID);
    expect(service.findPartsByType(ACTOR_ID, 'arm')).toEqual([RIGHT_ARM_ID]);

    expect(service.getAllParts(bodyComponent, ACTOR_ID)).toBe(afterCascade);

    const detachSingle = await service.detachPart(RIGHT_ARM_ID, {
      cascade: false,
      reason: 'maintenance',
    });
    expect(detachSingle.detached).toEqual([RIGHT_ARM_ID]);
    expect(detachSingle.parentId).toBe(TORSO_ID);
    expect(detachSingle.socketId).toBe('shoulder-right');

    expect(eventDispatcher.events).toHaveLength(2);
    const secondEvent = eventDispatcher.events[1];
    expect(secondEvent.payload.detachedCount).toBe(1);
    expect(secondEvent.payload.reason).toBe('maintenance');

    expect(service.hasCache(ACTOR_ID)).toBe(false);

    const callsBeforeSingleRebuild =
      entityManager.getEntitiesWithComponentCalls;
    await service.buildAdjacencyCache(ACTOR_ID);
    expect(entityManager.getEntitiesWithComponentCalls).toBe(
      callsBeforeSingleRebuild + 1
    );

    const afterSingle = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(afterSingle).not.toBe(afterCascade);
    expect(new Set(afterSingle)).not.toContain(RIGHT_ARM_ID);
    expect(new Set(afterSingle)).not.toContain(RIGHT_HAND_ID);
    expect(service.findPartsByType(ACTOR_ID, 'arm')).toHaveLength(0);

    await expect(service.detachPart('ghost')).rejects.toThrow(
      "Entity 'ghost' has no joint component - cannot detach"
    );
  });
});
