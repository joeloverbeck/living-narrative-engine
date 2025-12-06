import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as entityHelpers from '../../../src/scopeDsl/core/entityHelpers.js';

const {
  clearEntityCache,
  createEvaluationContext,
  getOrBuildComponents,
  preprocessActorForEvaluation,
  setupEntityCacheInvalidation,
  invalidateEntityCache,
} = entityHelpers;
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../../src/constants/eventIds.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import { LogLevel } from '../../../src/logging/consoleLogger.js';
import { createMinimalTestContainer } from '../../common/scopeDsl/minimalTestContainer.js';

/**
 * @file Integration tests for entityHelpers.js exercising cache invalidation
 * and evaluation context construction using real entity manager infrastructure.
 */
function createTestEventBus() {
  const subscriptions = new Map();
  return {
    subscriptions,
    subscribe: jest.fn((eventId, handler) => {
      if (!subscriptions.has(eventId)) {
        subscriptions.set(eventId, []);
      }
      subscriptions.get(eventId).push(handler);
    }),
    emit(eventId, event) {
      const handlers = subscriptions.get(eventId) || [];
      handlers.forEach((handler) => handler(event));
    },
  };
}

describe('entityHelpers integration coverage', () => {
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
    ({ entityManager } = services);
    scopeEngine = services.scopeEngine;
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

    services.dataRegistry.store(
      'entityDefinitions',
      'test:actor',
      actorDefinition
    );
    services.dataRegistry.store(
      'entityDefinitions',
      'test:item',
      itemDefinition
    );
    services.dataRegistry.store(
      'entityDefinitions',
      'test:location',
      locationDefinition
    );
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
      componentRegistry: overrides.componentRegistry,
      target: overrides.target,
      targets: overrides.targets,
    };
  }

  /**
   *
   */
  async function createActorAndItem() {
    const location = await entityManager.createEntityInstance('test:location');
    const actor = await entityManager.createEntityInstance('test:actor');
    const item = await entityManager.createEntityInstance('test:item');

    return { actor, item, location };
  }

  it('caches entity lookups and supports cache invalidation', async () => {
    const { actor, item } = await createActorAndItem();

    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = { getLocation: () => runtimeCtx.location };

    const getEntitySpy = jest.spyOn(entityManager, 'getEntityInstance');

    let context = createEvaluationContext(
      item.id,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );
    expect(context.entity.id).toBe(item.id);
    expect(getEntitySpy).toHaveBeenCalledTimes(1);

    context = createEvaluationContext(
      item.id,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );
    expect(context.entity.id).toBe(item.id);
    expect(getEntitySpy).toHaveBeenCalledTimes(1);

    getEntitySpy.mockClear();
    invalidateEntityCache(item.id);
    createEvaluationContext(
      item.id,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );
    expect(getEntitySpy).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache entries when relevant event bus signals fire', async () => {
    const { actor, item } = await createActorAndItem();
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = { getLocation: () => runtimeCtx.location };

    const getEntitySpy = jest.spyOn(entityManager, 'getEntityInstance');

    const expectInvalidation = (emitEvent) => {
      clearEntityCache();
      createEvaluationContext(
        item.id,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtx
      );
      getEntitySpy.mockClear();

      // Verify cache hit prevents additional fetches before invalidation
      createEvaluationContext(
        item.id,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtx
      );
      expect(getEntitySpy).not.toHaveBeenCalled();

      emitEvent();

      createEvaluationContext(
        item.id,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeCtx
      );
      expect(getEntitySpy).toHaveBeenCalledTimes(1);
      getEntitySpy.mockClear();
    };

    expectInvalidation(() =>
      eventBus.emit(COMPONENTS_BATCH_ADDED_ID, {
        payload: { updates: [{ instanceId: item.id }] },
      })
    );

    expectInvalidation(() =>
      eventBus.emit(COMPONENT_ADDED_ID, {
        payload: { entity: { id: item.id } },
      })
    );

    expectInvalidation(() =>
      eventBus.emit(COMPONENT_REMOVED_ID, {
        payload: { entity: { id: item.id } },
      })
    );

    getEntitySpy.mockRestore();
  });

  it('ignores subsequent cache-invalidation setup calls once configured', () => {
    const alternateBus = { subscribe: jest.fn() };

    setupEntityCacheInvalidation(alternateBus);

    expect(alternateBus.subscribe).not.toHaveBeenCalled();
    expect(eventBus.subscriptions.size).toBe(3);
    for (const [eventId, handlers] of eventBus.subscriptions) {
      expect(Array.isArray(handlers)).toBe(true);
      expect(handlers.length).toBeGreaterThan(0);
      expect(typeof handlers[0]).toBe('function');
      expect([
        COMPONENTS_BATCH_ADDED_ID,
        COMPONENT_ADDED_ID,
        COMPONENT_REMOVED_ID,
      ]).toContain(eventId);
    }
  });

  it('builds fallback contexts from registry definitions and exposes runtime targets', async () => {
    const { actor } = await createActorAndItem();
    const runtimeCtx = createRuntimeContext({
      componentRegistry: {
        getDefinition: (key) =>
          key === 'item:test:virtual-component'
            ? { components: { 'core:tags': { tags: ['virtual'] } } }
            : null,
      },
      target: { id: 'target-1' },
      targets: { primary: [{ id: 'primary-target' }] },
    });
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = { getLocation: () => runtimeCtx.location };

    const context = createEvaluationContext(
      'test:virtual-component',
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.components['core:tags'].tags).toContain('virtual');
    expect(context.target.id).toBe('target-1');
    expect(context.targets.primary[0].id).toBe('primary-target');
  });

  it('exposes plain object properties when evaluating ad-hoc items', async () => {
    const { actor } = await createActorAndItem();
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = { getLocation: () => runtimeCtx.location };

    const looseItem = { id: 'loose-item', quantity: 7, rarity: 'uncommon' };
    const context = createEvaluationContext(
      looseItem,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.id).toBe('loose-item');
    expect(context.quantity).toBe(7);
    expect(context.rarity).toBe('uncommon');
  });

  it('preprocesses actors with map components while preserving custom prototypes', () => {
    const gateway = scopeEngine._createEntitiesGateway(createRuntimeContext());

    class LegacyEntity {
      constructor(base) {
        this.id = base.id;
        this.componentTypeIds = base.componentTypeIds;
        this.components = new Map(Object.entries(base.components));
        this.getAllComponents = () => ({ ...base.components });
      }

      legacyMethod() {
        return 'legacy-behaviour';
      }
    }

    const rawActor = {
      id: 'legacy-actor',
      componentTypeIds: ['core:name'],
      components: { 'core:name': { text: 'Legacy' } },
    };

    const processed = preprocessActorForEvaluation(
      new LegacyEntity(rawActor),
      gateway
    );

    expect(processed.components['core:name'].text).toBe('Legacy');
    expect(typeof processed.legacyMethod).toBe('function');
  });

  it('preprocesses actors using getAllComponents while retaining prototype getters', () => {
    const gateway = scopeEngine._createEntitiesGateway(createRuntimeContext());

    class GetAllActor {
      constructor(id) {
        this.id = id;
        this.componentTypeIds = ['core:name'];
      }

      getAllComponents() {
        return { 'core:name': { text: 'Get All Actor' } };
      }

      get codename() {
        return `codename:${this.id}`;
      }
    }

    const actor = new GetAllActor('actor-with-getall');

    const processed = preprocessActorForEvaluation(actor, gateway);

    expect(processed.components['core:name'].text).toBe('Get All Actor');
    expect(processed.codename).toBe('codename:actor-with-getall');
  });

  it('builds component objects using gateway fallbacks', async () => {
    const { item } = await createActorAndItem();
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);

    const rebuilt = getOrBuildComponents(item.id, null, gateway);
    expect(rebuilt['inventory:stack'].quantity).toBe(4);

    const minimalResult = getOrBuildComponents(
      'unknown',
      { id: 'ghost' },
      gateway
    );
    expect(minimalResult).toEqual({});
  });

  it('hydrates entity objects using getAllComponents while preserving getters', async () => {
    const { actor } = await createActorAndItem();
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = { getLocation: () => runtimeCtx.location };

    class AllComponentsEntity {
      constructor(id) {
        this.id = id;
        this.componentTypeIds = ['core:name'];
      }

      getAllComponents() {
        return { 'core:name': { text: 'All Components' } };
      }

      get label() {
        return `label:${this.id}`;
      }
    }

    const entity = new AllComponentsEntity('all-components-entity');

    const context = createEvaluationContext(
      entity,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.entity.components['core:name'].text).toBe('All Components');
    expect(context.entity.label).toBe('label:all-components-entity');
  });

  it('hydrates entities with componentTypeIds via buildComponents while keeping getters', async () => {
    const { actor } = await createActorAndItem();
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = { getLocation: () => runtimeCtx.location };

    const fullEntity = await entityManager.createEntityInstance('test:item');

    class ComponentTypeEntity {
      constructor(base) {
        this.id = `component-type:${base.id}`;
        this.componentTypeIds = Array.isArray(base.componentTypeIds)
          ? [...base.componentTypeIds]
          : Object.keys(base.components || {});
      }

      getComponentData(componentId) {
        return fullEntity.getComponentData(componentId);
      }

      get summary() {
        return `${this.id}:${this.componentTypeIds.length}`;
      }
    }

    const entity = new ComponentTypeEntity(fullEntity);

    const context = createEvaluationContext(
      entity,
      actor,
      gateway,
      locationProvider,
      null,
      runtimeCtx
    );

    expect(context.entity.components['inventory:stack'].quantity).toBe(4);
    expect(context.entity.summary).toBe(
      `component-type:${fullEntity.id}:${entity.componentTypeIds.length}`
    );
  });

  it('returns null when components cannot be resolved for unknown entities', () => {
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);

    const result = getOrBuildComponents('missing-entity', null, gateway);

    expect(result).toBeNull();
  });

  it('throws descriptive errors when actor context is invalid', () => {
    const runtimeCtx = createRuntimeContext();
    const gateway = scopeEngine._createEntitiesGateway(runtimeCtx);
    const locationProvider = { getLocation: () => runtimeCtx.location };

    expect(() =>
      createEvaluationContext(
        'any-item',
        null,
        gateway,
        locationProvider,
        null,
        runtimeCtx
      )
    ).toThrow(/actorEntity is undefined/);

    expect(() =>
      createEvaluationContext(
        'any-item',
        { id: undefined },
        gateway,
        locationProvider,
        null,
        runtimeCtx
      )
    ).toThrow(/actorEntity has invalid ID/);
  });
});
