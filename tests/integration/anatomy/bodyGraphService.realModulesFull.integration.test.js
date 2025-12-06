import { describe, it, expect, beforeEach } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';

const ACTOR_ID = 'actor-alpha';
const TORSO_ID = 'torso-alpha';
const ARM_ID = 'arm-left';
const HAND_ID = 'hand-left';
const LEG_ID = 'leg-right';
const FOOT_ID = 'foot-right';
const BLUEPRINT_ROOT_ID = 'blueprint-root';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, meta) {
    this.debugEntries.push({ message, meta });
  }

  info(message, meta) {
    this.infoEntries.push({ message, meta });
  }

  warn(message, meta) {
    this.warnEntries.push({ message, meta });
  }

  error(message, meta) {
    this.errorEntries.push({ message, meta });
  }
}

class RecordingDispatcher {
  constructor() {
    this.calls = [];
  }

  async dispatch(eventId, payload) {
    this.calls.push({ eventId, payload });
    return undefined;
  }
}

class TestEntityManager {
  constructor() {
    this.entities = new Map();
    this.jointLookupCount = 0;
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
    if (!entity) {
      return null;
    }
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
    if (!entity) {
      throw new Error(`Entity ${id} not found`);
    }
    return {
      id: entity.id,
      components: this.cloneComponent(entity.components),
    };
  }

  getEntitiesWithComponent(componentId) {
    if (componentId === 'anatomy:joint') {
      this.jointLookupCount += 1;
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
function createEntityManagerWithAnatomy() {
  const manager = new TestEntityManager();

  manager.addEntity(ACTOR_ID, {
    'anatomy:body': {
      recipeId: 'anatomy.human.standard',
      body: { root: BLUEPRINT_ROOT_ID },
      structure: { rootPartId: BLUEPRINT_ROOT_ID },
    },
  });

  manager.addEntity(BLUEPRINT_ROOT_ID, {
    'anatomy:part': { subType: 'body_root' },
    'anatomy:joint': { parentId: ACTOR_ID, socketId: 'root-socket' },
  });

  manager.addEntity(TORSO_ID, {
    'anatomy:part': { subType: 'torso', metadata: { support: true } },
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
 * @param root0.queryCache
 */
function createService({ queryCache } = {}) {
  const entityManager = createEntityManagerWithAnatomy();
  const logger = new RecordingLogger();
  const dispatcher = new RecordingDispatcher();
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
  return { service, entityManager, logger, dispatcher, bodyComponent };
}

describe('BodyGraphService real module integration', () => {
  let service;
  let entityManager;
  let logger;
  let dispatcher;
  let bodyComponent;

  beforeEach(() => {
    ({ service, entityManager, logger, dispatcher, bodyComponent } =
      createService());
  });

  it('builds adjacency caches and reuses cached anatomy queries', async () => {
    expect(service.hasCache(ACTOR_ID)).toBe(false);
    expect(entityManager.jointLookupCount).toBe(0);

    await service.buildAdjacencyCache(ACTOR_ID);
    expect(service.hasCache(ACTOR_ID)).toBe(true);
    expect(entityManager.jointLookupCount).toBeGreaterThan(0);

    const lookupCountAfterFirstBuild = entityManager.jointLookupCount;
    await service.buildAdjacencyCache(ACTOR_ID);
    expect(entityManager.jointLookupCount).toBe(lookupCountAfterFirstBuild);

    const firstAllParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(firstAllParts).toEqual(
      expect.arrayContaining([TORSO_ID, ARM_ID, HAND_ID, LEG_ID, FOOT_ID])
    );

    const cachedAllParts = service.getAllParts(bodyComponent, ACTOR_ID);
    expect(cachedAllParts).toBe(firstAllParts);

    const blueprintOnlyParts = service.getAllParts({ root: TORSO_ID });
    expect(blueprintOnlyParts).toEqual(
      expect.arrayContaining([TORSO_ID, ARM_ID, HAND_ID, LEG_ID, FOOT_ID])
    );

    const firstHandLookup = service.findPartsByType(ACTOR_ID, 'hand');
    expect(firstHandLookup).toEqual([HAND_ID]);

    const cachedHandLookup = service.findPartsByType(ACTOR_ID, 'hand');
    expect(cachedHandLookup).toBe(firstHandLookup);

    const missingRootParts = service.getAllParts({ body: {} });
    expect(missingRootParts).toEqual([]);

    const noComponentParts = service.getAllParts(null);
    expect(noComponentParts).toEqual([]);
  });

  it('resolves anatomy relationships and graph navigation correctly', async () => {
    const rootBeforeCache = service.getAnatomyRoot(HAND_ID);
    expect(rootBeforeCache).toBe(ACTOR_ID);

    await service.buildAdjacencyCache(ACTOR_ID);

    const root = service.getAnatomyRoot(HAND_ID);
    expect(root).toBe(ACTOR_ID);

    expect(service.getParent(ARM_ID)).toBe(TORSO_ID);
    expect(service.getParent(ACTOR_ID)).toBeNull();

    expect(service.getChildren(TORSO_ID)).toEqual(
      expect.arrayContaining([ARM_ID, LEG_ID])
    );
    expect(service.getChildren('missing-node')).toEqual([]);

    const ancestors = service.getAncestors(HAND_ID);
    expect(ancestors).toEqual([ARM_ID, TORSO_ID, BLUEPRINT_ROOT_ID, ACTOR_ID]);
    expect(service.getAncestors(ACTOR_ID)).toEqual([]);

    const descendants = service.getAllDescendants(TORSO_ID);
    expect(descendants).toEqual(
      expect.arrayContaining([ARM_ID, HAND_ID, LEG_ID, FOOT_ID])
    );

    const path = service.getPath(HAND_ID, LEG_ID);
    expect(path).toEqual([HAND_ID, ARM_ID, TORSO_ID, LEG_ID]);

    expect(service.validateCache().valid).toBe(true);
  });

  it('detects component presence and nested component values across the body graph', async () => {
    await service.buildAdjacencyCache(ACTOR_ID);

    expect(
      service.hasPartWithComponent(bodyComponent, 'custom:sensation')
    ).toBe(true);
    expect(
      service.hasPartWithComponent(bodyComponent, 'component:missing')
    ).toBe(false);

    const gripResult = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:grip',
      'strength.rating',
      'firm'
    );
    expect(gripResult).toEqual({ found: true, partId: ARM_ID });

    const nonMatching = service.hasPartWithComponentValue(
      bodyComponent,
      'custom:grip',
      'strength.rating',
      'soft'
    );
    expect(nonMatching).toEqual({ found: false });
  });

  it('provides anatomy graph wrappers and guards invalid queries', async () => {
    await expect(service.getBodyGraph(null)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getBodyGraph('unknown')).rejects.toThrow(
      /has no anatomy:body component/
    );

    await service.buildAdjacencyCache(ACTOR_ID);

    const graph = await service.getBodyGraph(ACTOR_ID);
    const partIds = graph.getAllPartIds();
    expect(partIds).toEqual(
      expect.arrayContaining([TORSO_ID, ARM_ID, HAND_ID, LEG_ID, FOOT_ID])
    );

    expect(graph.getConnectedParts(ARM_ID)).toEqual([HAND_ID]);
    expect(graph.getConnectedParts('non-existent')).toEqual([]);
  });

  it('summarizes anatomy metadata and handles invalid identifiers', async () => {
    await expect(service.getAnatomyData(42)).rejects.toThrow(
      InvalidArgumentError
    );
    await expect(service.getAnatomyData('')).rejects.toThrow(
      InvalidArgumentError
    );

    const metadata = await service.getAnatomyData(ACTOR_ID);
    expect(metadata).toEqual({
      recipeId: 'anatomy.human.standard',
      rootEntityId: ACTOR_ID,
    });

    const armMetadata = await service.getAnatomyData(ARM_ID);
    expect(armMetadata).toBeNull();
  });

  it('detaches parts, invalidates caches, and emits limb detachment events', async () => {
    await service.buildAdjacencyCache(ACTOR_ID);

    const detachResult = await service.detachPart(ARM_ID, {
      cascade: true,
      reason: 'integration-test',
    });

    expect(detachResult.parentId).toBe(TORSO_ID);
    expect(detachResult.socketId).toBe('arm-left-socket');
    expect(detachResult.detached).toEqual(
      expect.arrayContaining([ARM_ID, HAND_ID])
    );

    expect(entityManager.getComponentData(ARM_ID, 'anatomy:joint')).toBeNull();
    expect(service.hasCache(ACTOR_ID)).toBe(false);

    expect(dispatcher.calls).toHaveLength(1);
    const [dispatchCall] = dispatcher.calls;
    expect(dispatchCall.eventId).toBe(LIMB_DETACHED_EVENT_ID);
    expect(dispatchCall.payload.detachedCount).toBe(
      detachResult.detached.length
    );
    expect(dispatchCall.payload.reason).toBe('integration-test');

    await expect(service.detachPart(ARM_ID)).rejects.toThrow(
      InvalidArgumentError
    );

    const { service: freshService, entityManager: freshManager } =
      createService();
    await freshService.buildAdjacencyCache(ACTOR_ID);
    const singleDetach = await freshService.detachPart(LEG_ID, {
      cascade: false,
    });
    expect(singleDetach.detached).toEqual([LEG_ID]);
    expect(freshManager.getComponentData(LEG_ID, 'anatomy:joint')).toBeNull();
  });

  it('validates constructor dependencies and reuses provided query cache', () => {
    expect(
      () => new BodyGraphService({ logger, eventDispatcher: dispatcher })
    ).toThrow(/entityManager is required/);
    expect(
      () => new BodyGraphService({ entityManager, eventDispatcher: dispatcher })
    ).toThrow(/logger is required/);
    expect(() => new BodyGraphService({ entityManager, logger })).toThrow(
      /eventDispatcher is required/
    );

    const customQueryCache = new AnatomyQueryCache({
      logger: new RecordingLogger(),
    });
    const { service: cachedService, bodyComponent: cachedBodyComponent } =
      createService({ queryCache: customQueryCache });

    return cachedService.buildAdjacencyCache(ACTOR_ID).then(() => {
      const parts = cachedService.getAllParts(cachedBodyComponent, ACTOR_ID);
      expect(customQueryCache.getCachedGetAllParts(ACTOR_ID)).toBe(parts);
    });
  });
});
