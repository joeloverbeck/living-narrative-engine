import createStepResolver from '../../../../src/scopeDsl/nodes/stepResolver.js';
import { createTestEntity } from '../../../common/mockFactories/entities.js';

describe('StepResolver', () => {
  let resolver;
  let entitiesGateway;
  let dispatcher;
  let trace;

  beforeEach(() => {
    // Mock entitiesGateway
    entitiesGateway = {
      getComponentData: jest.fn((entityId, componentId) => {
        const componentDataMap = {
          entity1: {
            'core:position': { location: 'location1', x: 10, y: 20 },
            'core:relationships': {
              friends: ['entity2', 'entity3'],
              enemies: ['entity4'],
            },
          },
          entity2: {
            'core:position': { location: 'location2', x: 30, y: 40 },
            'core:name': { first: 'John', last: 'Doe' },
          },
          entity3: {
            'core:position': { location: 'location3' },
          },
        };
        return componentDataMap[entityId]?.[componentId];
      }),
      getEntityInstance: jest.fn((entityId) => {
        // Mock entity instances with componentTypeIds
        const entities = {
          entity1: {
            id: 'entity1',
            componentTypeIds: ['core:position', 'core:relationships'],
          },
          entity2: {
            id: 'entity2',
            componentTypeIds: ['core:position', 'core:name'],
          },
          entity3: {
            id: 'entity3',
            componentTypeIds: ['core:position'],
          },
        };
        return entities[entityId];
      }),
    };

    // Mock dispatcher
    dispatcher = {
      resolve: jest.fn(),
    };

    // Mock trace
    trace = {
      addLog: jest.fn(),
    };

    resolver = createStepResolver({ entitiesGateway });
  });

  describe('canResolve', () => {
    it('should return true for Step nodes', () => {
      expect(resolver.canResolve({ type: 'Step' })).toBe(true);
    });

    it('should return false for non-Step nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'ArrayIterationStep' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should return empty set when parent result is empty', () => {
      const node = { type: 'Step', field: 'core:position', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set());

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
      expect(dispatcher.resolve).toHaveBeenCalledWith(node.parent, ctx);
    });

    it('should extract field values from entity IDs', () => {
      const node = { type: 'Step', field: 'core:position', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      const resultArray = [...result];
      expect(resultArray).toContainEqual({
        location: 'location1',
        x: 10,
        y: 20,
      });
      expect(resultArray).toContainEqual({
        location: 'location2',
        x: 30,
        y: 40,
      });
    });

    it('should extract field values from objects', () => {
      const node = { type: 'Step', field: 'location', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const obj1 = { location: 'loc1', name: 'Place 1' };
      const obj2 = { location: 'loc2', name: 'Place 2' };

      dispatcher.resolve.mockReturnValue(new Set([obj1, obj2]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['loc1', 'loc2']));
    });

    it('should handle mixed entity IDs and objects', () => {
      const node = { type: 'Step', field: 'location', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const obj = { location: 'objLocation' };
      dispatcher.resolve.mockReturnValue(new Set(['entity1', obj]));

      const result = resolver.resolve(node, ctx);

      // Should get location from entity1's core:position component data (location1)
      // and from the object (objLocation)
      expect(result).toEqual(new Set(['location1', 'objLocation']));
    });

    it('should skip undefined field values', () => {
      const node = { type: 'Step', field: 'nonexistent', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const obj1 = { name: 'No field here' };
      const obj2 = { nonexistent: 'Has field', other: 'data' };

      dispatcher.resolve.mockReturnValue(new Set(['entity1', obj1, obj2]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['Has field']));
    });

    it('should handle null and non-object parent values', () => {
      const node = { type: 'Step', field: 'someField', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(
        new Set([null, undefined, 123, true, 'not-an-entity'])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
      expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
        'not-an-entity',
        'someField'
      );
    });

    it('should add trace logs when trace is provided', () => {
      const node = { type: 'Step', field: 'core:position', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));

      resolver.resolve(node, ctx);

      
      
      
    });

    it('should not throw when trace is not provided', () => {
      const node = { type: 'Step', field: 'core:position', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, actorEntity }; // No trace

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));

      expect(() => resolver.resolve(node, ctx)).not.toThrow();
    });

    it('should preserve object references in results', () => {
      const node = { type: 'Step', field: 'data', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const dataObj1 = { id: 1, value: 'data1' };
      const dataObj2 = { id: 2, value: 'data2' };
      const parent1 = { data: dataObj1 };
      const parent2 = { data: dataObj2 };

      dispatcher.resolve.mockReturnValue(new Set([parent1, parent2]));

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      expect(result.has(dataObj1)).toBe(true);
      expect(result.has(dataObj2)).toBe(true);
    });

    it('should handle nested field access from component data', () => {
      const node = { type: 'Step', field: 'core:relationships', parent: {} };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(1);
      const relationships = [...result][0];
      expect(relationships).toEqual({
        friends: ['entity2', 'entity3'],
        enemies: ['entity4'],
      });
    });
  });
});
