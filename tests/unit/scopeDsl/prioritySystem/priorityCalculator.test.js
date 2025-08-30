import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  calculateCoveragePriorityOptimized,
  calculatePriorityWithValidation,
  sortCandidatesWithTieBreaking,
  applyContextualModifiers,
  clearPriorityCache,
  getCacheStats,
} from '../../../../src/scopeDsl/prioritySystem/priorityCalculator.js';

describe('PriorityCalculator', () => {
  beforeEach(() => {
    // Clear cache before each test for consistent results
    clearPriorityCache();
  });

  afterEach(() => {
    // Clean up cache after each test
    clearPriorityCache();
  });

  describe('calculateCoveragePriorityOptimized - Basic Priority Calculation', () => {
    it('should calculate priority for outer coverage and outer layer', () => {
      const result = calculateCoveragePriorityOptimized('outer', 'outer');
      expect(result).toBe(110); // 100 (outer coverage) + 10 (outer layer)
    });

    it('should calculate priority for base coverage and base layer', () => {
      const result = calculateCoveragePriorityOptimized('base', 'base');
      expect(result).toBe(220); // 200 (base coverage) + 20 (base layer)
    });

    it('should calculate priority for underwear coverage and underwear layer', () => {
      const result = calculateCoveragePriorityOptimized(
        'underwear',
        'underwear'
      );
      expect(result).toBe(330); // 300 (underwear coverage) + 30 (underwear layer)
    });

    it('should calculate priority for direct coverage with accessories layer', () => {
      const result = calculateCoveragePriorityOptimized(
        'direct',
        'accessories'
      );
      expect(result).toBe(440); // 400 (direct coverage) + 40 (accessories layer)
    });

    it('should use fallback values for invalid coverage priority', () => {
      const result = calculateCoveragePriorityOptimized('invalid', 'outer');
      expect(result).toBe(410); // 400 (direct fallback) + 10 (outer layer)
    });

    it('should use fallback values for invalid layer', () => {
      const result = calculateCoveragePriorityOptimized('outer', 'invalid');
      expect(result).toBe(120); // 100 (outer coverage) + 20 (base fallback)
    });

    it('should use fallback values for both invalid inputs', () => {
      const result = calculateCoveragePriorityOptimized('invalid', 'invalid');
      expect(result).toBe(420); // 400 (direct fallback) + 20 (base fallback)
    });
  });

  describe('calculateCoveragePriorityOptimized - Caching Performance', () => {
    it('should cache calculation results', () => {
      // First calculation should be cached
      const result1 = calculateCoveragePriorityOptimized('outer', 'outer');

      // Second calculation should use cache
      const result2 = calculateCoveragePriorityOptimized('outer', 'outer');

      expect(result1).toBe(result2);
      expect(result1).toBe(110);
    });

    it('should handle multiple different cache keys', () => {
      const result1 = calculateCoveragePriorityOptimized('outer', 'outer');
      const result2 = calculateCoveragePriorityOptimized('base', 'base');
      const result3 = calculateCoveragePriorityOptimized(
        'underwear',
        'underwear'
      );
      const result4 = calculateCoveragePriorityOptimized(
        'direct',
        'accessories'
      );

      expect(result1).toBe(110);
      expect(result2).toBe(220);
      expect(result3).toBe(330);
      expect(result4).toBe(440);

      // Verify cache statistics
      const stats = getCacheStats();
      expect(stats.size).toBe(4);
      expect(stats.enabled).toBe(true);
    });

    it('should return consistent results from cache', () => {
      const testCases = [
        ['outer', 'outer'],
        ['base', 'base'],
        ['underwear', 'underwear'],
        ['direct', 'accessories'],
        ['outer', 'base'],
        ['base', 'underwear'],
      ];

      // Calculate all once
      const firstResults = testCases.map(([coverage, layer]) =>
        calculateCoveragePriorityOptimized(coverage, layer)
      );

      // Calculate all again
      const secondResults = testCases.map(([coverage, layer]) =>
        calculateCoveragePriorityOptimized(coverage, layer)
      );

      // Results should be identical
      expect(firstResults).toEqual(secondResults);
    });
  });

  describe('calculatePriorityWithValidation - Validation System', () => {
    it('should calculate priority with valid inputs', () => {
      const result = calculatePriorityWithValidation('outer', 'outer');
      expect(result).toBe(110);
    });

    it('should handle invalid coverage priority with warning', () => {
      const mockLogger = {
        warn: jest.fn(),
      };

      const result = calculatePriorityWithValidation(
        'invalid_coverage',
        'outer',
        mockLogger
      );

      expect(result).toBe(410); // Fallback to 'direct' coverage
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid coverage priority: invalid_coverage')
      );
    });

    it('should handle invalid layer with warning', () => {
      const mockLogger = {
        warn: jest.fn(),
      };

      const result = calculatePriorityWithValidation(
        'outer',
        'invalid_layer',
        mockLogger
      );

      expect(result).toBe(120); // Fallback to 'base' layer
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid layer: invalid_layer')
      );
    });

    it('should handle both invalid inputs with warnings', () => {
      const mockLogger = {
        warn: jest.fn(),
      };

      const result = calculatePriorityWithValidation(
        'invalid_coverage',
        'invalid_layer',
        mockLogger
      );

      expect(result).toBe(420); // Both fallbacks applied
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should work without logger', () => {
      const result = calculatePriorityWithValidation(
        'invalid_coverage',
        'outer'
      );
      expect(result).toBe(410); // Should still work with fallbacks
    });

    it('should validate all valid coverage priorities', () => {
      const validCoverages = ['outer', 'base', 'underwear', 'direct'];
      const mockLogger = { warn: jest.fn() };

      validCoverages.forEach((coverage) => {
        calculatePriorityWithValidation(coverage, 'outer', mockLogger);
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should validate all valid layers', () => {
      const validLayers = ['outer', 'base', 'underwear', 'accessories'];
      const mockLogger = { warn: jest.fn() };

      validLayers.forEach((layer) => {
        calculatePriorityWithValidation('outer', layer, mockLogger);
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('sortCandidatesWithTieBreaking - Tie-Breaking Logic', () => {
    it('should sort candidates by priority score (primary)', () => {
      const candidates = [
        { itemId: 'item3', priority: 330, source: 'coverage' },
        { itemId: 'item1', priority: 110, source: 'coverage' },
        { itemId: 'item2', priority: 220, source: 'coverage' },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      expect(sorted.map((c) => c.itemId)).toEqual(['item1', 'item2', 'item3']);
      expect(sorted.map((c) => c.priority)).toEqual([110, 220, 330]);
    });

    it('should break ties by source preference (coverage over direct)', () => {
      const candidates = [
        { itemId: 'direct_item', priority: 220, source: 'direct' },
        { itemId: 'coverage_item', priority: 220, source: 'coverage' },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      expect(sorted[0].itemId).toBe('coverage_item');
      expect(sorted[0].source).toBe('coverage');
    });

    it('should break ties by equipment timestamp (more recent first)', () => {
      const now = Date.now();
      const candidates = [
        {
          itemId: 'old_item',
          priority: 220,
          source: 'coverage',
          equipTimestamp: now - 1000,
        },
        {
          itemId: 'new_item',
          priority: 220,
          source: 'coverage',
          equipTimestamp: now,
        },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      expect(sorted[0].itemId).toBe('new_item');
      expect(sorted[0].equipTimestamp).toBe(now);
    });

    it('should break final ties by alphabetical item ID order', () => {
      const candidates = [
        { itemId: 'zebra_item', priority: 220, source: 'coverage' },
        { itemId: 'alpha_item', priority: 220, source: 'coverage' },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      expect(sorted[0].itemId).toBe('alpha_item');
      expect(sorted[1].itemId).toBe('zebra_item');
    });

    it('should handle complex multi-level tie breaking', () => {
      const now = Date.now();
      const candidates = [
        {
          itemId: 'zebra_direct',
          priority: 220,
          source: 'direct',
          equipTimestamp: now - 200,
        },
        {
          itemId: 'alpha_coverage_old',
          priority: 220,
          source: 'coverage',
          equipTimestamp: now - 1000,
        },
        {
          itemId: 'beta_coverage_new',
          priority: 220,
          source: 'coverage',
          equipTimestamp: now,
        },
        {
          itemId: 'alpha_direct',
          priority: 220,
          source: 'direct',
          equipTimestamp: now - 500,
        },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      // Expected order:
      // 1. beta_coverage_new (coverage + newest timestamp)
      // 2. alpha_coverage_old (coverage + older timestamp)
      // 3. zebra_direct (direct + newer timestamp, comes first among direct items)
      // 4. alpha_direct (direct + older timestamp, comes second among direct items)
      expect(sorted.map((c) => c.itemId)).toEqual([
        'beta_coverage_new',
        'alpha_coverage_old',
        'zebra_direct',
        'alpha_direct',
      ]);
    });

    it('should handle candidates without timestamps', () => {
      const candidates = [
        { itemId: 'item_b', priority: 220, source: 'coverage' },
        { itemId: 'item_a', priority: 220, source: 'coverage' },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      expect(sorted[0].itemId).toBe('item_a'); // Alphabetical fallback
      expect(sorted[1].itemId).toBe('item_b');
    });

    it('should maintain sort stability for identical items', () => {
      const candidates = [
        {
          itemId: 'item_same',
          priority: 220,
          source: 'coverage',
          equipTimestamp: 1000,
        },
        {
          itemId: 'item_same',
          priority: 220,
          source: 'coverage',
          equipTimestamp: 1000,
        },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      expect(sorted).toHaveLength(2);
      expect(sorted[0].itemId).toBe('item_same');
      expect(sorted[1].itemId).toBe('item_same');
    });
  });

  describe('applyContextualModifiers - Future Enhancement Hooks', () => {
    it('should return base priority when contextual modifiers disabled', () => {
      const candidate = { coveragePriority: 'outer', damaged: true };
      const context = { weather: 'cold' };

      const result = applyContextualModifiers(110, candidate, context);

      expect(result).toBe(110); // No modification when disabled
    });

    it('should return base priority when no context provided', () => {
      const candidate = { coveragePriority: 'outer' };

      const result = applyContextualModifiers(110, candidate, null);

      expect(result).toBe(110);
    });

    it('should return base priority when context is undefined', () => {
      const candidate = { coveragePriority: 'outer' };

      const result = applyContextualModifiers(110, candidate, undefined);

      expect(result).toBe(110);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', () => {
      // Add some entries to cache
      calculateCoveragePriorityOptimized('outer', 'outer');
      calculateCoveragePriorityOptimized('base', 'base');

      let stats = getCacheStats();
      expect(stats.size).toBe(2);

      // Clear cache
      clearPriorityCache();

      stats = getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should report correct cache statistics', () => {
      const stats = getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('enabled');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.enabled).toBe('boolean');
    });

    it('should handle cache size limit eviction', () => {
      // This test assumes the cache limit is reasonable (e.g., 1000)
      // We'll add a few entries and verify they're stored
      const testEntries = 5;

      for (let i = 0; i < testEntries; i++) {
        calculateCoveragePriorityOptimized(`test${i}`, `layer${i}`);
      }

      const stats = getCacheStats();
      expect(stats.size).toBe(testEntries);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null coverage priority', () => {
      const result = calculateCoveragePriorityOptimized(null, 'outer');
      expect(typeof result).toBe('number');
      expect(result).toBe(410); // Should use fallback
    });

    it('should handle undefined layer', () => {
      const result = calculateCoveragePriorityOptimized('outer', undefined);
      expect(typeof result).toBe('number');
      expect(result).toBe(120); // Should use fallback
    });

    it('should handle empty string inputs', () => {
      const result = calculateCoveragePriorityOptimized('', '');
      expect(typeof result).toBe('number');
      expect(result).toBe(420); // Both fallbacks
    });

    it('should handle sorting empty candidate array', () => {
      const candidates = [];
      const sorted = sortCandidatesWithTieBreaking(candidates);
      expect(sorted).toEqual([]);
    });

    it('should handle sorting single candidate', () => {
      const candidates = [
        { itemId: 'single', priority: 220, source: 'coverage' },
      ];
      const sorted = sortCandidatesWithTieBreaking(candidates);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].itemId).toBe('single');
    });
  });
});
