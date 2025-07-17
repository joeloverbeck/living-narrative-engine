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
  });
});
