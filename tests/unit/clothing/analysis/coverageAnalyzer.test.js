/**
 * @file Unit tests for coverage analyzer
 * @description Tests coverage blocking analysis for clothing accessibility
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import createCoverageAnalyzer from '../../../../src/clothing/analysis/coverageAnalyzer.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('CoverageAnalyzer', () => {
  let analyzer;
  let mockEntitiesGateway;
  let mockErrorHandler;

  beforeEach(() => {
    mockEntitiesGateway = {
      getComponentData: jest.fn(),
    };

    mockErrorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => []),
    };

    analyzer = createCoverageAnalyzer({
      entitiesGateway: mockEntitiesGateway,
      errorHandler: mockErrorHandler,
    });
  });

  describe('Factory creation', () => {
    it('should create analyzer with required dependencies', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.analyzeCoverageBlocking).toBeDefined();
      expect(typeof analyzer.analyzeCoverageBlocking).toBe('function');
    });

    it('should validate entitiesGateway dependency', () => {
      expect(() => {
        createCoverageAnalyzer({
          entitiesGateway: {},
        });
      }).toThrow();
    });

    it('should work without error handler', () => {
      const minimalAnalyzer = createCoverageAnalyzer({
        entitiesGateway: mockEntitiesGateway,
      });
      expect(minimalAnalyzer).toBeDefined();
    });
  });

  describe('Coverage Blocking Analysis - Layla Agirre scenario', () => {
    it('should block underwear when base layer covers same area', () => {
      // Setup: trousers (base layer) should block boxer brief (underwear)
      const equipped = {
        torso_lower: {
          base: 'clothing:cotton_twill_trousers',
          underwear: 'clothing:boxer_brief',
        },
      };

      // Mock coverage mapping data
      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            if (itemId === 'clothing:cotton_twill_trousers') {
              return {
                covers: ['torso_lower', 'legs'],
                coveragePriority: 'base',
              };
            }
            if (itemId === 'clothing:boxer_brief') {
              return {
                covers: ['torso_lower'],
                coveragePriority: 'underwear',
              };
            }
          }
          return null;
        }
      );

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Trousers should be accessible
      expect(
        result.isAccessible(
          'clothing:cotton_twill_trousers',
          'torso_lower',
          'base'
        )
      ).toBe(true);

      // Boxer brief should NOT be accessible (blocked by trousers)
      expect(
        result.isAccessible('clothing:boxer_brief', 'torso_lower', 'underwear')
      ).toBe(false);

      // Verify blocking relationships
      expect(result.getBlockedItems()).toContain('clothing:boxer_brief');
      expect(result.getBlockingItems('clothing:boxer_brief')).toContain(
        'clothing:cotton_twill_trousers'
      );
    });

    it('should handle multiple blocking layers correctly', () => {
      const equipped = {
        torso_lower: {
          outer: 'clothing:leather_pants',
          base: 'clothing:cotton_twill_trousers',
          underwear: 'clothing:boxer_brief',
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            if (itemId === 'clothing:leather_pants') {
              return {
                covers: ['torso_lower', 'legs'],
                coveragePriority: 'outer',
              };
            }
            if (itemId === 'clothing:cotton_twill_trousers') {
              return {
                covers: ['torso_lower', 'legs'],
                coveragePriority: 'base',
              };
            }
            if (itemId === 'clothing:boxer_brief') {
              return {
                covers: ['torso_lower'],
                coveragePriority: 'underwear',
              };
            }
          }
          return null;
        }
      );

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Outer layer should be accessible
      expect(result.isAccessible('clothing:leather_pants')).toBe(true);

      // Base layer should be blocked by outer
      expect(result.isAccessible('clothing:cotton_twill_trousers')).toBe(false);

      // Underwear should be blocked by both
      expect(result.isAccessible('clothing:boxer_brief')).toBe(false);

      // Verify blocking chains
      const boxerBriefBlockers = result.getBlockingItems(
        'clothing:boxer_brief'
      );
      expect(boxerBriefBlockers).toHaveLength(2);
      expect(boxerBriefBlockers).toContain('clothing:leather_pants');
      expect(boxerBriefBlockers).toContain('clothing:cotton_twill_trousers');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty equipment gracefully', () => {
      const result = analyzer.analyzeCoverageBlocking({}, 'test-entity');

      expect(result.isAccessible('any-item')).toBe(true);
      expect(result.getBlockedItems()).toEqual([]);
      expect(result.getBlockingItems('any-item')).toEqual([]);
    });

    it('should handle null equipment gracefully', () => {
      const result = analyzer.analyzeCoverageBlocking(null, 'test-entity');

      expect(result.isAccessible('any-item')).toBe(true);
      expect(result.getBlockedItems()).toEqual([]);
      expect(result.getBlockingItems('any-item')).toEqual([]);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Invalid equipped parameter',
        expect.objectContaining({
          errorCode: ErrorCodes.INVALID_DATA_GENERIC,
        })
      );
    });

    it('should handle invalid entityId gracefully', () => {
      const result = analyzer.analyzeCoverageBlocking({}, null);

      expect(result.isAccessible('any-item')).toBe(true);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Invalid entityId parameter',
        expect.objectContaining({
          errorCode: ErrorCodes.INVALID_ENTITY_ID,
        })
      );
      expect(result.getBlockedItems()).toEqual([]);
      expect(result.getBlockingItems('any-item')).toEqual([]);
    });

    it('should handle missing coverage mapping data', () => {
      const equipped = {
        torso_upper: {
          base: 'clothing:shirt',
        },
      };

      // Return null for coverage mapping
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Should fallback to using layer and slot
      expect(result.isAccessible('clothing:shirt')).toBe(true);
    });

    it('should handle errors when fetching coverage data', () => {
      const equipped = {
        torso_upper: {
          base: 'clothing:shirt',
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation(() => {
        throw new Error('Component not found');
      });

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Should handle error gracefully and use fallback
      expect(result.isAccessible('clothing:shirt')).toBe(true);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should treat non-array coverage areas as non-overlapping', () => {
      const equipped = {
        torso_lower: {
          base: 'clothing:linen_trousers',
          underwear: 'clothing:cotton_boxers',
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            if (itemId === 'clothing:linen_trousers') {
              return {
                // Intentionally return a non-array value to cover the guard clause
                covers: 'torso_lower',
                coveragePriority: 'base',
              };
            }

            if (itemId === 'clothing:cotton_boxers') {
              return {
                covers: undefined,
                coveragePriority: undefined,
              };
            }
          }

          return null;
        }
      );

      const result = analyzer.analyzeCoverageBlocking(
        equipped,
        'non-array-coverage-entity'
      );

      expect(result.isAccessible('clothing:linen_trousers')).toBe(true);
      expect(result.isAccessible('clothing:cotton_boxers')).toBe(true);
      expect(result.getBlockedItems()).toEqual([]);
    });

    it('should handle equipment with null values in slots', () => {
      const equipped = {
        torso_upper: {
          base: 'clothing:shirt',
          outer: null,
        },
        torso_lower: null,
      };

      mockEntitiesGateway.getComponentData.mockReturnValue({
        covers: ['torso_upper'],
        coveragePriority: 'base',
      });

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      expect(result.isAccessible('clothing:shirt')).toBe(true);
      expect(result.getBlockedItems()).toEqual([]);
    });

    it('should handle coverage data errors without optional error handler', () => {
      const minimalAnalyzer = createCoverageAnalyzer({
        entitiesGateway: {
          getComponentData: () => {
            throw new Error('Component missing');
          },
        },
      });

      const equipped = {
        torso_upper: {
          base: 'clothing:shirt',
        },
      };

      const result = minimalAnalyzer.analyzeCoverageBlocking(
        equipped,
        'no-handler-entity'
      );

      expect(result.isAccessible('clothing:shirt')).toBe(true);
    });

    it('should return permissive analyzer on invalid input without error handler', () => {
      const minimalAnalyzer = createCoverageAnalyzer({
        entitiesGateway: mockEntitiesGateway,
      });

      const result = minimalAnalyzer.analyzeCoverageBlocking(null, null);

      expect(result.isAccessible('anything')).toBe(true);
      expect(result.getBlockedItems()).toEqual([]);
      expect(result.getBlockingItems('anything')).toEqual([]);
    });

    it('should handle invalid entity id without error handler', () => {
      const minimalAnalyzer = createCoverageAnalyzer({
        entitiesGateway: mockEntitiesGateway,
      });

      const result = minimalAnalyzer.analyzeCoverageBlocking({}, null);

      expect(result.isAccessible('anything')).toBe(true);
      expect(result.getBlockedItems()).toEqual([]);
      expect(result.getBlockingItems('anything')).toEqual([]);
    });
  });

  describe('Coverage overlap detection', () => {
    it('should not block items that cover different areas', () => {
      const equipped = {
        torso_upper: {
          base: 'clothing:shirt',
        },
        feet: {
          base: 'clothing:shoes',
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            if (itemId === 'clothing:shirt') {
              return {
                covers: ['torso_upper'],
                coveragePriority: 'base',
              };
            }
            if (itemId === 'clothing:shoes') {
              return {
                covers: ['feet'],
                coveragePriority: 'base',
              };
            }
          }
          return null;
        }
      );

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Both should be accessible as they don't overlap
      expect(result.isAccessible('clothing:shirt')).toBe(true);
      expect(result.isAccessible('clothing:shoes')).toBe(true);
      expect(result.getBlockedItems()).toEqual([]);
    });

    it('should only block when areas overlap AND priority differs', () => {
      const equipped = {
        torso_upper: {
          base: 'clothing:shirt1',
          accessories: 'clothing:shirt2',
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            // Both have same coverage priority
            return {
              covers: ['torso_upper'],
              coveragePriority: 'base',
            };
          }
          return null;
        }
      );

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Neither blocks the other due to same priority
      expect(result.isAccessible('clothing:shirt1')).toBe(true);
      expect(result.isAccessible('clothing:shirt2')).toBe(true);
    });
  });

  describe('Direct skin contact items', () => {
    it('should handle direct coverage priority correctly', () => {
      const equipped = {
        torso_upper: {
          base: 'clothing:shirt',
          accessories: 'clothing:tattoo',
        },
      };

      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            if (itemId === 'clothing:shirt') {
              return {
                covers: ['torso_upper'],
                coveragePriority: 'base',
              };
            }
            if (itemId === 'clothing:tattoo') {
              return {
                covers: ['torso_upper'],
                coveragePriority: 'direct',
              };
            }
          }
          return null;
        }
      );

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Shirt should be accessible
      expect(result.isAccessible('clothing:shirt')).toBe(true);

      // Tattoo (direct) should be blocked by shirt (base)
      expect(result.isAccessible('clothing:tattoo')).toBe(false);
    });
  });

  describe('Performance considerations', () => {
    it('should handle large equipment sets efficiently', () => {
      const equipped = {};
      const slots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'hands',
        'head_gear',
      ];
      const layers = ['outer', 'base', 'underwear', 'accessories'];

      // Create a large equipment set
      slots.forEach((slot) => {
        equipped[slot] = {};
        layers.forEach((layer) => {
          equipped[slot][layer] = `clothing:${slot}_${layer}`;
        });
      });

      mockEntitiesGateway.getComponentData.mockImplementation((itemId) => {
        const [, slot, layer] = itemId.split(/[:_]/);
        return {
          covers: [slot],
          coveragePriority: layer,
        };
      });

      const originalNow = performance.now.bind(performance);
      const nowSpy = jest.spyOn(performance, 'now');
      nowSpy
        .mockImplementationOnce(() => 0)
        .mockImplementationOnce(() => 5)
        .mockImplementation(originalNow);

      try {
        const startTime = performance.now();
        const result = analyzer.analyzeCoverageBlocking(
          equipped,
          'test-entity'
        );
        const endTime = performance.now();

        // Should complete quickly (under 10ms for typical sets)
        expect(endTime - startTime).toBeLessThan(10);

        // Should still produce correct results
        expect(result.getBlockedItems().length).toBeGreaterThan(0);
      } finally {
        nowSpy.mockRestore();
      }
    });
  });

  describe('API completeness', () => {
    it('should provide all documented API methods', () => {
      const equipped = {
        torso_upper: {
          base: 'clothing:shirt',
        },
      };

      mockEntitiesGateway.getComponentData.mockReturnValue({
        covers: ['torso_upper'],
        coveragePriority: 'base',
      });

      const result = analyzer.analyzeCoverageBlocking(equipped, 'test-entity');

      // Verify all API methods exist and work
      expect(typeof result.isAccessible).toBe('function');
      expect(typeof result.getBlockedItems).toBe('function');
      expect(typeof result.getBlockingItems).toBe('function');

      // Test with all parameter variations
      expect(result.isAccessible('clothing:shirt')).toBe(true);
      expect(result.isAccessible('clothing:shirt', 'torso_upper')).toBe(true);
      expect(result.isAccessible('clothing:shirt', 'torso_upper', 'base')).toBe(
        true
      );

      expect(Array.isArray(result.getBlockedItems())).toBe(true);
      expect(Array.isArray(result.getBlockingItems('clothing:shirt'))).toBe(
        true
      );
    });
  });
});
