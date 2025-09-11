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

  describe('Coverage blocking in topmost mode', () => {
    it('should block underwear when covered by base layer (Layla Agirre scenario)', () => {
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

      // Mock coverage mapping data for trousers and boxer brief
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

      // Should only return trousers, boxer brief should be blocked
      expect(result).toEqual(new Set(['asudem:trousers']));
      expect(trace.addStep).toHaveBeenCalledWith(
        expect.stringContaining('Coverage blocking: asudem:boxer_brief blocked')
      );
    });

    it('should return all items when coverage analyzer is not available', () => {
      // Create resolver without entitiesGateway (no coverage analyzer)
      resolver = createArrayIterationResolver({ errorHandler });

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
          legs: {
            base: 'trousers',
          },
          groin: {
            underwear: 'boxer_brief',
          },
        },
        mode: 'topmost',
        entityId: 'test-actor',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Without coverage analyzer, both items should be returned (following layer priority)
      expect(result).toEqual(new Set(['trousers', 'boxer_brief']));
    });

    it('should handle coverage analysis failure gracefully', () => {
      // Create resolver with entities gateway that throws error
      entitiesGateway.getComponentData.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

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
            outer: 'jacket',
            base: 'shirt',
          },
        },
        mode: 'topmost',
        entityId: 'test-actor',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Should fall back to no coverage blocking
      // In topmost mode, we get only the topmost item from each slot (jacket from torso)
      expect(result).toEqual(new Set(['jacket']));
      // Error handling occurs internally, may or may not log to trace
      // The important thing is it doesn't throw and falls back gracefully
    });

    it('should not block items that cover different body areas', () => {
      resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      // Mock coverage mapping data for non-overlapping items
      entitiesGateway.getComponentData.mockImplementation((itemId, componentId) => {
        if (componentId === 'clothing:coverage_mapping') {
          if (itemId === 'jacket') {
            return {
              covers: ['torso', 'arms'],
              coveragePriority: 'outer',
            };
          } else if (itemId === 'pants') {
            return {
              covers: ['legs'],
              coveragePriority: 'base',
            };
          } else if (itemId === 'underwear') {
            return {
              covers: ['groin'],
              coveragePriority: 'underwear',
            };
          }
        }
        return null;
      });

      const clothingAccess = {
        __isClothingAccessObject: true,
        equipped: {
          torso: {
            outer: 'jacket',
          },
          legs: {
            base: 'pants',
          },
          groin: {
            underwear: 'underwear',
          },
        },
        mode: 'topmost',
        entityId: 'test-actor',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // All items should be accessible as they don't overlap
      expect(result).toEqual(new Set(['jacket', 'pants', 'underwear']));
    });
  });

  describe('All mode behavior (no coverage blocking)', () => {
    it('should return all items without coverage blocking in all mode', () => {
      resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      // Mock coverage mapping data (should not be called in 'all' mode)
      entitiesGateway.getComponentData.mockImplementation((itemId, componentId) => {
        if (componentId === 'clothing:coverage_mapping') {
          if (itemId === 'coat') {
            return {
              covers: ['torso', 'arms'],
              coveragePriority: 'outer',
            };
          } else if (itemId === 'shirt') {
            return {
              covers: ['torso'],
              coveragePriority: 'base',
            };
          } else if (itemId === 'undershirt') {
            return {
              covers: ['torso'],
              coveragePriority: 'underwear',
            };
          }
        }
        return null;
      });

      const clothingAccess = {
        __isClothingAccessObject: true,
        equipped: {
          torso: {
            outer: 'coat',
            base: 'shirt',
            underwear: 'undershirt',
          },
        },
        mode: 'all',
        entityId: 'test-actor',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // All items should be returned without coverage blocking in 'all' mode
      expect(result).toEqual(new Set(['coat', 'shirt', 'undershirt']));
      // Coverage analysis should not run for 'all' mode
      expect(entitiesGateway.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should work with clothing access objects without entityId', () => {
      resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

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
            outer: 'jacket',
            base: 'shirt',
          },
        },
        mode: 'topmost',
        // No entityId provided
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Without entityId, coverage analysis is skipped
      // In topmost mode, we get only the topmost item from each slot (jacket from torso)
      expect(result).toEqual(new Set(['jacket']));
      expect(entitiesGateway.getComponentData).not.toHaveBeenCalled();
    });

    it('should handle partial coverage data gracefully', () => {
      resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      // Mock partial coverage mapping data (some items have data, some don't)
      entitiesGateway.getComponentData.mockImplementation((itemId, componentId) => {
        if (componentId === 'clothing:coverage_mapping') {
          if (itemId === 'jacket') {
            return {
              covers: ['torso'],
              coveragePriority: 'outer',
            };
          }
          // shirt has no coverage mapping data
        }
        return null;
      });

      const clothingAccess = {
        __isClothingAccessObject: true,
        equipped: {
          torso: {
            outer: 'jacket',
            base: 'shirt',
          },
        },
        mode: 'topmost',
        entityId: 'test-actor',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Jacket should be accessible, shirt uses fallback coverage and is blocked
      expect(result).toEqual(new Set(['jacket']));
    });
  });

  describe('Performance considerations', () => {
    it('should perform coverage analysis efficiently for topmost mode', () => {
      resolver = createArrayIterationResolver({ entitiesGateway, errorHandler });

      const node = {
        type: 'ArrayIterationStep',
        parent: { type: 'Step' },
      };
      const actorEntity = createTestEntity('test-actor', {
        'core:actor': {},
      });
      const ctx = { dispatcher, trace, actorEntity };

      entitiesGateway.getComponentData.mockReturnValue({
        covers: ['torso'],
        coveragePriority: 'base',
      });

      const clothingAccess = {
        __isClothingAccessObject: true,
        equipped: {
          torso: { outer: 'jacket1', base: 'shirt1' },
          arms: { base: 'sleeves1' },
          legs: { base: 'pants1' },
          feet: { base: 'shoes1' },
        },
        mode: 'topmost',
        entityId: 'test-actor',
      };

      dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const result = resolver.resolve(node, ctx);

      // Should get only topmost items in topmost mode
      expect(result.size).toBe(4); // jacket1, sleeves1, pants1, shoes1

      // Count calls to getComponentData to verify coverage analysis runs
      const componentDataCalls = entitiesGateway.getComponentData.mock.calls.length;
      // Should be called for coverage mapping analysis in topmost mode
      expect(componentDataCalls).toBeGreaterThan(0);
    });
  });
});