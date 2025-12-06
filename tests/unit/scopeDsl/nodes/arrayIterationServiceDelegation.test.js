/**
 * @file Unit tests for ArrayIterationResolver service delegation
 * @description Tests the new ClothingAccessibilityService delegation functionality
 * added as part of CLOREMLOG-005-06 refactoring.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import createArrayIterationResolver from '../../../../src/scopeDsl/nodes/arrayIterationResolver.js';
import { createTestEntity } from '../../../common/mockFactories/entities.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('ArrayIterationResolver - Service Delegation', () => {
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

  describe('Service delegation', () => {
    it('should delegate clothing queries to service with correct parameters', () => {
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
        mode: 'topmost',
      };

      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
        'item1',
        'item2',
      ]);

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).toHaveBeenCalledWith(
        'test-entity',
        expect.objectContaining({
          mode: 'topmost',
          context: 'removal',
          sortByPriority: true,
        })
      );

      expect(result).toEqual(new Set(['item1', 'item2']));
    });

    it('should maintain existing API contract', () => {
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
        mode: 'all',
      };

      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
        'jacket',
        'shirt',
        'pants',
      ]);

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Result should be a Set as before
      expect(result).toBeInstanceOf(Set);
      expect(result).toEqual(new Set(['jacket', 'shirt', 'pants']));
    });

    it('should handle multiple clothing access objects', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      const clothingAccess1 = {
        __isClothingAccessObject: true,
        entityId: 'entity1',
        mode: 'topmost',
      };

      const clothingAccess2 = {
        __isClothingAccessObject: true,
        entityId: 'entity2',
        mode: 'base',
      };

      mockClothingAccessibilityService.getAccessibleItems
        .mockReturnValueOnce(['item1', 'item2'])
        .mockReturnValueOnce(['item3', 'item4']);

      dispatcher.resolve.mockReturnValue(
        new Set([clothingAccess1, clothingAccess2])
      );

      const result = resolver.resolve(node, ctx);

      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).toHaveBeenCalledTimes(2);
      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).toHaveBeenNthCalledWith(
        1,
        'entity1',
        expect.objectContaining({ mode: 'topmost' })
      );
      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).toHaveBeenNthCalledWith(
        2,
        'entity2',
        expect.objectContaining({ mode: 'base' })
      );

      expect(result).toEqual(new Set(['item1', 'item2', 'item3', 'item4']));
    });

    it('should add trace steps when service is called', () => {
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
        mode: 'topmost',
      };

      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
        'item1',
        'item2',
      ]);

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      resolver.resolve(node, ctx);

      expect(trace.addStep).toHaveBeenCalledWith(
        'Retrieved 2 accessible items for mode: topmost'
      );
    });
  });

  describe('Service not available scenarios', () => {
    it('should handle service not available gracefully', () => {
      const resolverWithoutService = createArrayIterationResolver({
        clothingAccessibilityService: null,
        errorHandler: errorHandler,
      });

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
        mode: 'topmost',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolverWithoutService.resolve(node, ctx);

      expect(errorHandler.handleError).toHaveBeenCalledWith(
        'Clothing accessibility service not available',
        expect.objectContaining({
          context: 'processClothingAccess',
          entityId: 'test-entity',
          mode: 'topmost',
        }),
        'ArrayIterationResolver',
        ErrorCodes.SERVICE_NOT_FOUND
      );

      expect(result).toEqual(new Set());
    });

    it('should add trace step when service not available', () => {
      const resolverWithoutService = createArrayIterationResolver({
        clothingAccessibilityService: null,
        errorHandler: errorHandler,
      });

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
        mode: 'topmost',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      resolverWithoutService.resolve(node, ctx);

      expect(trace.addStep).toHaveBeenCalledWith(
        'No clothing accessibility service available, returning empty array'
      );
    });
  });

  describe('Service error scenarios', () => {
    it('should handle service errors and return empty array', () => {
      mockClothingAccessibilityService.getAccessibleItems.mockImplementation(
        () => {
          throw new Error('Service connection failed');
        }
      );

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
        mode: 'topmost',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service connection failed',
        }),
        expect.objectContaining({
          context: 'processClothingAccess',
          entityId: 'test-entity',
          mode: 'topmost',
        }),
        'ArrayIterationResolver',
        ErrorCodes.CLOTHING_ACCESS_FAILED
      );

      expect(result).toEqual(new Set());
    });

    it('should add trace step when service fails', () => {
      mockClothingAccessibilityService.getAccessibleItems.mockImplementation(
        () => {
          throw new Error('Database timeout');
        }
      );

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
        mode: 'topmost',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      resolver.resolve(node, ctx);

      expect(trace.addStep).toHaveBeenCalledWith(
        'Clothing access failed: Database timeout'
      );
    });

    it('should continue processing other items when one service call fails', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      const clothingAccess1 = {
        __isClothingAccessObject: true,
        entityId: 'entity1',
        mode: 'topmost',
      };

      const clothingAccess2 = {
        __isClothingAccessObject: true,
        entityId: 'entity2',
        mode: 'topmost',
      };

      const regularArray = ['regular-item'];

      mockClothingAccessibilityService.getAccessibleItems
        .mockImplementationOnce(() => {
          throw new Error('Service failed');
        })
        .mockReturnValueOnce(['item2']);

      dispatcher.resolve.mockReturnValue(
        new Set([clothingAccess1, clothingAccess2, regularArray])
      );

      const result = resolver.resolve(node, ctx);

      // Should get items from successful service call and regular array
      expect(result).toEqual(new Set(['item2', 'regular-item']));
      expect(errorHandler.handleError).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backward compatibility', () => {
    it('should work without any dependencies (backward compatibility)', () => {
      const resolverCompatible = createArrayIterationResolver();

      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(new Set([['item1', 'item2']]));

      const result = resolverCompatible.resolve(node, ctx);

      expect(result).toEqual(new Set(['item1', 'item2']));
    });

    it('should process regular arrays unchanged', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      dispatcher.resolve.mockReturnValue(
        new Set([
          ['array1-item1', 'array1-item2'],
          ['array2-item1', 'array2-item2'],
        ])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(
        new Set([
          'array1-item1',
          'array1-item2',
          'array2-item1',
          'array2-item2',
        ])
      );

      // Service should not be called for regular arrays
      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).not.toHaveBeenCalled();
    });

    it('should handle mixed clothing and regular arrays correctly', () => {
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
        mode: 'topmost',
      };

      const regularArray = ['regular1', 'regular2'];

      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
        'clothing1',
        'clothing2',
      ]);

      dispatcher.resolve.mockReturnValue(
        new Set([clothingAccess, regularArray])
      );

      const result = resolver.resolve(node, ctx);

      expect(result).toEqual(
        new Set(['clothing1', 'clothing2', 'regular1', 'regular2'])
      );

      // Service should be called once for clothing access
      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('Array size limits with service', () => {
    it('should respect MAX_ARRAY_SIZE limit when service returns many items', () => {
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
        mode: 'all',
      };

      // Return more than MAX_ARRAY_SIZE items
      const manyItems = Array.from({ length: 10001 }, (_, i) => `item${i}`);
      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue(
        manyItems
      );

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Should stop adding items after limit and report error
      expect(result.size).toBeLessThanOrEqual(10000);
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        'Array size limit exceeded',
        expect.objectContaining({
          limit: 10000,
          current: expect.any(Number),
        }),
        'ArrayIterationResolver',
        ErrorCodes.MEMORY_LIMIT
      );
    });
  });
});
