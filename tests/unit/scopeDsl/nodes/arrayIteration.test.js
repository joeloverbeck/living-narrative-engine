import createArrayIterationResolver from '../../../../src/scopeDsl/nodes/arrayIterationResolver.js';
import { createTestEntity } from '../../../common/mockFactories/entities.js';

describe('ArrayIterationResolver', () => {
  let resolver;
  let dispatcher;
  let trace;

  beforeEach(() => {
    // Mock dispatcher
    dispatcher = {
      resolve: jest.fn(),
    };

    // Mock trace
    trace = {
      addLog: jest.fn(),
    };

    // Create resolver - no dependencies needed
    resolver = createArrayIterationResolver();
  });

  describe('canResolve', () => {
    it('should return true for ArrayIterationStep nodes', () => {
      const node = { type: 'ArrayIterationStep' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return false for non-ArrayIterationStep nodes', () => {
      expect(resolver.canResolve({ type: 'Source' })).toBe(false);
      expect(resolver.canResolve({ type: 'Step' })).toBe(false);
      expect(resolver.canResolve({ type: 'Filter' })).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should throw error when actorEntity is missing from context', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const ctx = { dispatcher, trace }; // Missing actorEntity

      expect(() => resolver.resolve(node, ctx)).toThrow(
        'ArrayIterationResolver: actorEntity is missing from context'
      );
    });

    it('should return empty set when parent result is empty', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set());

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
      expect(dispatcher.resolve).toHaveBeenCalledWith(node.parent, ctx);
    });

    it('should flatten arrays from parent result', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Parent returns arrays
      dispatcher.resolve.mockReturnValue(
        new Set([
          ['item1', 'item2'],
          ['item3', 'item4', 'item5'],
        ])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(
        new Set(['item1', 'item2', 'item3', 'item4', 'item5'])
      );
    });

    it('should handle nested arrays', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(
        new Set([
          [
            ['skill1', 'skill2'],
            ['skill3', 'skill4'],
          ],
        ])
      );

      const result = resolver.resolve(node, ctx);

      // Nested arrays are only flattened one level
      expect(result).toEqual(
        new Set([
          ['skill1', 'skill2'],
          ['skill3', 'skill4'],
        ])
      );
    });

    it('should filter out null and undefined values', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(
        new Set([['item1', null, 'item2', undefined, 'item3']])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['item1', 'item2', 'item3']));
    });

    it('should handle empty arrays', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set([[], ['item1']]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['item1']));
    });

    it('should pass through entity IDs when parent is Source', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Source' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Source returns entity IDs directly
      dispatcher.resolve.mockReturnValue(
        new Set(['entity1', 'entity2', 'entity3'])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['entity1', 'entity2', 'entity3']));
    });

    it('should handle non-array values from non-Source parents', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(
        new Set(['not-an-array', 42, { obj: true }])
      );

      const result = resolver.resolve(node, ctx);

      // Non-arrays from Step nodes result in empty set
      expect(result).toEqual(new Set());
    });

    it('should add trace logs when trace context is provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set([['item1', 'item2']]));

      resolver.resolve(node, ctx);

      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        'Resolving ArrayIterationStep node. Parent result size: 1',
        'ArrayIterationResolver',
        { parentSize: 1 }
      );

      expect(trace.addLog).toHaveBeenCalledWith(
        'info',
        'ArrayIterationStep node resolved. Result size: 2',
        'ArrayIterationResolver',
        { resultSize: 2 }
      );
    });

    describe('clothing access object handling', () => {
      it('should handle clothing access objects with topmost mode', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          equipped: {
            torso: {
              outer: 'jacket1',
              base: 'shirt1',
              underwear: 'undergarment1',
            },
            legs: {
              outer: 'pants1',
              base: 'base_pants1',
            },
          },
          mode: 'topmost',
        };

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        // Should only get topmost items (first available in layer priority)
        expect(result).toEqual(new Set(['jacket1', 'pants1']));
      });

      it('should handle clothing access objects with all mode', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          equipped: {
            torso: {
              outer: 'jacket1',
              base: 'shirt1',
              underwear: 'undergarment1',
              accessories: 'necklace1',
            },
          },
          mode: 'all',
        };

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        // Should get all layers
        expect(result).toEqual(
          new Set(['jacket1', 'shirt1', 'undergarment1', 'necklace1'])
        );
      });

      it('should handle clothing access objects with specific layer mode', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          equipped: {
            torso: {
              outer: 'jacket1',
              base: 'shirt1',
              underwear: 'undergarment1',
            },
          },
          mode: 'base',
        };

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        // Should only get base layer items
        expect(result).toEqual(new Set(['shirt1']));
      });

      it('should handle clothing access objects with invalid or empty slots', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          equipped: {
            torso: null, // Invalid slot data
            legs: 'not-an-object', // Invalid slot data
            arms: {
              outer: 'sleeve1',
            },
            head: {
              // Empty layers
            },
          },
          mode: 'topmost',
        };

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        // Should only get valid items, skipping invalid slots
        expect(result).toEqual(new Set(['sleeve1']));
      });

      it('should handle clothing access objects with unknown mode (defaults to topmost)', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          equipped: {
            torso: {
              outer: 'jacket1',
              base: 'shirt1',
              underwear: 'undergarment1',
            },
          },
          mode: 'unknown_mode',
        };

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        // Should default to topmost behavior (all layers since fallback to LAYER_PRIORITY.topmost)
        expect(result).toEqual(new Set(['jacket1', 'shirt1', 'undergarment1']));
      });

      it('should filter out null and undefined clothing items', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          equipped: {
            torso: {
              outer: 'jacket1',
              base: null,
              underwear: undefined,
            },
            legs: {
              outer: 'pants1',
            },
          },
          mode: 'all',
        };

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        // Should filter out null and undefined values
        expect(result).toEqual(new Set(['jacket1', 'pants1']));
      });
    });
  });
});
