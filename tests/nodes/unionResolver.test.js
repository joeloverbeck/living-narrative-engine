import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import createUnionResolver from '../../src/scopeDsl/nodes/unionResolver.js';

describe('unionResolver', () => {
  let resolver;
  let dispatcher;

  beforeEach(() => {
    // Create a mock dispatcher for recursive resolution
    dispatcher = {
      resolve: jest.fn(),
    };

    resolver = createUnionResolver();
  });

  describe('canResolve', () => {
    it('should return true for Union nodes', () => {
      expect(resolver.canResolve({ type: 'Union' })).toBe(true);
    });

    it('should return false for non-Union nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'Step' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
    });
  });

  describe('resolve', () => {
    describe('basic union operations', () => {
      it('should union two disjoint sets', () => {
        const leftResult = new Set(['entity1', 'entity2']);
        const rightResult = new Set(['entity3', 'entity4']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source', kind: 'entities', param: 'core:name' },
          right: { type: 'Source', kind: 'entities', param: 'core:position' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(4);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has('entity3')).toBe(true);
        expect(result.has('entity4')).toBe(true);

        // Verify both sides were resolved
        expect(dispatcher.resolve).toHaveBeenCalledTimes(2);
        expect(dispatcher.resolve).toHaveBeenCalledWith(node.left, ctx);
        expect(dispatcher.resolve).toHaveBeenCalledWith(node.right, ctx);
      });

      it('should handle overlapping sets correctly', () => {
        const leftResult = new Set(['entity1', 'entity2', 'entity3']);
        const rightResult = new Set(['entity2', 'entity3', 'entity4']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(4); // entity1, entity2, entity3, entity4 (no duplicates)
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has('entity3')).toBe(true);
        expect(result.has('entity4')).toBe(true);
      });

      it('should handle empty sets', () => {
        const leftResult = new Set(['entity1', 'entity2']);
        const rightResult = new Set();

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
      });

      it('should handle both empty sets', () => {
        const leftResult = new Set();
        const rightResult = new Set();

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      });
    });

    describe('diverse data types', () => {
      it('should union sets containing different types of values', () => {
        const obj1 = { id: 'exit1', direction: 'north' };
        const obj2 = { id: 'exit2', direction: 'south' };

        const leftResult = new Set(['entity1', 'entity2']);
        const rightResult = new Set([obj1, obj2]);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Step' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(4);
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has(obj1)).toBe(true);
        expect(result.has(obj2)).toBe(true);
      });

      it('should handle arrays in sets', () => {
        const arr1 = ['entity1', 'entity2'];
        const arr2 = ['entity3'];

        const leftResult = new Set([arr1]);
        const rightResult = new Set([arr2, 'entity4']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Step' },
          right: { type: 'Step' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(3);
        expect(result.has(arr1)).toBe(true);
        expect(result.has(arr2)).toBe(true);
        expect(result.has('entity4')).toBe(true);
      });
    });

    describe('trace logging', () => {
      it('should add trace logs when trace context is provided', () => {
        const trace = {
          addLog: jest.fn(),
        };

        const leftResult = new Set(['entity1', 'entity2']);
        const rightResult = new Set(['entity2', 'entity3']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
          trace,
        };

        resolver.resolve(node, ctx);

        expect(trace.addLog).toHaveBeenCalledWith(
          'info',
          'Starting union resolution.',
          'UnionResolver'
        );

        expect(trace.addLog).toHaveBeenCalledWith(
          'info',
          'Union complete. Left: 2 items, Right: 2 items, Total: 3 items.',
          'UnionResolver',
          {
            leftSize: 2,
            rightSize: 2,
            unionSize: 3,
          }
        );
      });

      it('should not throw when trace is not provided', () => {
        const leftResult = new Set(['entity1']);
        const rightResult = new Set(['entity2']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        expect(() => resolver.resolve(node, ctx)).not.toThrow();
      });
    });

    describe('identical items', () => {
      it('should correctly handle identical string values', () => {
        const leftResult = new Set(['entity1', 'entity2', 'entity3']);
        const rightResult = new Set(['entity1', 'entity2', 'entity3']);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(3); // No duplicates
        expect(result.has('entity1')).toBe(true);
        expect(result.has('entity2')).toBe(true);
        expect(result.has('entity3')).toBe(true);
      });

      it('should handle object reference equality correctly', () => {
        const sharedObj = { id: 'shared', value: 42 };
        const leftResult = new Set([sharedObj, { id: 'left' }]);
        const rightResult = new Set([sharedObj, { id: 'right' }]);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Step' },
          right: { type: 'Step' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(3); // sharedObj counted once
        expect(result.has(sharedObj)).toBe(true);
      });
    });

    describe('large sets', () => {
      it('should efficiently handle large sets', () => {
        const leftItems = [];
        const rightItems = [];

        // Create 1000 items for each side with 200 overlapping
        for (let i = 0; i < 1000; i++) {
          leftItems.push(`left-${i}`);
          rightItems.push(`right-${i}`);
        }
        // Add overlapping items
        for (let i = 0; i < 200; i++) {
          leftItems.push(`shared-${i}`);
          rightItems.push(`shared-${i}`);
        }

        const leftResult = new Set(leftItems);
        const rightResult = new Set(rightItems);

        dispatcher.resolve
          .mockReturnValueOnce(leftResult)
          .mockReturnValueOnce(rightResult);

        const node = {
          type: 'Union',
          left: { type: 'Source' },
          right: { type: 'Source' },
        };
        const ctx = {
          actorEntity: { id: 'actor123' },
          dispatcher,
        };

        const result = resolver.resolve(node, ctx);

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(2200); // 1000 + 1000 + 200 shared (counted once)
      });
    });
  });
});
