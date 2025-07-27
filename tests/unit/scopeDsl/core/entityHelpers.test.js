import { jest } from '@jest/globals';
import {
  getOrBuildComponents,
  createEvaluationContext,
} from '../../../../src/scopeDsl/core/entityHelpers.js';

describe('entityHelpers', () => {
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
      expect(trace.addLog).toHaveBeenCalledWith(
        'warn',
        "Entity 'e2' does not expose componentTypeIds. Unable to retrieve components.",
        'EntityHelpers',
        { entityId: 'e2' }
      );
    });

    it('returns null when entity parameter is provided but null', () => {
      const gateway = { getEntityInstance: jest.fn() };
      const result = getOrBuildComponents('e3', null, gateway);
      expect(result).toBeNull();
      expect(gateway.getEntityInstance).toHaveBeenCalledWith('e3');
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

      const result = createEvaluationContext(null, actor, gateway, locationProvider);
      expect(result).toBeNull();
    });

    it('returns null when item is undefined', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = { getEntityInstance: jest.fn() };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(undefined, actor, gateway, locationProvider);
      expect(result).toBeNull();
    });

    it('returns null when item is invalid type (number)', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = { getEntityInstance: jest.fn() };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(123, actor, gateway, locationProvider);
      expect(result).toBeNull();
    });

    it('returns null when item is invalid type (boolean)', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const gateway = { getEntityInstance: jest.fn() };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(true, actor, gateway, locationProvider);
      expect(result).toBeNull();
    });

    it('converts Map-based components to plain object for plain entity', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const componentMap = new Map();
      componentMap.set('core:name', { text: 'Test Name' });
      componentMap.set('core:position', { x: 10, y: 20 });
      
      const entity = {
        id: 'entity1',
        components: componentMap
      };
      
      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(entity, actor, gateway, locationProvider);
      
      expect(result.entity.components).toEqual({
        'core:name': { text: 'Test Name' },
        'core:position': { x: 10, y: 20 }
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

      const result = createEvaluationContext(entity, actor, gateway, locationProvider);
      
      expect(result.entity.components).toEqual({
        'core:name': { text: 'Custom Entity' }
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
          'core:position': { x: 5, y: 10 }
        }
      };
      
      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };

      const result = createEvaluationContext(entity, actor, gateway, locationProvider);
      
      expect(result.entity.components).toEqual({
        'core:name': { text: 'Existing Components' },
        'core:position': { x: 5, y: 10 }
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

      const result = createEvaluationContext(entity, actor, gateway, locationProvider);
      
      expect(result.entity).toBe(entity); // Same reference
      expect(result.entity.id).toBe('entity1');
      expect(result.entity.components).toBeUndefined();
    });

    it('logs debug information when trace is provided and entity is resolved', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = { id: 'entity1', componentTypeIds: ['core:name'] };
      
      const gateway = {
        getEntityInstance: jest.fn(() => entity),
        getComponentData: jest.fn(() => ({ text: 'Test Entity' }))
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      createEvaluationContext('entity1', actor, gateway, locationProvider, trace);
      
      expect(trace.addLog).toHaveBeenCalledWith(
        'debug',
        'Item entity1 resolved as entity',
        'createEvaluationContext'
      );
    });

    it('logs debug information when trace is provided and component lookup fallback is used', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      
      const gateway = {
        getEntityInstance: jest.fn(() => null), // Entity not found
        getItemComponents: jest.fn(() => ({ 'core:name': { text: 'Fallback Component' } }))
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      const result = createEvaluationContext('item1', actor, gateway, locationProvider, trace);
      
      expect(trace.addLog).toHaveBeenCalledWith(
        'debug',
        'Item item1 resolved via component lookup',
        'createEvaluationContext'
      );
      expect(result.entity.components).toEqual({ 'core:name': { text: 'Fallback Component' } });
    });

    it('logs debug information when trace is provided and basic entity is created', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      
      const gateway = {
        getEntityInstance: jest.fn(() => null), // Entity not found
        getItemComponents: jest.fn(() => null) // Component lookup also fails
      };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      const result = createEvaluationContext('item1', actor, gateway, locationProvider, trace);
      
      expect(trace.addLog).toHaveBeenCalledWith(
        'debug',
        'Item item1 created as basic entity',
        'createEvaluationContext'
      );
      expect(result.entity.id).toBe('item1');
    });

    it('logs comprehensive debug information when trace is provided', () => {
      const actor = { 
        id: 'actor1', 
        componentTypeIds: ['core:actor'],
        components: { 'core:actor': { type: 'npc' } }
      };
      const entity = { 
        id: 'entity1', 
        componentTypeIds: ['core:name'],
        components: { 'core:name': { text: 'Test Entity' } }
      };
      
      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const trace = { addLog: jest.fn() };

      createEvaluationContext(entity, actor, gateway, locationProvider, trace);
      
      // Check that debug logging was called with correct parameters
      expect(trace.addLog).toHaveBeenCalledWith(
        'debug',
        'createEvaluationContext: entity=entity1, has components=true, actor=actor1, has components=true',
        'EntityHelpers',
        {
          entityId: 'entity1',
          entityComponentKeys: ['core:name'],
          actorId: 'actor1',
          actorComponentKeys: ['core:actor']
        }
      );
    });

    it('includes target in runtime context when provided', () => {
      const actor = { id: 'actor1', componentTypeIds: [] };
      const entity = { id: 'entity1' };
      
      const gateway = { getEntityInstance: jest.fn(() => entity) };
      const locationProvider = { getLocation: jest.fn(() => ({ id: 'loc1' })) };
      const runtimeContext = { target: { id: 'target1', type: 'npc' } };

      const result = createEvaluationContext(entity, actor, gateway, locationProvider, null, runtimeContext);
      
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
          { id: 'target2', type: 'item' }
        ]
      };

      const result = createEvaluationContext(entity, actor, gateway, locationProvider, null, runtimeContext);
      
      expect(result.targets).toEqual([
        { id: 'target1', type: 'npc' },
        { id: 'target2', type: 'item' }
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
          { id: 'target2', type: 'item' }
        ]
      };

      const result = createEvaluationContext(entity, actor, gateway, locationProvider, null, runtimeContext);
      
      expect(result.target).toEqual({ id: 'primary', type: 'npc' });
      expect(result.targets).toEqual([
        { id: 'target1', type: 'npc' },
        { id: 'target2', type: 'item' }
      ]);
    });
  });
});
