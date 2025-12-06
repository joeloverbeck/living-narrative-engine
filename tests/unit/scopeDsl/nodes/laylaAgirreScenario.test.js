/**
 * @file Specific test for the Layla Agirre coverage blocking scenario
 * @description Validates that the bug where boxer brief incorrectly shows as removable is fixed
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import createArrayIterationResolver from '../../../../src/scopeDsl/nodes/arrayIterationResolver.js';
import { createTestEntity } from '../../../common/mockFactories/entities.js';

describe('Layla Agirre Scenario - Coverage Blocking', () => {
  let resolver;
  let dispatcher;
  let trace;
  let errorHandler;
  let clothingAccessibilityService;

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
    clothingAccessibilityService = {
      getAccessibleItems: jest.fn(),
    };
  });

  it('should only return trousers when boxer brief is covered (Layla Agirre bug fix)', () => {
    // Create resolver with coverage analyzer support
    resolver = createArrayIterationResolver({
      clothingAccessibilityService,
      errorHandler,
    });

    const node = {
      type: 'ArrayIterationStep',
      parent: { type: 'Step' },
    };
    const actorEntity = createTestEntity('layla-agirre', {
      'core:actor': {},
    });
    const ctx = { dispatcher, trace, actorEntity };

    // Mock clothing accessibility service to implement coverage blocking logic
    // In topmost mode, trousers block access to boxer brief underneath
    clothingAccessibilityService.getAccessibleItems.mockImplementation(
      (entityId, options) => {
        if (entityId === 'layla-agirre' && options.mode === 'topmost') {
          // Only trousers are accessible - boxer brief is blocked by coverage
          return ['asudem:trousers'];
        }
        return [];
      }
    );

    // Simulate the exact clothing configuration from the bug report
    const clothingAccess = {
      __isClothingAccessObject: true,
      equipped: {
        legs: {
          base: 'asudem:trousers', // Base layer item
        },
        groin: {
          underwear: 'asudem:boxer_brief', // Underwear layer item
        },
      },
      mode: 'topmost', // Topmost mode should only return accessible items
      entityId: 'layla-agirre',
    };

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(node, ctx);

    // CRITICAL ASSERTION: Only trousers should be returned
    // The boxer brief should be blocked by the trousers coverage
    expect(result).toEqual(new Set(['asudem:trousers']));
    expect(result).not.toContain('asudem:boxer_brief');

    // Verify the service was called correctly
    expect(
      clothingAccessibilityService.getAccessibleItems
    ).toHaveBeenCalledWith(
      'layla-agirre',
      expect.objectContaining({
        mode: 'topmost',
        context: 'removal',
        sortByPriority: true,
      })
    );

    // Verify trace logging from service interaction
    expect(trace.addStep).toHaveBeenCalledWith(
      'Retrieved 1 accessible items for mode: topmost'
    );
  });

  it('should return boxer brief when trousers are removed', () => {
    // Create resolver with coverage analyzer support
    resolver = createArrayIterationResolver({
      clothingAccessibilityService,
      errorHandler,
    });

    const node = {
      type: 'ArrayIterationStep',
      parent: { type: 'Step' },
    };
    const actorEntity = createTestEntity('layla-agirre', {
      'core:actor': {},
    });
    const ctx = { dispatcher, trace, actorEntity };

    // Mock clothing accessibility service for scenario without trousers
    clothingAccessibilityService.getAccessibleItems.mockImplementation(
      (entityId, options) => {
        if (entityId === 'layla-agirre' && options.mode === 'topmost') {
          // Only boxer brief is accessible now
          return ['asudem:boxer_brief'];
        }
        return [];
      }
    );

    // Simulate clothing configuration after trousers are removed
    const clothingAccess = {
      __isClothingAccessObject: true,
      equipped: {
        groin: {
          underwear: 'asudem:boxer_brief', // Only underwear remains
        },
      },
      mode: 'topmost',
      entityId: 'layla-agirre',
    };

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(node, ctx);

    // Now boxer brief should be accessible
    expect(result).toEqual(new Set(['asudem:boxer_brief']));
  });

  it('should return empty array when clothingAccessibilityService is not provided', () => {
    // Create resolver WITHOUT clothing accessibility service
    resolver = createArrayIterationResolver({ errorHandler });

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
      equipped: {
        legs: {
          base: 'asudem:trousers',
        },
        groin: {
          underwear: 'asudem:boxer_brief',
        },
      },
      mode: 'topmost',
      entityId: 'layla-agirre',
    };

    dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

    const result = resolver.resolve(node, ctx);

    // Without clothing accessibility service, empty array is returned
    expect(result).toEqual(new Set());

    // Verify appropriate trace message was logged
    expect(trace.addStep).toHaveBeenCalledWith(
      'No clothing accessibility service available, returning empty array'
    );
  });
});
