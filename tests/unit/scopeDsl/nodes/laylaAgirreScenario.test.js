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
  let entitiesGateway;

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

    // Mock entities gateway
    entitiesGateway = {
      getComponentData: jest.fn(),
    };
  });

  it('should only return trousers when boxer brief is covered (Layla Agirre bug fix)', () => {
    // Create resolver with coverage analyzer support
    resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

    const node = {
      type: 'ArrayIterationStep',
      parent: { type: 'Step' },
    };
    const actorEntity = createTestEntity('layla-agirre', {
      'core:actor': {},
    });
    const ctx = { dispatcher, trace, actorEntity };

    // Mock coverage mapping data
    // Trousers: base layer covering legs and groin
    // Boxer brief: underwear layer covering groin
    entitiesGateway.getComponentData.mockImplementation((itemId, componentId) => {
      if (componentId === 'clothing:coverage_mapping') {
        if (itemId === 'asudem:trousers') {
          return {
            covers: ['legs', 'groin'],
            coveragePriority: 'base',
          };
        } else if (itemId === 'asudem:boxer_brief') {
          return {
            covers: ['groin'],
            coveragePriority: 'underwear',
          };
        }
      }
      return null;
    });

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
    
    // Verify the blocking was logged
    expect(trace.addStep).toHaveBeenCalledWith(
      expect.stringContaining('Coverage blocking: asudem:boxer_brief blocked')
    );
  });

  it('should return both items when trousers are removed', () => {
    // Create resolver with coverage analyzer support
    resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

    const node = {
      type: 'ArrayIterationStep',
      parent: { type: 'Step' },
    };
    const actorEntity = createTestEntity('layla-agirre', {
      'core:actor': {},
    });
    const ctx = { dispatcher, trace, actorEntity };

    // Mock coverage mapping data for boxer brief only
    entitiesGateway.getComponentData.mockImplementation((itemId, componentId) => {
      if (componentId === 'clothing:coverage_mapping') {
        if (itemId === 'asudem:boxer_brief') {
          return {
            covers: ['groin'],
            coveragePriority: 'underwear',
          };
        }
      }
      return null;
    });

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

  it('should work without coverage blocking when entitiesGateway is not provided', () => {
    // Create resolver WITHOUT coverage analyzer support
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

    // Without coverage analyzer, both items are returned
    // This demonstrates backward compatibility
    expect(result).toEqual(new Set(['asudem:trousers', 'asudem:boxer_brief']));
  });
});