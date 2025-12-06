/**
 * @file Unit tests for coverage blocking integration in ArrayIterationResolver
 * @description Tests the integration of coverage analyzer to prevent access to blocked clothing items.
 * Coverage blocking only applies to visibility-based modes (topmost) where accessibility matters,
 * not to inventory-based modes (all) where all items should be returned regardless of accessibility.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import createArrayIterationResolver from '../../../../src/scopeDsl/nodes/arrayIterationResolver.js';
import { createTestEntity } from '../../../common/mockFactories/entities.js';

describe('ArrayIterationResolver - Coverage Blocking Integration', () => {
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

  describe('Coverage blocking in topmost mode', () => {
    it('should delegate coverage blocking to service (Layla Agirre scenario)', () => {
      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('layla-agirre', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      const clothingAccess = {
        __isClothingAccessObject: true,
        entityId: 'layla-agirre',
        mode: 'topmost',
      };

      // Service should apply coverage blocking internally and return only accessible items
      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
        'asudem:trousers', // Only returns trousers, boxer brief is blocked by service
      ]);

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).toHaveBeenCalledWith(
        'layla-agirre',
        expect.objectContaining({
          mode: 'topmost',
          context: 'removal',
          sortByPriority: true,
        })
      );

      // Should only return trousers, boxer brief was blocked by service
      expect(result).toEqual(new Set(['asudem:trousers']));
    });

    it('should handle service not available gracefully', () => {
      // Create resolver without service
      const resolverWithoutService = createArrayIterationResolver({
        errorHandler,
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
        entityId: 'test-actor',
        mode: 'topmost',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolverWithoutService.resolve(node, ctx);

      // Without service, should return empty result and log error
      expect(result).toEqual(new Set());
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        'Clothing accessibility service not available',
        expect.objectContaining({
          context: 'processClothingAccess',
          entityId: 'test-actor',
          mode: 'topmost',
        }),
        'ArrayIterationResolver',
        expect.any(String)
      );
    });

    it('should handle service errors gracefully', () => {
      mockClothingAccessibilityService.getAccessibleItems.mockImplementation(
        () => {
          throw new Error('Coverage analysis failed');
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
        entityId: 'test-actor',
        mode: 'topmost',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Should return empty set due to service error
      expect(result).toEqual(new Set());
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Coverage analysis failed',
        }),
        expect.objectContaining({
          context: 'processClothingAccess',
          entityId: 'test-actor',
          mode: 'topmost',
        }),
        'ArrayIterationResolver',
        expect.any(String)
      );
    });

    it('should handle non-overlapping items correctly through service', () => {
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
        entityId: 'test-actor',
        mode: 'topmost',
      };

      // Service returns all items as they don't overlap
      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
        'jacket',
        'pants',
        'underwear',
      ]);

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // All items should be accessible as service determined no blocking needed
      expect(result).toEqual(new Set(['jacket', 'pants', 'underwear']));
    });
  });

  describe('All mode behavior (service handles coverage)', () => {
    it('should delegate all mode behavior to service', () => {
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
        entityId: 'test-actor',
        mode: 'all',
      };

      // Service returns all items for 'all' mode
      mockClothingAccessibilityService.getAccessibleItems.mockReturnValue([
        'jacket',
        'shirt',
        'pants',
        'underwear',
      ]);

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      expect(
        mockClothingAccessibilityService.getAccessibleItems
      ).toHaveBeenCalledWith(
        'test-actor',
        expect.objectContaining({
          mode: 'all',
          context: 'removal',
          sortByPriority: true,
        })
      );

      expect(result).toEqual(
        new Set(['jacket', 'shirt', 'pants', 'underwear'])
      );
    });
  });
});
