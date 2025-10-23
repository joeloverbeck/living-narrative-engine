import createArrayIterationResolver from '../../../../src/scopeDsl/nodes/arrayIterationResolver.js';
import { createTestEntity } from '../../../common/mockFactories/entities.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('ArrayIterationResolver', () => {
  let resolver;
  let dispatcher;
  let trace;
  let errorHandler;
  let mockClothingAccessibilityService;

  beforeEach(() => {
    // Mock dispatcher
    dispatcher = {
      resolve: jest.fn(),
    };

    // Mock trace
    trace = {
      addLog: jest.fn(),
      addStep: jest.fn(),
    };

    // Mock error handler
    errorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };

    // Mock clothing accessibility service
    mockClothingAccessibilityService = {
      getAccessibleItems: jest.fn(),
    };

    // Create resolver with mocked service
    resolver = createArrayIterationResolver({
      clothingAccessibilityService: mockClothingAccessibilityService,
      errorHandler: errorHandler,
    });
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

    it('should throw missing actor error without invoking an error handler when none is provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const ctx = { dispatcher, trace };

      const resolverWithoutHandler = createArrayIterationResolver({
        clothingAccessibilityService: mockClothingAccessibilityService,
      });

      expect(() => resolverWithoutHandler.resolve(node, ctx)).toThrow(
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

    it('should return empty set when dispatcher is not provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { trace, actorEntity };

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set());
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

    it('should pass through values when parent is a ScopeReference', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'ScopeReference' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set(['scope-entity', null]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['scope-entity']));
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should ignore nullish values from Source parents', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Source' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set([null, undefined, 'entity3']));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['entity3']));
    });

    it('should skip pass-through when special parent values are nullish', () => {
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReset();
      const parents = [
        { type: 'Source' },
        { type: 'ArrayIterationStep' },
        { type: 'ScopeReference' },
        { type: 'Step', field: 'entities', param: { component: 'core:actor' } },
        { type: 'Step' },
      ];

      parents.forEach(() => {
        dispatcher.resolve.mockReturnValueOnce(new Set([null, undefined]));
      });

      parents.forEach(parent => {
        const node = { type: 'ArrayIterationStep', parent };
        const result = resolver.resolve(node, ctx);
        expect(result.size).toBe(0);
      });

      expect(errorHandler.handleError).not.toHaveBeenCalled();
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

    it('should work without trace context', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace: null, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set([['item1', 'item2']]));

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(new Set(['item1', 'item2']));
    });

    it('should use runtime logger diagnostics when debug is available', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const logger = { debug: jest.fn() };
      const ctx = {
        dispatcher,
        trace,
        actorEntity,
        runtimeCtx: { logger },
      };

      dispatcher.resolve.mockReturnValue(new Set([['item1', 'item2']]));

      const consoleDebugSpy = jest
        .spyOn(console, 'debug')
        .mockImplementation(() => {});

      try {
        const result = resolver.resolve(node, ctx);
        expect(result).toEqual(new Set(['item1', 'item2']));
      } finally {
        consoleDebugSpy.mockRestore();
      }

      expect(logger.debug).toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should avoid console diagnostics when debug logging is unavailable', async () => {
      const originalDebug = console.debug;
      // Ensure console.debug is not treated as a function so the fallback branch executes
      // eslint-disable-next-line no-console
      delete console.debug;

      try {
        await jest.isolateModulesAsync(async () => {
          const { default: isolatedResolverFactory } = await import(
            '../../../../src/scopeDsl/nodes/arrayIterationResolver.js'
          );

          const localResolver = isolatedResolverFactory();
          const node = {
            type: 'ArrayIterationStep',
            parent: { type: 'Step' },
          };
          const actorEntity = createTestEntity('test-actor', {
            'core:actor': {},
          });
          const ctx = { dispatcher, trace, actorEntity };

          dispatcher.resolve.mockReturnValue(new Set([['alpha']]));

          expect(() => localResolver.resolve(node, ctx)).not.toThrow();
        });
      } finally {
        console.debug = originalDebug;
      }
    });

    describe('clothing access object handling', () => {
      it('should delegate clothing access to service', () => {
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
          entityId: 'test-entity',
          mode: 'topmost'
        };

        mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
          'jacket1', 'pants1'
        ]);

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        expect(mockClothingAccessibilityService.getAccessibleItems).toHaveBeenCalledWith(
          'test-entity',
          expect.objectContaining({
            mode: 'topmost',
            context: 'removal',
            sortByPriority: true
          })
        );

        expect(result).toEqual(new Set(['jacket1', 'pants1']));
      });

      it('should handle different modes through service', () => {
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
          entityId: 'test-entity',
          mode: 'all'
        };

        mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
          'jacket1', 'shirt1', 'undergarment1', 'necklace1'
        ]);

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        expect(mockClothingAccessibilityService.getAccessibleItems).toHaveBeenCalledWith(
          'test-entity',
          expect.objectContaining({
            mode: 'all',
            context: 'removal',
            sortByPriority: true
          })
        );

        expect(result).toEqual(new Set(['jacket1', 'shirt1', 'undergarment1', 'necklace1']));
      });

      it('should handle service errors gracefully', () => {
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
          entityId: 'test-entity',
          mode: 'topmost'
        };

        mockClothingAccessibilityService.getAccessibleItems.mockImplementation(() => {
          throw new Error('Service error');
        });

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        expect(errorHandler.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Service error'
          }),
          expect.objectContaining({
            context: 'processClothingAccess',
            entityId: 'test-entity',
            mode: 'topmost'
          }),
          'ArrayIterationResolver',
          ErrorCodes.CLOTHING_ACCESS_FAILED
        );

        expect(result).toEqual(new Set());
      });

      it('should handle missing mode (defaults to topmost)', () => {
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
          entityId: 'test-entity'
          // no mode specified
        };

        mockClothingAccessibilityService.getAccessibleItems.mockReturnValue(['jacket1']);

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        expect(mockClothingAccessibilityService.getAccessibleItems).toHaveBeenCalledWith(
          'test-entity',
          expect.objectContaining({
            mode: 'topmost', // should default to topmost
            context: 'removal',
            sortByPriority: true
          })
        );

        expect(result).toEqual(new Set(['jacket1']));
      });

      it('should handle empty results from service', () => {
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
          entityId: 'test-entity',
          mode: 'base'
        };

        mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([]);

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should enforce the array size limit when service returns excessive items', () => {
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
          entityId: 'oversized-entity',
          mode: 'topmost',
        };

        const largeResult = Array.from({ length: 10005 }, (_, index) => `item-${index}`);
        mockClothingAccessibilityService.getAccessibleItems.mockReturnValue(largeResult);

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        expect(result.size).toBe(10000);
        expect(result.has('item-0')).toBe(true);
        expect(result.has('item-10004')).toBe(false);
        expect(errorHandler.handleError).toHaveBeenCalledWith(
          'Array size limit exceeded',
          expect.objectContaining({
            limit: 10000,
            current: 10001,
          }),
          'ArrayIterationResolver',
          ErrorCodes.MEMORY_LIMIT
        );
      });

      it('should handle clothing access gracefully when trace and error handler are absent', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace: null, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          entityId: 'trace-less-entity',
          mode: 'topmost',
        };

        const bareResolver = createArrayIterationResolver();
        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = bareResolver.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should skip trace logging when service runs without trace context', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace: null, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          entityId: 'trace-skipped',
          mode: 'base',
        };

        mockClothingAccessibilityService.getAccessibleItems.mockReturnValue(['cap']);
        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolver.resolve(node, ctx);

        expect(result).toEqual(new Set(['cap']));
        expect(mockClothingAccessibilityService.getAccessibleItems).toHaveBeenCalled();
      });

      it('should suppress trace and error reporting when service throws without handlers', () => {
        const node = {
          type: 'ArrayIterationStep',
          parent: { type: 'Step' },
        };
        const actorEntity = createTestEntity('test-actor', {
          'core:actor': {},
        });
        const ctx = { dispatcher, trace: null, actorEntity };

        const clothingAccess = {
          __isClothingAccessObject: true,
          entityId: 'error-no-handlers',
          mode: 'topmost',
        };

        const service = {
          getAccessibleItems: jest.fn(() => {
            throw new Error('service exploded');
          }),
        };
        const resolverWithoutHandlers = createArrayIterationResolver({
          clothingAccessibilityService: service,
        });

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolverWithoutHandlers.resolve(node, ctx);

        expect(result).toEqual(new Set());
      });

      it('should enforce the clothing size limit even without an error handler', () => {
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
          entityId: 'no-handler-entity',
          mode: 'topmost',
        };

        const largeResult = Array.from({ length: 10005 }, (_, index) => `item-${index}`);
        const service = {
          getAccessibleItems: jest.fn(() => largeResult),
        };
        const resolverWithoutErrorHandler = createArrayIterationResolver({
          clothingAccessibilityService: service,
        });

        dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const result = resolverWithoutErrorHandler.resolve(node, ctx);

        expect(result.size).toBe(10000);
        expect(result.has('item-10004')).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    let resolverWithErrorHandler;

    beforeEach(() => {
      resolverWithErrorHandler = createArrayIterationResolver({ errorHandler });
    });

    it('should handle error handler in constructor', () => {
      // Should not throw when creating with error handler
      expect(() =>
        createArrayIterationResolver({ errorHandler })
      ).not.toThrow();
    });

    it('should work without error handler (backward compatibility)', () => {
      const resolverNoHandler = createArrayIterationResolver();
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set([['item1', 'item2']]));

      expect(() => resolverNoHandler.resolve(node, ctx)).not.toThrow();
    });

    it('should report error for arrays exceeding MAX_ARRAY_SIZE', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Create a large array (10001 items)
      const largeArray = Array.from({ length: 10001 }, (_, i) => `item${i}`);
      dispatcher.resolve.mockReturnValue(new Set([largeArray]));

      const result = resolverWithErrorHandler.resolve(node, ctx);

      // Should still process the array
      expect(result.size).toBe(10001);

      // Should report the error
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Array size 10001 exceeds limit 10000',
        }),
        expect.objectContaining({ arraySize: 10001 }),
        'ArrayIterationResolver',
        ErrorCodes.MEMORY_LIMIT
      );
    });

    it('should still flatten large arrays when no error handler is provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const largeArray = Array.from({ length: 10001 }, (_, i) => `item${i}`);
      const resolverWithoutHandler = createArrayIterationResolver();
      dispatcher.resolve.mockReturnValue(new Set([largeArray]));

      const result = resolverWithoutHandler.resolve(node, ctx);

      expect(result.size).toBe(10001);
    });

    it('should report error for non-array values', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step', field: 'someField' }, // Not a special case
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Return non-array values
      dispatcher.resolve.mockReturnValue(
        new Set(['not-an-array', 123, { obj: true }])
      );

      const result = resolverWithErrorHandler.resolve(node, ctx);

      // Result should be empty for non-arrays
      expect(result.size).toBe(0);

      // Should report errors for each non-array value
      expect(errorHandler.handleError).toHaveBeenCalledTimes(3);
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Expected array but got string',
        }),
        expect.objectContaining({
          actualType: 'string',
          value: 'not-an-array',
        }),
        'ArrayIterationResolver',
        ErrorCodes.DATA_TYPE_MISMATCH
      );
    });

    it('should silently skip non-array values when no error handler is provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step', field: 'someField' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      const resolverWithoutHandler = createArrayIterationResolver();
      dispatcher.resolve.mockReturnValue(new Set(['not-an-array']));

      const result = resolverWithoutHandler.resolve(node, ctx);

      expect(result.size).toBe(0);
    });

    it('should not report error for special Source node cases', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Source' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Return non-array values from Source node
      dispatcher.resolve.mockReturnValue(new Set(['entity1', 'entity2']));

      const result = resolverWithErrorHandler.resolve(node, ctx);

      // Should pass through entity IDs
      expect(result).toEqual(new Set(['entity1', 'entity2']));

      // Should not report errors for Source node pass-through
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should handle service unavailable when no service provided', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Create a clothing access object
      const clothingAccess = {
        __isClothingAccessObject: true,
        entityId: 'test-entity',
        mode: 'topmost',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolverWithErrorHandler.resolve(node, ctx);

      // Should handle the lack of service and report error
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        'Clothing accessibility service not available',
        expect.objectContaining({ 
          context: 'processClothingAccess',
          entityId: 'test-entity',
          mode: 'topmost'
        }),
        'ArrayIterationResolver',
        ErrorCodes.SERVICE_NOT_FOUND
      );

      // Result should be empty since no service available
      expect(result.size).toBe(0);
    });

    it('should handle null and undefined in arrays without errors', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(
        new Set([['item1', null, 'item2', undefined, 'item3']])
      );

      const result = resolverWithErrorHandler.resolve(node, ctx);

      // Should filter out null and undefined
      expect(result).toEqual(new Set(['item1', 'item2', 'item3']));

      // Should not report errors for null/undefined in arrays
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should handle empty arrays without errors', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set([[], [], []]));

      const result = resolverWithErrorHandler.resolve(node, ctx);

      expect(result).toEqual(new Set());
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should handle mixed type arrays appropriately', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      // Mix of arrays and non-arrays
      dispatcher.resolve.mockReturnValue(
        new Set([
          ['item1', 'item2'],
          'not-an-array',
          ['item3'],
          null,
          undefined,
        ])
      );

      const result = resolverWithErrorHandler.resolve(node, ctx);

      // Should process arrays and skip non-arrays
      expect(result).toEqual(new Set(['item1', 'item2', 'item3']));

      // Should report error only for the non-null, non-undefined, non-array value
      expect(errorHandler.handleError).toHaveBeenCalledTimes(1);
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Expected array but got string',
        }),
        expect.objectContaining({ actualType: 'string' }),
        'ArrayIterationResolver',
        ErrorCodes.DATA_TYPE_MISMATCH
      );
    });

    it('should pass through values when parent is another ArrayIterationStep', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'ArrayIterationStep' },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set(['entity-a', null, 'entity-b']));

      const result = resolverWithErrorHandler.resolve(node, ctx);

      expect(result).toEqual(new Set(['entity-a', 'entity-b']));
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should pass through entity values when parent step targets entities()', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: {
          type: 'Step',
          field: 'entities',
          param: { component: 'core:actor' },
        },
      };
      const actorEntity = createTestEntity('test-actor', { 'core:actor': {} });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set(['npc-1', null, 'npc-2']));

      const result = resolverWithErrorHandler.resolve(node, ctx);

      expect(result).toEqual(new Set(['npc-1', 'npc-2']));
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
  });
});
