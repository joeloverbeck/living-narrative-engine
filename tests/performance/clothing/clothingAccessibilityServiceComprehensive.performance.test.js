/**
 * @file Performance tests for ClothingAccessibilityService - Comprehensive scenarios
 * @description Performance benchmarks extracted from comprehensive unit test suite.
 * Tests large wardrobe handling efficiency and cache performance characteristics.
 *
 * PERFORMANCE BASELINE DOCUMENTATION:
 *
 * Large Wardrobe Performance:
 * - 100 equipped items: Should complete within 50ms
 * - Algorithmic complexity: O(n) where n = number of equipped items
 * - Expected linear scaling for wardrobe size increases
 *
 * Cache Performance:
 * - Expected speedup: 2x or greater for repeated queries
 * - Cache implementation: Map-based with entity-specific clearing
 * - Cache invalidation: Per-entity basis for targeted performance
 *
 * Test Environment Considerations:
 * - Performance tests run sequentially to avoid interference
 * - Longer timeout (15s) to accommodate benchmarking overhead
 * - CI environments may have higher timing variance
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';
import { ClothingTestDataFactory } from '../../common/clothing/clothingTestDataFactory.js';
import { ClothingTestAssertions } from '../../common/clothing/clothingTestAssertions.js';

describe('ClothingAccessibilityService - Performance Benchmarks', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      setComponentData: jest.fn(),
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn(),
    };

    service = new ClothingAccessibilityService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      entitiesGateway: mockEntitiesGateway,
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large wardrobes efficiently', () => {
      const largeEquipment =
        ClothingTestDataFactory.createLargeWardrobeEquipment(100);
      mockEntityManager.getComponentData.mockReturnValue(largeEquipment);
      mockEntitiesGateway.getComponentData.mockReturnValue({
        covers: ['body_area'],
        coveragePriority: 'base',
      });

      const duration = ClothingTestAssertions.assertPerformanceWithin(
        () => service.getAccessibleItems('test-entity', { mode: 'all' }),
        50, // 50ms for 100 items
        'Large wardrobe query'
      );

      expect(duration).toBeLessThan(50);
    });

    it('should benefit from caching', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { slot: { base: 'item1' } },
      });

      const cacheMetrics = ClothingTestAssertions.assertCacheSpeedup(
        () => {
          service.clearCache('test-entity');
          service.getAccessibleItems('test-entity');
        },
        () => service.getAccessibleItems('test-entity'),
        2 // Expect at least 2x speedup (more realistic)
      );

      if (cacheMetrics.coldTime > 0.1) {
        expect(cacheMetrics.speedup).toBeGreaterThan(2);
      }
    });
  });
});
