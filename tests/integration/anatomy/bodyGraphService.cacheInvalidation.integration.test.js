import { describe, it, beforeEach, expect } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

const ACTOR_ID = 'actor.integration';
const BLUEPRINT_ROOT_ID = 'blueprint.integration.root';
const TORSO_ID = 'torso.integration';
const ARM_ID = 'arm.integration.left';
const HAND_ID = 'hand.integration.left';
const LEG_ID = 'leg.integration.right';
const FOOT_ID = 'foot.integration.right';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class RecordingDispatcher {
  constructor() {
    this.calls = [];
  }

  async dispatch(eventId, payload, options) {
    this.calls.push({ eventId, payload, options });
    return true;
  }
}

class InstrumentedEntityManager {
  constructor() {
    this.entities = new Map();
    this.jointScanCount = 0;
  }

  addEntity(id, components) {
    this.entities.set(id, { id, components: { ...components } });
  }

  cloneComponent(component) {
    return component === null || component === undefined
      ? component
      : JSON.parse(JSON.stringify(component));
  }

  getComponentData(id, componentId) {
    const entity = this.entities.get(id);
    if (!entity) return null;
    const component = entity.components[componentId];
    return component === undefined ? null : this.cloneComponent(component);
  }

  async removeComponent(id, componentId) {
    const entity = this.entities.get(id);
    if (entity) {
      delete entity.components[componentId];
    }
  }

  getEntityInstance(id) {
    const entity = this.entities.get(id);
    if (!entity) throw new Error(`Entity ${id} not found`);
    return {
      id: entity.id,
      components: this.cloneComponent(entity.components),
    };
  }

  getEntitiesWithComponent(componentId) {
    if (componentId === 'anatomy:joint') {
      this.jointScanCount += 1;
    }

    const result = [];
    for (const entity of this.entities.values()) {
      if (
        Object.prototype.hasOwnProperty.call(entity.components, componentId)
      ) {
        result.push({ id: entity.id, components: entity.components });
      }
    }
    return result;
  }

  setComponent(id, componentId, data) {
    if (!this.entities.has(id)) {
      this.entities.set(id, { id, components: {} });
    }
    this.entities.get(id).components[componentId] = this.cloneComponent(data);
  }
}

/**
 *
 */
function createEntityManagerWithHumanoid() {
  const manager = new InstrumentedEntityManager();

  manager.addEntity(ACTOR_ID, {
    'anatomy:body': {
      recipeId: 'anatomy.human.integration',
      body: { root: BLUEPRINT_ROOT_ID },
      structure: { rootPartId: BLUEPRINT_ROOT_ID },
    },
  });

  manager.addEntity(BLUEPRINT_ROOT_ID, {
    'anatomy:part': { subType: 'body_root' },
    'anatomy:joint': { parentId: ACTOR_ID, socketId: 'root-socket' },
  });

  manager.addEntity(TORSO_ID, {
    'anatomy:part': { subType: 'torso', metadata: { balance: 'stable' } },
    'anatomy:joint': { parentId: BLUEPRINT_ROOT_ID, socketId: 'torso-socket' },
    'status:core': { heartbeat: 'steady' },
  });

  manager.addEntity(ARM_ID, {
    'anatomy:part': { subType: 'arm', metadata: { side: 'left' } },
    'anatomy:joint': { parentId: TORSO_ID, socketId: 'arm-left-socket' },
    'custom:grip': { strength: { rating: 'firm' } },
  });

  manager.addEntity(HAND_ID, {
    'anatomy:part': { subType: 'hand', metadata: { side: 'left' } },
    'anatomy:joint': { parentId: ARM_ID, socketId: 'hand-left-socket' },
    'custom:sensation': { nerves: { tactile: 'responsive' } },
  });

  manager.addEntity(LEG_ID, {
    'anatomy:part': { subType: 'leg', metadata: { side: 'right' } },
    'anatomy:joint': { parentId: TORSO_ID, socketId: 'leg-right-socket' },
    'custom:status': { ready: true },
  });

  manager.addEntity(FOOT_ID, {
    'anatomy:part': { subType: 'foot', metadata: { side: 'right' } },
    'anatomy:joint': { parentId: LEG_ID, socketId: 'foot-right-socket' },
  });

  return manager;
}

/**
 *
 * @param root0
 * @param root0.useCustomQueryCache
 */
function createServiceEnvironment({ useCustomQueryCache = false } = {}) {
  const entityManager = createEntityManagerWithHumanoid();
  const logger = new RecordingLogger();
  const dispatcher = new RecordingDispatcher();
  const queryCache = useCustomQueryCache
    ? new AnatomyQueryCache({ logger: new RecordingLogger() })
    : undefined;

  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: dispatcher,
    queryCache,
  });

  const bodyComponent = entityManager.getComponentData(
    ACTOR_ID,
    'anatomy:body'
  );

  return {
    service,
    entityManager,
    logger,
    dispatcher,
    bodyComponent,
    queryCache,
  };
}

describe('BodyGraphService cache invalidation integration', () => {
  let service;
  let entityManager;
  let logger;
  let dispatcher;
  let bodyComponent;
  let queryCache;

  beforeEach(() => {
    ({ service, entityManager, logger, dispatcher, bodyComponent, queryCache } =
      createServiceEnvironment({ useCustomQueryCache: true }));
  });

  it('builds caches, reuses query results, and traverses anatomy relationships', async () => {
    expect(service.hasCache(ACTOR_ID)).toBe(false);
    expect(entityManager.jointScanCount).toBe(0);

    await service.buildAdjacencyCache(ACTOR_ID);
    expect(service.hasCache(ACTOR_ID)).toBe(true);
    expect(entityManager.jointScanCount).toBeGreaterThan(0);

    const initialScanCount = entityManager.jointScanCount;
    await service.buildAdjacencyCache(ACTOR_ID);
    expect(entityManager.jointScanCount).toBe(initialScanCount);

    const allParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(allParts).toEqual(
      expect.arrayContaining([
        ACTOR_ID,
        TORSO_ID,
        ARM_ID,
        HAND_ID,
        LEG_ID,
        FOOT_ID,
      ])
    );

    const cachedAllParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(cachedAllParts).toBe(allParts);

    const blueprintOnly = service.getAllParts({ root: BLUEPRINT_ROOT_ID });
    expect(blueprintOnly).toEqual(
      expect.arrayContaining([
        BLUEPRINT_ROOT_ID,
        TORSO_ID,
        ARM_ID,
        HAND_ID,
        LEG_ID,
        FOOT_ID,
      ])
    );
    expect(blueprintOnly).not.toContain(ACTOR_ID);

    expect(service.getAllParts(null)).toEqual([]);
    expect(service.getAllParts({ body: {} })).toEqual([]);

    const hands = service.findPartsByType(ACTOR_ID, 'hand');
    const cachedHands = service.findPartsByType(ACTOR_ID, 'hand');
    expect(hands).toEqual([HAND_ID]);
    expect(cachedHands).toBe(hands);

    expect(service.getAnatomyRoot(HAND_ID)).toBe(ACTOR_ID);
    expect(service.getParent(TORSO_ID)).toBe(BLUEPRINT_ROOT_ID);
    expect(service.getParent(ACTOR_ID)).toBeNull();

    expect(service.getChildren(TORSO_ID)).toEqual(
      expect.arrayContaining([ARM_ID, LEG_ID])
    );
    expect(service.getChildren('unknown')).toEqual([]);

    expect(service.getAncestors(HAND_ID)).toEqual([
      ARM_ID,
      TORSO_ID,
      BLUEPRINT_ROOT_ID,
      ACTOR_ID,
    ]);
    expect(service.getAncestors(ACTOR_ID)).toEqual([]);

    expect(service.getAllDescendants(TORSO_ID)).toEqual(
      expect.arrayContaining([ARM_ID, HAND_ID, LEG_ID, FOOT_ID])
    );

    expect(service.getPath(HAND_ID, FOOT_ID)).toEqual([
      HAND_ID,
      ARM_ID,
      TORSO_ID,
      LEG_ID,
      FOOT_ID,
    ]);

    expect(
      service.hasPartWithComponent(bodyComponent, 'custom:sensation')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'anatomy:non-existent')
    ).toBe(false);

    const gripCheck = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:grip',
      'strength.rating',
      'firm'
    );
    expect(gripCheck).toEqual({ found: true, partId: ARM_ID });

    const missingValue = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:grip',
      'strength.rating',
      'soft'
    );
    expect(missingValue).toEqual({ found: false });

    const graph = await service.getBodyGraph(ACTOR_ID);
    expect(graph.getAllPartIds()).toEqual(expect.arrayContaining(allParts));
    expect(graph.getConnectedParts(ARM_ID)).toEqual([HAND_ID]);
    expect(graph.getConnectedParts('no-such-part')).toEqual([]);

    const metadata = await service.getAnatomyData(ACTOR_ID);
    expect(metadata).toEqual({
      recipeId: 'anatomy.human.integration',
      rootEntityId: ACTOR_ID,
    });

    const stats = queryCache.getStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(service.validateCache().valid).toBe(true);
  });

  it('detaches parts, invalidates caches, and emits detachment events for cascade modes', async () => {
    await service.buildAdjacencyCache(ACTOR_ID);
    service.getAllParts(bodyComponent, ACTOR_ID);
    service.findPartsByType(ACTOR_ID, 'hand');

    const preDetachStats = queryCache.getStats();
    expect(preDetachStats.size).toBeGreaterThan(0);

    const cascadeFalse = await service.detachPart(HAND_ID, {
      cascade: false,
      reason: 'inspection',
    });
    expect(cascadeFalse).toEqual({
      detached: [HAND_ID],
      parentId: ARM_ID,
      socketId: 'hand-left-socket',
    });

    expect(service.hasCache(ACTOR_ID)).toBe(false);
    expect(queryCache.getStats().size).toBe(0);
    expect(dispatcher.calls).toHaveLength(1);
    const [firstCall] = dispatcher.calls;
    expect(firstCall.eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(firstCall.payload.reason).toBe('inspection');
    expect(firstCall.payload.detachedCount).toBe(1);

    await expect(service.detachPart(HAND_ID)).rejects.toThrow(
      InvalidArgumentError
    );

    const freshEnv = createServiceEnvironment();
    await freshEnv.service.buildAdjacencyCache(ACTOR_ID);
    const cascadeDefault = await freshEnv.service.detachPart(ARM_ID);
    expect(cascadeDefault.detached).toEqual(
      expect.arrayContaining([ARM_ID, HAND_ID])
    );
    expect(cascadeDefault.parentId).toBe(TORSO_ID);
    expect(cascadeDefault.socketId).toBe('arm-left-socket');
    expect(freshEnv.dispatcher.calls[0].payload.reason).toBe('manual');

    await expect(freshEnv.service.detachPart('non-existent')).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('guards invalid inputs and dependency requirements for public APIs', async () => {
    await expect(service.getBodyGraph('missing-actor')).rejects.toThrow(
      /has no anatomy:body component/
    );
    await expect(service.getBodyGraph(123)).rejects.toThrow(
      InvalidArgumentError
    );

    await expect(service.getAnatomyData('')).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData(42)).rejects.toThrow(
      InvalidArgumentError
    );
    expect(await service.getAnatomyData(ARM_ID)).toBeNull();

    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow(/entityManager is required/);
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })
    ).toThrow(/logger is required/);
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      /eventDispatcher is required/
    );
  });
});
