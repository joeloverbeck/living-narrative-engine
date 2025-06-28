import createStepResolver from '../../src/scopeDsl/nodes/stepResolver.js';

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
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set());

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
      expect(dispatcher.resolve).toHaveBeenCalledWith(node.parent, ctx);
    });

    it('should extract field values from entity IDs', () => {
      const node = { type: 'Step', field: 'core:position', parent: {} };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      const resultArray = [...result];
      expect(resultArray).toContainEqual({ location: 'location1', x: 10, y: 20 });
      expect(resultArray).toContainEqual({ location: 'location2', x: 30, y: 40 });
    });

    it('should extract field values from objects', () => {
      const node = { type: 'Step', field: 'location', parent: {} };
      const ctx = { dispatcher, trace };

      const obj1 = { location: 'loc1', name: 'Place 1' };
      const obj2 = { location: 'loc2', name: 'Place 2' };

      dispatcher.resolve.mockReturnValue(new Set([obj1, obj2]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['loc1', 'loc2']));
    });

    it('should handle mixed entity IDs and objects', () => {
      const node = { type: 'Step', field: 'location', parent: {} };
      const ctx = { dispatcher, trace };

      const obj = { location: 'objLocation' };
      dispatcher.resolve.mockReturnValue(new Set(['entity1', obj]));

      const result = resolver.resolve(node, ctx);

      // Should get location from entity1's core:position component data
      const entity1Position = entitiesGateway.getComponentData(
        'entity1',
        'location'
      );
      expect(entity1Position).toBeUndefined(); // No 'location' component

      // Should get location from object
      expect(result).toEqual(new Set(['objLocation']));
    });

    it('should skip undefined field values', () => {
      const node = { type: 'Step', field: 'nonexistent', parent: {} };
      const ctx = { dispatcher, trace };

      const obj1 = { name: 'No field here' };
      const obj2 = { nonexistent: 'Has field', other: 'data' };

      dispatcher.resolve.mockReturnValue(new Set(['entity1', obj1, obj2]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['Has field']));
    });

    it('should handle null and non-object parent values', () => {
      const node = { type: 'Step', field: 'someField', parent: {} };
      const ctx = { dispatcher, trace };

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
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));

      resolver.resolve(node, ctx);

      expect(trace.addLog).toHaveBeenCalledTimes(2);
      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        "Resolving Step node with field 'core:position'. Parent result size: 2",
        'StepResolver',
        { field: 'core:position', parentSize: 2 }
      );
      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        "Step node resolved. Field: 'core:position', Result size: 2",
        'StepResolver',
        { field: 'core:position', resultSize: 2 }
      );
    });

    it('should not throw when trace is not provided', () => {
      const node = { type: 'Step', field: 'core:position', parent: {} };
      const ctx = { dispatcher }; // No trace

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));

      expect(() => resolver.resolve(node, ctx)).not.toThrow();
    });

    it('should preserve object references in results', () => {
      const node = { type: 'Step', field: 'data', parent: {} };
      const ctx = { dispatcher, trace };

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
      const ctx = { dispatcher, trace };

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
