import createArrayIterationResolver from '../../src/scopeDsl/nodes/arrayIterationResolver.js';

describe('ArrayIterationResolver', () => {
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
            'core:relationships': {
              friends: ['entity2', 'entity3'],
              enemies: ['entity4'],
            },
            'core:inventory': ['item1', 'item2', 'item3'],
            'core:skills': [
              ['skill1', 'skill2'],
              ['skill3', 'skill4'],
            ], // Nested arrays
          },
          entity2: {
            'core:inventory': ['item4', 'item5'],
            'core:tags': ['tag1', 'tag2', 'tag1'], // Duplicates
          },
          entity3: {
            'core:inventory': [], // Empty array
            'core:data': { notAnArray: 'value' },
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

    resolver = createArrayIterationResolver({ entitiesGateway });
  });

  describe('canResolve', () => {
    it('should return true for ArrayIterationStep nodes', () => {
      expect(resolver.canResolve({ type: 'ArrayIterationStep' })).toBe(true);
    });

    it('should return false for non-ArrayIterationStep nodes', () => {
      expect(resolver.canResolve({ type: 'Step' })).toBe(false);
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should return empty set when parent result is empty', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:inventory',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set());

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
      expect(dispatcher.resolve).toHaveBeenCalledWith(node.parent, ctx);
    });

    it('should flatten arrays from entity component data', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:inventory',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(
        new Set(['item1', 'item2', 'item3', 'item4', 'item5'])
      );
    });

    it('should flatten nested arrays', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:skills',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['skill1', 'skill2', 'skill3', 'skill4']));
    });

    it('should deduplicate values', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:tags',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity2']));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['tag1', 'tag2'])); // tag1 appears twice but Set deduplicates
    });

    it('should handle empty arrays', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:inventory',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity3']));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
    });

    it('should flatten arrays from object field access', () => {
      const node = { type: 'ArrayIterationStep', field: 'items', parent: {} };
      const ctx = { dispatcher, trace };

      const obj1 = { items: ['a', 'b', 'c'] };
      const obj2 = { items: ['d', 'e'] };
      const obj3 = { items: [['f', 'g'], 'h'] }; // Nested

      dispatcher.resolve.mockReturnValue(new Set([obj1, obj2, obj3]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']));
    });

    it('should handle non-array field values', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:data',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity3']));

      const result = resolver.resolve(node, ctx);

      // Non-array values are added as-is
      expect(result).toEqual(new Set([{ notAnArray: 'value' }]));
    });

    it('should skip undefined field values', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'nonexistent',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      const obj1 = { other: ['values'] };
      dispatcher.resolve.mockReturnValue(new Set(['entity1', obj1]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
    });

    it('should handle mixed arrays and non-arrays', () => {
      const node = { type: 'ArrayIterationStep', field: 'mixed', parent: {} };
      const ctx = { dispatcher, trace };

      const obj1 = { mixed: ['a', 'b'] };
      const obj2 = { mixed: 'not-array' };
      const obj3 = { mixed: [['c'], 'd'] };
      const obj4 = { mixed: null };
      const obj5 = { mixed: undefined };

      dispatcher.resolve.mockReturnValue(
        new Set([obj1, obj2, obj3, obj4, obj5])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['a', 'b', 'not-array', 'c', 'd', null]));
    });

    it('should handle objects within arrays', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'relationships',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const parent = { relationships: [obj1, [obj2, obj1]] };

      dispatcher.resolve.mockReturnValue(new Set([parent]));

      const result = resolver.resolve(node, ctx);

      expect(result.size).toBe(2);
      expect(result.has(obj1)).toBe(true);
      expect(result.has(obj2)).toBe(true);
    });

    it('should add trace logs when trace is provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:inventory',
        parent: {},
      };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));

      resolver.resolve(node, ctx);

      expect(trace.addLog).toHaveBeenCalledTimes(2);
      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        "Resolving ArrayIterationStep node with field 'core:inventory'. Parent result size: 1",
        'ArrayIterationResolver',
        { field: 'core:inventory', parentSize: 1 }
      );
      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        "ArrayIterationStep node resolved. Field: 'core:inventory', Result size: 3",
        'ArrayIterationResolver',
        { field: 'core:inventory', resultSize: 3 }
      );
    });

    it('should not throw when trace is not provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        field: 'core:inventory',
        parent: {},
      };
      const ctx = { dispatcher }; // No trace

      dispatcher.resolve.mockReturnValue(new Set(['entity1']));

      expect(() => resolver.resolve(node, ctx)).not.toThrow();
    });

    it('should handle complex nested structures from relationships', () => {
      const node = { type: 'ArrayIterationStep', field: 'friends', parent: {} };
      const ctx = { dispatcher, trace };

      // Parent returns relationship objects
      const relationships1 = { friends: ['e1', 'e2'], enemies: ['e3'] };
      const relationships2 = { friends: [['e4', 'e5'], 'e6'] };

      dispatcher.resolve.mockReturnValue(
        new Set([relationships1, relationships2])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['e1', 'e2', 'e4', 'e5', 'e6']));
    });

    it('should handle null and non-object parent values', () => {
      const node = { type: 'ArrayIterationStep', field: 'field', parent: {} };
      const ctx = { dispatcher, trace };

      dispatcher.resolve.mockReturnValue(
        new Set([null, undefined, 123, true, 'not-an-entity'])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
      expect(entitiesGateway.getComponentData).toHaveBeenCalledWith(
        'not-an-entity',
        'field'
      );
    });
  });
});
