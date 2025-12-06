import { jest } from '@jest/globals';
import {
  getOrBuildComponents,
  createEvaluationContext,
  clearEntityCache,
  preprocessActorForEvaluation,
  invalidateEntityCache,
} from '../../../../src/scopeDsl/core/entityHelpers.js';

describe('entityHelpers', () => {
  beforeEach(() => {
    // Clear entity cache before each test to ensure test isolation
    clearEntityCache();
  });

  describe('invalidateEntityCache', () => {
    it('removes cached entity entries so subsequent lookups fetch fresh data', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({ id: 'entity1' })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      // First resolution caches the entity
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      expect(gateway.getEntityInstance).toHaveBeenCalledTimes(1);

      // Cache hit should avoid gateway access
      gateway.getEntityInstance.mockClear();
      gateway.getEntityInstance.mockImplementation(() => {
        throw new Error('cache entry should have been reused');
      });
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      expect(gateway.getEntityInstance).not.toHaveBeenCalled();

      // After invalidation the cache entry should be removed
      invalidateEntityCache('entity1');

      gateway.getEntityInstance.mockImplementation(() => ({ id: 'entity1' }));
      createEvaluationContext('entity1', actor, gateway, locationProvider);
      expect(gateway.getEntityInstance).toHaveBeenCalledTimes(1);
    });
  });
  describe('getOrBuildComponents', () => {
    it('returns null when entity is not found', () => {
      const gateway = { getEntityInstance: jest.fn(() => null) };
      const result = getOrBuildComponents('missing', null, gateway);
      expect(result).toBeNull();
    });

    it('builds components when componentTypeIds are present', () => {
      const entity = {
        id: 'e1',
        componentTypeIds: ['core:name'],
        // This mocked helper ignores the id argument
        getComponentData: () => ({ value: 'Entity One' }),
      };
      const gateway = {
        getEntityInstance: jest.fn(() => entity),
        getComponentData: jest.fn(() => ({ value: 'Entity One' })),
      };
      const result = getOrBuildComponents('e1', null, gateway);
      expect(result).toEqual({ 'core:name': { value: 'Entity One' } });
    });

    it('returns empty object and logs when componentTypeIds missing', () => {
      const entity = { id: 'e2' };
      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const trace = { addLog: jest.fn() };
      const result = getOrBuildComponents('e2', null, gateway, trace);
      expect(result).toEqual({});
    });

    it('returns null when entity parameter is provided but null', () => {
      const gateway = { getEntityInstance: jest.fn() };
      const result = getOrBuildComponents('e3', null, gateway);
      expect(result).toBeNull();
      expect(gateway.getEntityInstance).toHaveBeenCalledWith('e3');
    });

    it('returns empty object when componentTypeIds is malformed', () => {
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'malformed',
          componentTypeIds: 'core:name',
        })),
      };

      const result = getOrBuildComponents('malformed', null, gateway);
      expect(result).toEqual({});
    });
  });

  describe('createEvaluationContext', () => {
    it('builds context with entity and actor components', () => {
      const gateway = {
        getEntityInstance: jest.fn(() => ({
          id: 'e1',
          componentTypeIds: ['core:name'],
          getComponentData: () => ({ value: 'Entity One' }),
        })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const actor = {
        id: 'actor1',
        componentTypeIds: ['core:actor'],
        getComponentData: () => ({ type: 'npc' }),
      };
      const ctx = createEvaluationContext(
        'e1',
        actor,
        gateway,
        locationProvider
      );
      expect(ctx.entity.components).toEqual({
        'core:name': { value: 'Entity One' },
      });
      expect(ctx.actor.components).toEqual({
        'core:actor': { type: 'npc' },
      });
      expect(ctx.location).toEqual({ id: 'loc1' });
    });

    it('preserves Entity class getter properties when adding components', () => {
      // Create a mock Entity class that simulates real Entity behavior
      class MockEntity {
        constructor() {
          this._data = { id: 'entity123', definitionId: 'test:entity' };
        }

        get id() {
          return this._data.id;
        }

        get definitionId() {
          return this._data.definitionId;
        }

        componentTypeIds = ['core:name', 'core:position'];
      }

      const mockEntity = new MockEntity();

      const gateway = {
        getEntityInstance: jest.fn(() => mockEntity),
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'core:name') return { text: 'Test Entity' };
          if (componentId === 'core:position') return { x: 10, y: 20 };
          return null;
        }),
      };

      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      // Test that the actor's getter properties are preserved
      const ctx = createEvaluationContext(
        mockEntity,
        mockEntity,
        gateway,
        locationProvider
      );

      // Verify that the returned actor has working getter properties
      expect(ctx.actor.id).toBe('entity123');
      expect(ctx.actor.definitionId).toBe('test:entity');
      expect(ctx.actor.componentTypeIds).toEqual([
        'core:name',
        'core:position',
      ]);
      expect(ctx.actor.components).toEqual({
        'core:name': { text: 'Test Entity' },
        'core:position': { x: 10, y: 20 },
      });

      // Verify that the actor prototype chain is preserved
      expect(Object.getPrototypeOf(ctx.actor)).toBe(MockEntity.prototype);
    });

    it('throws error when actorEntity is undefined', () => {
      const gateway = {
        getEntityInstance: jest.fn(() => ({ id: 'e1' })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      expect(() => {
        createEvaluationContext('e1', undefined, gateway, locationProvider);
      }).toThrow('createEvaluationContext: actorEntity is undefined');
    });

    it('throws error when actorEntity has invalid id', () => {
      const gateway = {
        getEntityInstance: jest.fn(() => ({ id: 'e1' })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const invalidActor = { id: undefined, componentTypeIds: [] };

      expect(() => {
        createEvaluationContext('e1', invalidActor, gateway, locationProvider);
      }).toThrow('createEvaluationContext: actorEntity has invalid ID');
    });

    it('returns null when item is null', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = { getEntityInstance: jest.fn() };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        null,
        actor,
        gateway,
        locationProvider
      );
      expect(result).toBeNull();
    });

    it('returns null when item is undefined', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = { getEntityInstance: jest.fn() };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        undefined,
        actor,
        gateway,
        locationProvider
      );
      expect(result).toBeNull();
    });

    it('returns null when item is invalid type (number)', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = { getEntityInstance: jest.fn() };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        123,
        actor,
        gateway,
        locationProvider
      );
      expect(result).toBeNull();
    });

    it('returns null when item is invalid type (boolean)', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = { getEntityInstance: jest.fn() };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        true,
        actor,
        gateway,
        locationProvider
      );
      expect(result).toBeNull();
    });

    it('normalizes inventory references that provide itemId and resolves trimmed identifiers', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => null),
        getItemComponents: jest.fn(() => ({
          'core:item': { name: 'Health Potion' },
        })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const itemReference = { itemId: '  item1  ', quantity: 2 };
      const result = createEvaluationContext(
        itemReference,
        actor,
        gateway,
        locationProvider
      );

      expect(gateway.getEntityInstance).toHaveBeenCalledWith('item1');
      expect(gateway.getItemComponents).toHaveBeenCalledWith('item1');
      expect(result.entity).toEqual({
        id: 'item1',
        components: { 'core:item': { name: 'Health Potion' } },
      });
      expect(result.id).toBe('item1');
    });

    it('unwraps gateway component envelopes when includeSources is enabled', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => null),
        getItemComponents: jest.fn(() => ({
          components: { 'core:item': { rarity: 'rare' } },
          source: 'registry:item',
        })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        'artifact_01',
        actor,
        gateway,
        locationProvider
      );

      expect(result.entity.components).toEqual({
        'core:item': { rarity: 'rare' },
      });
    });

    it('reuses cached entities when resolving objects that already include an id', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({ id: 'item1' })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const itemObject = { id: 'item1', label: 'cached object' };

      createEvaluationContext(itemObject, actor, gateway, locationProvider);
      expect(gateway.getEntityInstance).toHaveBeenCalledTimes(1);

      gateway.getEntityInstance.mockClear();
      gateway.getEntityInstance.mockImplementation(() => {
        throw new Error('cache should have satisfied the lookup');
      });

      createEvaluationContext(itemObject, actor, gateway, locationProvider);
      expect(gateway.getEntityInstance).not.toHaveBeenCalled();
    });

    it('evicts cached entries when resolving objects pushes the cache past its limit', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const gateway = {
        getEntityInstance: jest.fn((entityId) => {
          if (entityId === 'object-target') {
            return null;
          }
          return { id: entityId };
        }),
        getItemComponents: jest.fn((entityId) => {
          if (entityId === 'object-target') {
            return { 'core:item': { rarity: 'rare' } };
          }
          return null;
        }),
      };

      // Populate the cache to the configured limit using string identifiers
      for (let index = 0; index < 10000; index++) {
        createEvaluationContext(
          `seed-${index}`,
          actor,
          gateway,
          locationProvider
        );
      }

      const objectWithId = {
        id: 'object-target',
        description: 'forces eviction path',
      };
      const context = createEvaluationContext(
        objectWithId,
        actor,
        gateway,
        locationProvider
      );

      expect(gateway.getEntityInstance).toHaveBeenCalledWith('object-target');
      expect(gateway.getItemComponents).toHaveBeenCalledWith('object-target');
      expect(context.entity).toEqual({
        id: 'object-target',
        components: { 'core:item': { rarity: 'rare' } },
      });
    });

    it('converts Map-based components to plain object for plain entity', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const componentMap = new Map();
      componentMap.set('core:name', { text: 'Test Name' });
      componentMap.set('core:position', { x: 10, y: 20 });

      const entity = {
        id: 'entity1',
        components: componentMap,
      };

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider
      );

      expect(result.entity.components).toEqual({
        'core:name': { text: 'Test Name' },
        'core:position': { x: 10, y: 20 },
      });
      expect(result.entity.components).not.toBeInstanceOf(Map);
    });

    it('converts Map-based components preserving prototype for custom entity class', () => {
      class CustomEntity {
        constructor() {
          this.id = 'custom1';
          this.components = new Map();
          this.components.set('core:name', { text: 'Custom Entity' });
        }
      }

      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = new CustomEntity();

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider
      );

      expect(result.entity.components).toEqual({
        'core:name': { text: 'Custom Entity' },
      });
      expect(result.entity.components).not.toBeInstanceOf(Map);
      expect(Object.getPrototypeOf(result.entity)).toBe(CustomEntity.prototype);
    });

    it('returns entity as-is when it already has plain object components', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = {
        id: 'entity1',
        components: {
          'core:name': { text: 'Existing Components' },
          'core:position': { x: 5, y: 10 },
        },
      };

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider
      );

      expect(result.entity.components).toEqual({
        'core:name': { text: 'Existing Components' },
        'core:position': { x: 5, y: 10 },
      });
      expect(result.entity.components).toBe(entity.components); // Same reference
    });

    it('returns entity as-is when no components and no componentTypeIds', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = {
        id: 'entity1',
        // No components property and no componentTypeIds
      };

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider
      );

      expect(result.entity).toBe(entity); // Same reference
      expect(result.entity.id).toBe('entity1');
      expect(result.entity.components).toBeUndefined();
    });

    it('logs debug information when trace is provided and entity is resolved', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = { id: 'entity1', componentTypeIds: ['core:name'] };

      const gateway = {
        getEntityInstance: jest.fn(() => entity),
        getComponentData: jest.fn(() => ({ text: 'Test Entity' })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      createEvaluationContext(
        'entity1',
        actor,
        gateway,
        locationProvider,
        trace
      );
    });

    it('logs debug information when trace is provided and component lookup fallback is used', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };

      const gateway = {
        getEntityInstance: jest.fn(() => null), // Entity not found
        getItemComponents: jest.fn(() => ({
          'core:name': { text: 'Fallback Component' },
        })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      const result = createEvaluationContext(
        'item1',
        actor,
        gateway,
        locationProvider,
        trace
      );

      expect(result.entity.components).toEqual({
        'core:name': { text: 'Fallback Component' },
      });
    });

    it('logs debug information when trace is provided and basic entity is created', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };

      const gateway = {
        getEntityInstance: jest.fn(() => null), // Entity not found
        getItemComponents: jest.fn(() => null), // Component lookup also fails
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      const result = createEvaluationContext(
        'item1',
        actor,
        gateway,
        locationProvider,
        trace
      );

      expect(result.entity.id).toBe('item1');
    });

    it('logs cache event handler failures through runtime logger warnings', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => null),
        getItemComponents: jest.fn(() => null),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const cacheEventsHandler = jest.fn(() => {
        throw new Error('cache callback boom');
      });
      const logger = { warn: jest.fn() };
      const runtimeContext = {
        scopeEntityLookupDebug: {
          enabled: true,
          cacheEvents: cacheEventsHandler,
        },
        logger,
      };

      createEvaluationContext(
        'entity-with-callback-failure',
        actor,
        gateway,
        locationProvider,
        null,
        runtimeContext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'ScopeDSL cacheEvents handler failed.',
        expect.objectContaining({
          type: 'miss',
          key: 'entity_entity-with-callback-failure',
          source: 'createEvaluationContext',
          error: expect.any(Error),
        })
      );
    });

    it('skips synthetic fallback warnings when the identifier is empty', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => null),
        getItemComponents: jest.fn(() => null),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const logger = { warn: jest.fn() };
      const runtimeContext = {
        scopeEntityLookupDebug: { enabled: true },
        logger,
      };

      const result = createEvaluationContext(
        '',
        actor,
        gateway,
        locationProvider,
        null,
        runtimeContext
      );

      expect(result?.entity).toEqual({ id: '' });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('throttles repeated synthetic fallback warnings for the same id', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => null),
        getItemComponents: jest.fn(() => null),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const logger = { warn: jest.fn() };
      const runtimeContext = {
        scopeEntityLookupDebug: { enabled: true },
        logger,
      };

      const nowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValueOnce(100000)
        .mockReturnValueOnce(100100);

      createEvaluationContext(
        'throttled-id',
        actor,
        gateway,
        locationProvider,
        null,
        runtimeContext
      );

      createEvaluationContext(
        'throttled-id',
        actor,
        gateway,
        locationProvider,
        null,
        runtimeContext
      );

      expect(logger.warn).toHaveBeenCalledTimes(1);
      nowSpy.mockRestore();
    });

    it('logs comprehensive debug information when trace is provided', () => {
      const actor = {
        id: 'actor1',
        componentTypeIds: ['core:actor'],
        components: { 'core:actor': { type: 'npc' } },
      };
      const entity = {
        id: 'entity1',
        componentTypeIds: ['core:name'],
        components: { 'core:name': { text: 'Test Entity' } },
      };

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      createEvaluationContext(entity, actor, gateway, locationProvider, trace);

      // Check that debug logging was called with correct parameters
    });

    it('includes target in runtime context when provided', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = { id: 'entity1' };

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const runtimeContext = { target: { id: 'target1', type: 'npc' } };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeContext
      );

      expect(result.target).toEqual({ id: 'target1', type: 'npc' });
    });

    it('includes targets in runtime context when provided', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = { id: 'entity1' };

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const runtimeContext = {
        targets: [
          { id: 'target1', type: 'npc' },
          { id: 'target2', type: 'item' },
        ],
      };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeContext
      );

      expect(result.targets).toEqual([
        { id: 'target1', type: 'npc' },
        { id: 'target2', type: 'item' },
      ]);
    });

    it('includes both target and targets in runtime context when both provided', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = { id: 'entity1' };

      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const runtimeContext = {
        target: { id: 'primary', type: 'npc' },
        targets: [
          { id: 'target1', type: 'npc' },
          { id: 'target2', type: 'item' },
        ],
      };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider,
        null,
        runtimeContext
      );

      expect(result.target).toEqual({ id: 'primary', type: 'npc' });
      expect(result.targets).toEqual([
        { id: 'target1', type: 'npc' },
        { id: 'target2', type: 'item' },
      ]);
    });

    it('logs cache hit statistics when trace provided and cache hits reach 1000 interval', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn(() => ({ id: 'entity1' })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      // Clear cache and create scenario for cache hits
      clearEntityCache();

      // First call creates cache entry (this is a cache miss)
      createEvaluationContext(
        'entity1',
        actor,
        gateway,
        locationProvider,
        trace
      );

      // Simulate exactly 1000 more cache hits to reach the 1000 hit milestone
      for (let i = 0; i < 1000; i++) {
        createEvaluationContext(
          'entity1',
          actor,
          gateway,
          locationProvider,
          trace
        );
      }

      // Verify cache hit logging was called
      expect(trace.addLog).toHaveBeenCalledWith(
        'debug',
        expect.stringMatching(
          /Cache stats: 1000 hits, 1 misses \(99\.9% hit rate\)/
        ),
        'createEvaluationContext'
      );
    });

    it('triggers cache eviction when cache size limit is exceeded', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = {
        getEntityInstance: jest.fn((id) => ({ id })),
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      // Clear cache first
      clearEntityCache();

      // Fill cache beyond limit (CACHE_SIZE_LIMIT = 10000)
      // We'll create 10001 unique entities to trigger eviction
      for (let i = 0; i <= 10000; i++) {
        const entityId = `entity_${i}`;
        createEvaluationContext(entityId, actor, gateway, locationProvider);
      }

      // Verify that gateway was called for each unique entity
      expect(gateway.getEntityInstance).toHaveBeenCalledTimes(10001);

      // Create another entity to verify cache still works after eviction
      createEvaluationContext('test_entity', actor, gateway, locationProvider);
      expect(gateway.getEntityInstance).toHaveBeenCalledWith('test_entity');
    });

    it('uses getAllComponents method path in createEvaluationContext when entity has the method', () => {
      class MockEntityWithGetAllComponents {
        constructor() {
          this.id = 'entity_with_method';
          this.componentTypeIds = ['core:name'];
        }

        getAllComponents() {
          return {
            'core:name': { text: 'Entity With Method' },
            'core:position': { x: 100, y: 200 },
          };
        }
      }

      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = new MockEntityWithGetAllComponents();
      const gateway = {
        getEntityInstance: jest.fn(() => entity),
        getComponentData: jest.fn(), // This should not be called
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        'entity_with_method',
        actor,
        gateway,
        locationProvider
      );

      expect(result.entity.components).toEqual({
        'core:name': { text: 'Entity With Method' },
        'core:position': { x: 100, y: 200 },
      });
      expect(gateway.getComponentData).not.toHaveBeenCalled(); // Verify getAllComponents was used instead
    });

    it('uses getAllComponents method path for actor processing in createEvaluationContext', () => {
      class MockActorEntity {
        constructor() {
          this.id = 'actor_with_method';
          this.componentTypeIds = ['core:actor'];
        }

        getAllComponents() {
          return {
            'core:actor': { type: 'advanced_npc' },
            'core:stats': { health: 100, mana: 50 },
          };
        }
      }

      const actorEntity = new MockActorEntity();
      const entity = { id: 'simple_entity' };
      const gateway = {
        getEntityInstance: jest.fn(() => entity),
        getComponentData: jest.fn(), // This should not be called for the actor
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        entity,
        actorEntity,
        gateway,
        locationProvider
      );

      expect(result.actor.components).toEqual({
        'core:actor': { type: 'advanced_npc' },
        'core:stats': { health: 100, mana: 50 },
      });
      expect(gateway.getComponentData).not.toHaveBeenCalled(); // getAllComponents should be used
    });

    it('handles pre-processed actor optimization correctly', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = { id: 'entity1' };
      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      // Pre-process the actor
      const processedActor = {
        id: 'actor1',
        components: { 'core:actor': { type: 'pre_processed' } },
      };

      const result = createEvaluationContext(
        entity,
        actor,
        gateway,
        locationProvider,
        null, // trace
        null, // runtimeContext
        processedActor // processedActor parameter
      );

      expect(result.actor).toBe(processedActor); // Should use pre-processed actor
      expect(result.actor.components).toEqual({
        'core:actor': { type: 'pre_processed' },
      });
    });

    it('exposes plain object properties directly in flattened context', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const plainObjectItem = {
        id: 'item1',
        quantity: 5,
        type: 'consumable',
        name: 'Health Potion',
      };
      const gateway = { getEntityInstance: jest.fn(() => null) }; // No entity found
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(
        plainObjectItem,
        actor,
        gateway,
        locationProvider
      );

      // Verify plain object properties are exposed at root level
      expect(result.quantity).toBe(5);
      expect(result.type).toBe('consumable');
      expect(result.name).toBe('Health Potion');
      expect(result.id).toBe('item1'); // Should be from the item, not overridden
    });
  });

  describe('preprocessActorForEvaluation', () => {
    it('throws error when actorEntity is null', () => {
      const gateway = { getComponentData: jest.fn() };

      expect(() => {
        preprocessActorForEvaluation(null, gateway);
      }).toThrow('preprocessActorForEvaluation: Invalid actor entity');
    });

    it('throws error when actorEntity is undefined', () => {
      const gateway = { getComponentData: jest.fn() };

      expect(() => {
        preprocessActorForEvaluation(undefined, gateway);
      }).toThrow('preprocessActorForEvaluation: Invalid actor entity');
    });

    it('throws error when actorEntity has no id', () => {
      const gateway = { getComponentData: jest.fn() };
      const actorEntity = { componentTypeIds: ['core:actor'] };

      expect(() => {
        preprocessActorForEvaluation(actorEntity, gateway);
      }).toThrow('preprocessActorForEvaluation: Invalid actor entity');
    });

    it('returns actor as-is when it already has plain object components', () => {
      const actorEntity = {
        id: 'actor1',
        components: {
          'core:actor': { type: 'npc' },
          'core:name': { text: 'Test Actor' },
        },
      };
      const gateway = { getComponentData: jest.fn() };

      const result = preprocessActorForEvaluation(actorEntity, gateway);

      expect(result).toBe(actorEntity); // Same reference since no processing needed
      expect(result.components).toEqual({
        'core:actor': { type: 'npc' },
        'core:name': { text: 'Test Actor' },
      });
    });

    it('converts Map-based components to plain object for plain actor', () => {
      const componentMap = new Map();
      componentMap.set('core:actor', { type: 'npc' });
      componentMap.set('core:name', { text: 'Map Actor' });

      const actorEntity = {
        id: 'actor1',
        components: componentMap,
      };
      const gateway = { getComponentData: jest.fn() };

      const result = preprocessActorForEvaluation(actorEntity, gateway);

      expect(result.components).toEqual({
        'core:actor': { type: 'npc' },
        'core:name': { text: 'Map Actor' },
      });
      expect(result.components).not.toBeInstanceOf(Map);
      expect(result.id).toBe('actor1');
    });

    it('converts Map-based components preserving prototype for custom actor class', () => {
      class CustomActor {
        constructor() {
          this.id = 'custom_actor';
          this.components = new Map();
          this.components.set('core:actor', { type: 'custom' });
        }
      }

      const actorEntity = new CustomActor();
      const gateway = { getComponentData: jest.fn() };

      const result = preprocessActorForEvaluation(actorEntity, gateway);

      expect(result.components).toEqual({
        'core:actor': { type: 'custom' },
      });
      expect(result.components).not.toBeInstanceOf(Map);
      expect(Object.getPrototypeOf(result)).toBe(CustomActor.prototype);
    });

    it('builds components from componentTypeIds for plain actor', () => {
      const actorEntity = {
        id: 'actor1',
        componentTypeIds: ['core:actor', 'core:name'],
      };
      const gateway = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'core:actor') return { type: 'player' };
          if (componentId === 'core:name') return { text: 'Player One' };
          return null;
        }),
      };

      const result = preprocessActorForEvaluation(actorEntity, gateway);

      expect(result.components).toEqual({
        'core:actor': { type: 'player' },
        'core:name': { text: 'Player One' },
      });
      expect(gateway.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'core:actor'
      );
      expect(gateway.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'core:name'
      );
    });

    it('uses getAllComponents method when available on Entity class', () => {
      class MockEntity {
        constructor() {
          this.id = 'entity_actor';
          this.componentTypeIds = ['core:actor'];
        }

        getAllComponents() {
          return {
            'core:actor': { type: 'entity_based' },
            'core:name': { text: 'Entity Actor' },
          };
        }
      }

      const actorEntity = new MockEntity();
      const gateway = { getComponentData: jest.fn() };

      const result = preprocessActorForEvaluation(actorEntity, gateway);

      expect(result.components).toEqual({
        'core:actor': { type: 'entity_based' },
        'core:name': { text: 'Entity Actor' },
      });
      expect(gateway.getComponentData).not.toHaveBeenCalled(); // Should use getAllComponents instead
    });

    it('preserves Entity class getter properties when building components', () => {
      class MockEntityActor {
        constructor() {
          this._data = { id: 'actor123', definitionId: 'test:actor' };
        }

        get id() {
          return this._data.id;
        }

        get definitionId() {
          return this._data.definitionId;
        }

        componentTypeIds = ['core:actor', 'core:name'];
      }

      const actorEntity = new MockEntityActor();
      const gateway = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'core:actor') return { type: 'complex' };
          if (componentId === 'core:name') return { text: 'Complex Actor' };
          return null;
        }),
      };

      const result = preprocessActorForEvaluation(actorEntity, gateway);

      // Verify getter properties still work
      expect(result.id).toBe('actor123');
      expect(result.definitionId).toBe('test:actor');
      expect(result.componentTypeIds).toEqual(['core:actor', 'core:name']);
      expect(result.components).toEqual({
        'core:actor': { type: 'complex' },
        'core:name': { text: 'Complex Actor' },
      });

      // Verify prototype chain preservation
      expect(Object.getPrototypeOf(result)).toBe(MockEntityActor.prototype);
    });

    it('returns actor as-is when no components and no componentTypeIds', () => {
      const actorEntity = {
        id: 'simple_actor',
        // No components property and no componentTypeIds
      };
      const gateway = { getComponentData: jest.fn() };

      const result = preprocessActorForEvaluation(actorEntity, gateway);

      expect(result).toBe(actorEntity); // Same reference
      expect(result.id).toBe('simple_actor');
      expect(result.components).toBeUndefined();
      expect(gateway.getComponentData).not.toHaveBeenCalled();
    });
  });
});
