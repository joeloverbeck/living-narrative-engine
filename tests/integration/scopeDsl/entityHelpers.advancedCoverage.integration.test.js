import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  clearEntityCache,
  createEvaluationContext,
  preprocessActorForEvaluation,
  setupEntityCacheInvalidation,
  ENTITY_CACHE_SIZE_LIMIT,
} from '../../../src/scopeDsl/core/entityHelpers.js';
import { LogLevel } from '../../../src/logging/consoleLogger.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import {
  createMinimalTestContainer,
} from '../../common/scopeDsl/minimalTestContainer.js';

/**
 *
 */
function createTestEventBus() {
  const subscriptions = new Map();
  return {
    subscriptions,
    subscribe: (eventId, handler) => {
      if (!subscriptions.has(eventId)) {
        subscriptions.set(eventId, []);
      }
      subscriptions.get(eventId).push(handler);
    },
    emit(eventId, event) {
      const handlers = subscriptions.get(eventId) || [];
      handlers.forEach((handler) => handler(event));
    },
  };
}

describe('entityHelpers advanced integration coverage', () => {
  /** @type {import('../../../src/entities/entityManager.js').default} */
  let entityManager;
  /** @type {ReturnType<typeof createMinimalTestContainer>} */
  let containerHandle;
  /** @type {ReturnType<typeof createMinimalTestContainer>['services']} */
  let services;
  /** @type {import('../../../src/scopeDsl/engine.js').default} */
  let scopeEngine;
  let eventBus;

  beforeAll(async () => {
    containerHandle = await createMinimalTestContainer({
      logLevel: LogLevel.ERROR,
    });
    services = containerHandle.services;
    ({ entityManager, scopeEngine } = services);

    eventBus = createTestEventBus();
    setupEntityCacheInvalidation(eventBus);

    const actorDefinition = new EntityDefinition('test:actor', {
      components: {
        'core:name': { text: 'Test Actor' },
        'core:tags': { tags: ['actor', 'playable'] },
      },
    });

    const itemDefinition = new EntityDefinition('test:item', {
      components: {
        'core:tags': { tags: ['equipment'] },
        'inventory:stack': { quantity: 4 },
      },
    });

    const locationDefinition = new EntityDefinition('test:location', {
      components: {
        'world:location': { name: 'Test Location' },
      },
    });

    services.dataRegistry.store('entityDefinitions', 'test:actor', actorDefinition);
    services.dataRegistry.store('entityDefinitions', 'test:item', itemDefinition);
    services.dataRegistry.store('entityDefinitions', 'test:location', locationDefinition);
  });

  afterAll(async () => {
    if (containerHandle?.cleanup) {
      await containerHandle.cleanup();
    }
  });

  beforeEach(() => {
    clearEntityCache();
  });

  /**
   *
   * @param overrides
   */
  function createRuntimeContext(overrides = {}) {
    return {
      entityManager,
      jsonLogicEval: services.jsonLogicEval,
      container: overrides.container ?? { resolve: () => null },
      location: overrides.location ?? { id: 'test:location-instance' },
      componentRegistry: overrides.componentRegistry ?? null,
      target: overrides.target,
      targets: overrides.targets,
      logger: overrides.logger ?? services.logger ?? null,
      scopeEntityLookupDebug: overrides.scopeEntityLookupDebug,
    };
  }

  /**
   *
   */
  async function createActorItemAndLocation() {
    const location = await entityManager.createEntityInstance('test:location');
    const actor = await entityManager.createEntityInstance('test:actor');
    const item = await entityManager.createEntityInstance('test:item');

    return { actor, item, location };
  }

  /**
   *
   * @param location
   */
  function createLocationProvider(location) {
    return { getLocation: () => location };
  }

  it('normalizes inventory references with trimmed ids and retains metadata', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const inventoryReference = { itemId: '   test:item   ', quantity: 3, detail: 'stacked' };

    const context = createEvaluationContext(
      inventoryReference,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.id).toBe('test:item');
    expect(context.entity.id).toBe('test:item');
    expect(context.quantity).toBe(3);
    expect(context.detail).toBe('stacked');
  });

  it('records cache statistics through trace logging after high volume cache hits', async () => {
    const { actor, item, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);
    const trace = { addLog: jest.fn() };

    // First call populates the cache
    createEvaluationContext(item.id, actor, gateway, locationProvider, trace, runtimeCtx);

    for (let i = 0; i < 1000; i += 1) {
      createEvaluationContext(
        item.id,
        actor,
        gateway,
        locationProvider,
        trace,
        runtimeCtx
      );
    }

    expect(trace.addLog).toHaveBeenCalled();
    const lastCall = trace.addLog.mock.calls.at(-1);
    expect(lastCall?.[1]).toMatch(/Cache stats:/);
  });

  it('falls back to basic entity objects when gateway lookups fail', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const getEntitySpy = jest.spyOn(entityManager, 'getEntityInstance');
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const context = createEvaluationContext(
      'test:unknown-item',
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(getEntitySpy).toHaveBeenCalledWith('test:unknown-item');
    expect(context.entity).toEqual({ id: 'test:unknown-item' });

    getEntitySpy.mockRestore();
  });

  it('evicts the least recently used cache entries once the capacity threshold is exceeded', async () => {
    const { actor, item, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const getEntitySpy = jest.spyOn(entityManager, 'getEntityInstance');
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    createEvaluationContext(item.id, actor, gateway, locationProvider, null, runtimeCtx);

    getEntitySpy.mockClear();

    for (let i = 0; i < 10000; i += 1) {
      createEvaluationContext(
        `evict-test-${i}`,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtx
      );
    }

    createEvaluationContext(item.id, actor, gateway, locationProvider, null, runtimeCtx);
    expect(getEntitySpy).toHaveBeenCalled();

    getEntitySpy.mockRestore();
  });

  it('resolves objects with identifiers via registry component lookups and caches them', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const componentRegistry = {
      getDefinition: jest
        .fn()
        .mockImplementation((key) =>
          key === 'item:virtual-object'
            ? { components: { 'core:tags': { tags: ['virtual'] } } }
            : null
        ),
    };
    const runtimeCtx = createRuntimeContext({ location, componentRegistry });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const itemObject = { id: 'virtual-object', metadata: 'embedded' };

    const firstContext = createEvaluationContext(
      itemObject,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(componentRegistry.getDefinition).toHaveBeenCalledWith('item:virtual-object');
    expect(firstContext.entity.components['core:tags'].tags).toContain('virtual');

    componentRegistry.getDefinition.mockClear();

    const secondContext = createEvaluationContext(
      itemObject,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(componentRegistry.getDefinition).not.toHaveBeenCalled();
    expect(secondContext.entity).toBe(firstContext.entity);
  });

  it('resolves object references by fetching existing entities through the gateway', async () => {
    const { actor, item, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const itemReference = { id: item.id, note: 'reuse existing entity' };

    const context = createEvaluationContext(
      itemReference,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.entity.id).toBe(item.id);
    expect(context.entity.components['inventory:stack'].quantity).toBe(4);
  });

  it('keeps plain objects without identifiers intact for backwards compatibility', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const looseObject = { displayName: 'Floating Item', quantity: 2 };

    const context = createEvaluationContext(
      looseObject,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.entity).toBe(looseObject);
  });

  it('returns null for unsupported item types while preserving actor safety checks', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const context = createEvaluationContext(
      false,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context).toBeNull();
  });

  it('converts map-based entities with plain prototypes into plain component objects', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const mapEntity = {
      id: 'map-entity',
      components: new Map([
        ['core:tags', { tags: ['map-based'] }],
        ['inventory:stack', { quantity: 1 }],
      ]),
    };

    const context = createEvaluationContext(
      mapEntity,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.entity).not.toBe(mapEntity);
    expect(context.entity.components['core:tags'].tags).toContain('map-based');
    expect(context.entity.components['inventory:stack'].quantity).toBe(1);
  });

  it('preserves custom prototypes when hydrating map-based entities', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    class LegacyMapEntity {
      constructor() {
        this.id = 'legacy-map';
        this.components = new Map([
          ['core:tags', { tags: ['legacy'] }],
        ]);
      }

      legacyMethod() {
        return 'legacy-behaviour';
      }
    }

    const entity = new LegacyMapEntity();

    const context = createEvaluationContext(
      entity,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.entity.legacyMethod()).toBe('legacy-behaviour');
    expect(context.entity.components['core:tags'].tags).toContain('legacy');
  });

  it('hydrates componentTypeId driven entities while preserving plain object prototypes', async () => {
    const { actor, item, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const proxyEntity = {
      id: `proxy-${item.id}`,
      componentTypeIds: [...item.componentTypeIds],
      getComponentData: item.getComponentData.bind(item),
    };

    const context = createEvaluationContext(
      proxyEntity,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.entity.components['inventory:stack'].quantity).toBe(4);
    expect(context.entity.id).toBe(`proxy-${item.id}`);
  });

  it('preprocesses actors with map components using plain objects without altering prototypes unnecessarily', () => {
    const gateway = scopeEngine._createEntitiesGateway(createRuntimeContext());

    const actor = {
      id: 'map-actor',
      components: new Map([
        ['core:name', { text: 'Map Actor' }],
      ]),
    };

    const processed = preprocessActorForEvaluation(actor, gateway);

    expect(processed).not.toBe(actor);
    expect(processed.components['core:name'].text).toBe('Map Actor');
  });

  it('ensures actors passed to evaluation contexts are converted when carrying map components', async () => {
    const { location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const actor = {
      id: 'map-context-actor',
      components: new Map([
        ['core:name', { text: 'Context Actor' }],
      ]),
    };

    const context = createEvaluationContext(
      'test:item',
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.actor.components['core:name'].text).toBe('Context Actor');
    expect(context.actor).not.toBe(actor);
  });

  it('returns actors unchanged when components are already plain objects', () => {
    const gateway = scopeEngine._createEntitiesGateway(createRuntimeContext());

    const actor = {
      id: 'plain-actor',
      components: {
        'core:name': { text: 'Plain Actor' },
      },
    };

    const processed = preprocessActorForEvaluation(actor, gateway);

    expect(processed).toBe(actor);
  });

  it('throws when preprocessActorForEvaluation receives an invalid actor', () => {
    const gateway = scopeEngine._createEntitiesGateway(createRuntimeContext());

    expect(() => preprocessActorForEvaluation(null, gateway)).toThrow(
      'preprocessActorForEvaluation: Invalid actor entity'
    );
  });

  it('builds component objects from componentTypeIds for plain actor prototypes', async () => {
    const base = await entityManager.createEntityInstance('test:item');
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);

    const actor = {
      id: base.id,
      componentTypeIds: [...base.componentTypeIds],
      getComponentData: base.getComponentData.bind(base),
    };

    const processed = preprocessActorForEvaluation(actor, gateway);

    expect(processed).not.toBe(actor);
    expect(processed.components['inventory:stack'].quantity).toBe(4);
  });

  it('returns the original actor when no component metadata is available', () => {
    const gateway = scopeEngine._createEntitiesGateway(createRuntimeContext());

    const actor = { id: 'bare-actor' };

    const processed = preprocessActorForEvaluation(actor, gateway);

    expect(processed).toBe(actor);
  });

  it('evicts cached entries for object references when threshold is exceeded', async () => {
    const { actor, item, location } = await createActorItemAndLocation();
    const runtimeCtx = createRuntimeContext({ location });
    const getEntitySpy = jest.spyOn(entityManager, 'getEntityInstance');
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    const reference = { id: item.id };

    createEvaluationContext(
      reference,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    getEntitySpy.mockClear();

    for (let i = 0; i < 10000; i += 1) {
      createEvaluationContext(
        { id: `object-evict-${i}` },
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtx
      );
    }

    createEvaluationContext(
      reference,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(getEntitySpy).toHaveBeenCalled();
    getEntitySpy.mockRestore();
  });

  it('emits cacheEvents for hits, misses, and evictions when lookup debugging is enabled', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const cacheEvents = jest.fn();
    const resolveSpy = jest.fn((entityId, manager) => manager?.getEntityInstance(entityId));
    const logger = {
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const runtimeCtx = createRuntimeContext({
      location,
      logger,
      scopeEntityLookupDebug: {
        enabled: true,
        cacheEvents,
        strategyFactory: ({ entityManager: manager }) => ({
          resolve: (entityId) => resolveSpy(entityId, manager),
          describeOrder: () => ['custom-strategy'],
        }),
      },
    });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    createEvaluationContext('missing:0', actor, gateway, locationProvider, null, runtimeCtx);
    createEvaluationContext('missing:0', actor, gateway, locationProvider, null, runtimeCtx);

    for (let i = 1; i <= ENTITY_CACHE_SIZE_LIMIT + 5; i += 1) {
      createEvaluationContext(
        `missing:${i}`,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtx
      );
    }

    expect(resolveSpy).toHaveBeenCalled();
    const eventTypes = cacheEvents.mock.calls.map(([event]) => event.type);
    expect(eventTypes).toContain('miss');
    expect(eventTypes).toContain('hit');
    expect(eventTypes).toContain('evict');
  });

  it('warns once per entity when falling back to synthetic objects under debug mode', async () => {
    const { actor, location } = await createActorItemAndLocation();
    const logger = {
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const runtimeCtx = createRuntimeContext({
      location,
      logger,
      scopeEntityLookupDebug: { enabled: true },
    });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = createLocationProvider(runtimeCtx.location);

    createEvaluationContext('synthetic-warning', actor, gateway, locationProvider, null, runtimeCtx);
    createEvaluationContext('synthetic-warning', actor, gateway, locationProvider, null, runtimeCtx);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/synthetic entity/i);
  });
});
