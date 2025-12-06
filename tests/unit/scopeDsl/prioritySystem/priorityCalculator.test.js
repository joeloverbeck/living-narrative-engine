import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock the priorityConstants module
jest.mock(
  '../../../../src/scopeDsl/prioritySystem/priorityConstants.js',
  () => {
    const mockPriorityConfig = {
      enableCaching: true,
      enableTieBreaking: true,
      enableContextualModifiers: false,
      enableValidation: true,
      maxCacheSize: 1000,
      logInvalidPriorities: true,
      defaultCoveragePriority: 'direct',
      defaultLayer: 'base',
    };

    return {
      COVERAGE_PRIORITY: Object.freeze({
        outer: 100,
        base: 200,
        underwear: 300,
        direct: 400,
      }),
      LAYER_PRIORITY_WITHIN_COVERAGE: Object.freeze({
        outer: 10,
        base: 20,
        underwear: 30,
        accessories: 40,
      }),
      VALID_COVERAGE_PRIORITIES: Object.freeze([
        'outer',
        'base',
        'underwear',
        'direct',
      ]),
      VALID_LAYERS: Object.freeze([
        'outer',
        'base',
        'underwear',
        'accessories',
      ]),
      PRIORITY_CONFIG: mockPriorityConfig,
      // Export the config for test access
      __mockPriorityConfig: mockPriorityConfig,
    };
  }
);

import {
  calculateCoveragePriorityOptimized,
  calculatePriorityWithValidation,
  sortCandidatesWithTieBreaking,
  applyContextualModifiers,
  clearPriorityCache,
  getCacheStats,
  getLayersByMode,
} from '../../../../src/scopeDsl/prioritySystem/priorityCalculator.js';
import { __mockPriorityConfig as mockPriorityConfig } from '../../../../src/scopeDsl/prioritySystem/priorityConstants.js';

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

  describe('Configuration Override Tests - Coverage Line 42, 124, 142', () => {
    beforeEach(() => {
      clearPriorityCache();
      // Reset config to defaults
      Object.assign(mockPriorityConfig, {
        enableCaching: true,
        enableTieBreaking: true,
        enableContextualModifiers: false,
        enableValidation: true,
        maxCacheSize: 1000,
      });
    });

    afterEach(() => {
      clearPriorityCache();
    });

    it('should bypass caching when enableCaching is false (Line 42)', () => {
      // Disable caching in mock config
      mockPriorityConfig.enableCaching = false;

      const result1 = calculateCoveragePriorityOptimized('outer', 'outer');
      const result2 = calculateCoveragePriorityOptimized('outer', 'outer');

      expect(result1).toBe(110);
      expect(result2).toBe(110);

      // Verify cache is not populated when caching is disabled
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.enabled).toBe(false);
    });

    it('should bypass validation when enableValidation is false (Line 124)', () => {
      // Disable validation in mock config
      mockPriorityConfig.enableValidation = false;

      const mockLogger = { warn: jest.fn() };

      // Use invalid inputs - should not trigger validation warnings
      const result = calculatePriorityWithValidation(
        'invalid_coverage',
        'invalid_layer',
        mockLogger
      );

      // Should still get a result (fallback values applied at lower level)
      expect(typeof result).toBe('number');
      expect(result).toBe(420); // Both fallbacks applied at base level

      // Should not log warnings since validation is disabled
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should use simple sort when enableTieBreaking is false (Line 142)', () => {
      // Disable tie-breaking in mock config
      mockPriorityConfig.enableTieBreaking = false;

      const candidates = [
        { itemId: 'direct_item', priority: 220, source: 'direct' },
        { itemId: 'coverage_item', priority: 220, source: 'coverage' },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      // Should maintain original order since priorities are equal
      // and tie-breaking is disabled
      expect(sorted).toHaveLength(2);
      expect(sorted[0].priority).toBe(220);
      expect(sorted[1].priority).toBe(220);

      // With simple sort, order should be maintained as input
      expect(sorted[0].itemId).toBe('direct_item');
      expect(sorted[1].itemId).toBe('coverage_item');
    });
  });

  describe('Cache Size Limit Tests - Coverage Lines 53-54', () => {
    beforeEach(() => {
      clearPriorityCache();
      // Reset config to defaults
      Object.assign(mockPriorityConfig, {
        enableCaching: true,
        maxCacheSize: 1000,
      });
    });

    afterEach(() => {
      clearPriorityCache();
    });

    it('should evict oldest entries when cache size limit is reached', () => {
      // Set small cache limit for testing
      mockPriorityConfig.maxCacheSize = 3;
      mockPriorityConfig.enableCaching = true;

      // Fill cache to limit
      calculateCoveragePriorityOptimized('test1', 'layer1'); // Entry 1
      calculateCoveragePriorityOptimized('test2', 'layer2'); // Entry 2
      calculateCoveragePriorityOptimized('test3', 'layer3'); // Entry 3

      let stats = getCacheStats();
      expect(stats.size).toBe(3);

      // Add one more entry to trigger eviction (Line 53-54)
      calculateCoveragePriorityOptimized('test4', 'layer4'); // Should evict entry 1

      stats = getCacheStats();
      expect(stats.size).toBe(3); // Size should remain at limit
      expect(stats.maxSize).toBe(3);

      // Add multiple entries to verify continued eviction
      calculateCoveragePriorityOptimized('test5', 'layer5'); // Should evict entry 2
      calculateCoveragePriorityOptimized('test6', 'layer6'); // Should evict entry 3

      stats = getCacheStats();
      expect(stats.size).toBe(3); // Still at limit
    });

    it('should maintain cache functionality after eviction', () => {
      // Set small cache limit
      mockPriorityConfig.maxCacheSize = 2;
      mockPriorityConfig.enableCaching = true;

      // Fill cache
      const result1 = calculateCoveragePriorityOptimized('outer', 'outer');
      const result2 = calculateCoveragePriorityOptimized('base', 'base');

      expect(getCacheStats().size).toBe(2);

      // Trigger eviction
      const result3 = calculateCoveragePriorityOptimized(
        'underwear',
        'underwear'
      );

      expect(getCacheStats().size).toBe(2); // Size maintained
      expect(result1).toBe(110);
      expect(result2).toBe(220);
      expect(result3).toBe(330);

      // Verify cache still works for recent entries
      const result3Again = calculateCoveragePriorityOptimized(
        'underwear',
        'underwear'
      );
      expect(result3Again).toBe(330);
    });
  });

  describe('Contextual Modifiers Tests - Coverage Lines 179-196', () => {
    beforeEach(() => {
      // Reset config to defaults
      Object.assign(mockPriorityConfig, {
        enableContextualModifiers: false,
      });
    });

    it('should apply weather-based adjustments when contextual modifiers enabled', () => {
      // Enable contextual modifiers
      mockPriorityConfig.enableContextualModifiers = true;

      const candidate = { coveragePriority: 'outer', layer: 'outer' };
      const context = { weather: 'cold' };

      const result = applyContextualModifiers(110, candidate, context);

      // Cold weather should prioritize outer layers (-10 adjustment)
      expect(result).toBe(100); // 110 - 10 = 100 (Line 183)
    });

    it('should apply damage-based adjustments when contextual modifiers enabled', () => {
      // Enable contextual modifiers
      mockPriorityConfig.enableContextualModifiers = true;

      const candidate = { damaged: true };
      const context = { weather: 'normal' };

      const result = applyContextualModifiers(110, candidate, context);

      // Damaged items should be deprioritized (+50 adjustment)
      expect(result).toBe(160); // 110 + 50 = 160 (Line 188)
    });

    it('should apply social context adjustments when contextual modifiers enabled', () => {
      // Enable contextual modifiers
      mockPriorityConfig.enableContextualModifiers = true;

      const candidate = { layer: 'accessories' };
      const context = { social: 'formal' };

      const result = applyContextualModifiers(110, candidate, context);

      // Formal settings should prioritize accessories (-5 adjustment)
      expect(result).toBe(105); // 110 - 5 = 105 (Line 193)
    });

    it('should apply combined contextual modifiers', () => {
      // Enable contextual modifiers
      mockPriorityConfig.enableContextualModifiers = true;

      const candidate = {
        coveragePriority: 'outer',
        layer: 'accessories',
        damaged: true,
      };
      const context = {
        weather: 'cold',
        social: 'formal',
      };

      const result = applyContextualModifiers(110, candidate, context);

      // Multiple adjustments: -10 (cold) + 50 (damaged) - 5 (formal)
      expect(result).toBe(145); // 110 - 10 + 50 - 5 = 145
    });

    it('should handle partial context matches', () => {
      // Enable contextual modifiers
      mockPriorityConfig.enableContextualModifiers = true;

      const candidate = { coveragePriority: 'base' }; // No outer priority
      const context = { weather: 'cold' };

      const result = applyContextualModifiers(220, candidate, context);

      // Should not apply cold weather adjustment since it's not outer layer
      expect(result).toBe(220); // No change
    });

    it('should handle missing context properties gracefully', () => {
      // Enable contextual modifiers
      mockPriorityConfig.enableContextualModifiers = true;

      const candidate = { layer: 'accessories' };
      const context = { weather: 'cold' }; // Missing social context

      const result = applyContextualModifiers(110, candidate, context);

      // Should not apply social adjustment since context.social is undefined
      expect(result).toBe(110); // No change
    });

    it('should handle empty context object', () => {
      // Enable contextual modifiers
      mockPriorityConfig.enableContextualModifiers = true;

      const candidate = { coveragePriority: 'outer', damaged: true };
      const context = {}; // Empty context

      const result = applyContextualModifiers(110, candidate, context);

      // Should only apply damage adjustment since other contexts are missing
      expect(result).toBe(160); // 110 + 50 = 160
    });

    it('should return base priority when contextual modifiers disabled (existing behavior)', () => {
      // Ensure contextual modifiers are disabled (default state)
      mockPriorityConfig.enableContextualModifiers = false;

      const candidate = { coveragePriority: 'outer', damaged: true };
      const context = { weather: 'cold', social: 'formal' };

      const result = applyContextualModifiers(110, candidate, context);

      // Should return base priority without modifications
      expect(result).toBe(110);
    });
  });

  describe('getLayersByMode - Layer Order Utility', () => {
    it('should return all layers for topmost mode', () => {
      const result = getLayersByMode('topmost');
      expect(result).toEqual(['outer', 'base', 'underwear', 'accessories']);
    });

    it('should return all layers for all mode', () => {
      const result = getLayersByMode('all');
      expect(result).toEqual(['outer', 'base', 'underwear', 'accessories']);
    });

    it('should return layers without accessories for topmost_no_accessories mode', () => {
      const result = getLayersByMode('topmost_no_accessories');
      expect(result).toEqual(['outer', 'base', 'underwear']);
    });

    it('should return single layer for outer mode', () => {
      const result = getLayersByMode('outer');
      expect(result).toEqual(['outer']);
    });

    it('should return single layer for base mode', () => {
      const result = getLayersByMode('base');
      expect(result).toEqual(['base']);
    });

    it('should return single layer for underwear mode', () => {
      const result = getLayersByMode('underwear');
      expect(result).toEqual(['underwear']);
    });

    it('should return all layers for invalid/unknown mode (safe fallback)', () => {
      const result = getLayersByMode('invalid_mode');
      expect(result).toEqual(['outer', 'base', 'underwear', 'accessories']);
    });

    it('should handle null/undefined mode gracefully', () => {
      const resultNull = getLayersByMode(null);
      const resultUndefined = getLayersByMode(undefined);
      expect(resultNull).toEqual(['outer', 'base', 'underwear', 'accessories']);
      expect(resultUndefined).toEqual([
        'outer',
        'base',
        'underwear',
        'accessories',
      ]);
    });

    it('should maintain backward compatibility with old LAYER_PRIORITY constants', () => {
      // Test that new function produces same results as old local constants
      const oldLayerPriority = {
        topmost: ['outer', 'base', 'underwear', 'accessories'],
        topmost_no_accessories: ['outer', 'base', 'underwear'],
        all: ['outer', 'base', 'underwear', 'accessories'],
        outer: ['outer'],
        base: ['base'],
        underwear: ['underwear'],
      };

      for (const [mode, expectedLayers] of Object.entries(oldLayerPriority)) {
        const result = getLayersByMode(mode);
        expect(result).toEqual(expectedLayers);
      }
    });
  });
});
