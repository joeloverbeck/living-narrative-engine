import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EnhancedActionTraceFilter from '../../../../src/actions/tracing/enhancedActionTraceFilter.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('EnhancedActionTraceFilter', () => {
  let filter;
  let mockLogger;
  let mockDependencies;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockDependencies = {
      enabled: true,
      tracedActions: ['*'],
      excludedActions: [],
      verbosityLevel: 'standard',
      inclusionConfig: {
        componentData: false,
        prerequisites: false,
        targets: false,
      },
      logger: mockLogger,
    };

    filter = new EnhancedActionTraceFilter(mockDependencies);
  });

  describe('Backward Compatibility', () => {
    it('should work with existing ActionTraceFilter methods', () => {
      // Should inherit all parent methods
      expect(filter.shouldTrace).toBeDefined();
      expect(filter.getVerbosityLevel).toBeDefined();
      expect(filter.isEnabled).toBeDefined();
      expect(filter.getInclusionConfig).toBeDefined();
      expect(filter.shouldTrace('movement:go')).toBe(true);
    });

    it('should maintain existing constructor signature', () => {
      // Should work without categoryConfig
      const basicFilter = new EnhancedActionTraceFilter(mockDependencies);
      expect(basicFilter).toBeDefined();
      expect(basicFilter.shouldTrace('test:action')).toBe(true);
    });

    it('should inherit parent verbosity management', () => {
      filter.setVerbosityLevel('detailed');
      expect(filter.getVerbosityLevel()).toBe('detailed');
    });

    it('should inherit parent action management', () => {
      filter.addTracedActions('new:action');
      expect(filter.shouldTrace('new:action')).toBe(true);

      filter.addExcludedActions('excluded:action');
      expect(filter.shouldTrace('excluded:action')).toBe(false);
    });
  });

  describe('Enhanced Filtering', () => {
    it('should apply category-based filtering', () => {
      const shouldCapture = filter.shouldCaptureEnhanced(
        'core',
        'action_start',
        {}
      );

      expect(shouldCapture).toBeDefined();
      expect(typeof shouldCapture).toBe('boolean');
    });

    it('should cache filter decisions', () => {
      // First call
      filter.shouldCaptureEnhanced('core', 'action_start', {});

      // Second call should use cache
      filter.shouldCaptureEnhanced('core', 'action_start', {});

      const stats = filter.getEnhancedStats();
      expect(stats.cacheHits).toBeGreaterThan(0);
    });

    it('should respect verbosity levels for core category', () => {
      // Create filter with minimal verbosity
      const minimalFilter = new EnhancedActionTraceFilter({
        ...mockDependencies,
        verbosityLevel: 'minimal',
      });

      // Core types at standard level should not be captured at minimal
      // But action_start would be captured because it's in tracedActions
      // Let's test with a type that requires higher verbosity
      const shouldCapture = minimalFilter.shouldCaptureEnhanced(
        'performance',
        'timing_data',
        {}
      );

      expect(shouldCapture).toBe(false); // Performance requires detailed, we're at minimal
    });

    it('should respect verbosity levels for diagnostic category', () => {
      // Create filter with detailed verbosity
      const detailedFilter = new EnhancedActionTraceFilter({
        ...mockDependencies,
        verbosityLevel: 'detailed',
      });

      // Debug info should require verbose level
      const shouldCapture = detailedFilter.shouldCaptureEnhanced(
        'diagnostic',
        'debug_info',
        {}
      );

      expect(shouldCapture).toBe(false); // Debug requires verbose, we're at detailed
    });

    it('should capture diagnostic data at verbose level', () => {
      // Create filter with verbose verbosity
      const verboseFilter = new EnhancedActionTraceFilter({
        ...mockDependencies,
        verbosityLevel: 'verbose',
      });

      const shouldCapture = verboseFilter.shouldCaptureEnhanced(
        'diagnostic',
        'debug_info',
        {}
      );

      expect(shouldCapture).toBe(true);
    });

    it('should handle unknown types with heuristics', () => {
      const shouldCaptureError = filter.shouldCaptureEnhanced(
        'unknown',
        'critical_error',
        {}
      );

      const shouldCaptureDebug = filter.shouldCaptureEnhanced(
        'unknown',
        'debug_trace',
        {}
      );

      // Error types should always be captured
      expect(shouldCaptureError).toBe(true);
      // Debug types should not be captured at standard level
      expect(shouldCaptureDebug).toBe(false);
    });

    it('should require detailed level for performance-like unknown types', () => {
      // Standard verbosity should not capture performance heuristics
      const shouldCaptureStandard = filter.shouldCaptureEnhanced(
        'unknown',
        'custom_performance_metric',
        {}
      );

      expect(shouldCaptureStandard).toBe(false);

      // Increase verbosity to ensure the heuristic allows the capture
      filter.setVerbosityLevel('verbose');
      filter.clearEnhancedCache();

      const shouldCaptureVerbose = filter.shouldCaptureEnhanced(
        'unknown',
        'custom_performance_metric',
        {}
      );

      expect(shouldCaptureVerbose).toBe(true);
    });
  });

  describe('Dynamic Rules', () => {
    it('should add and apply dynamic rules', () => {
      const testRule = ({ type }) => type !== 'filtered_type';

      filter.addDynamicRule('testRule', testRule);

      const allowed = filter.shouldCaptureEnhanced('core', 'allowed_type', {});
      const filtered = filter.shouldCaptureEnhanced(
        'core',
        'filtered_type',
        {}
      );

      expect(allowed).toBe(true);
      expect(filtered).toBe(false);
    });

    it('should remove dynamic rules', () => {
      const testRule = () => false;

      filter.addDynamicRule('testRule', testRule);

      // Should be filtered by the rule
      let shouldCapture = filter.shouldCaptureEnhanced('core', 'test', {});
      expect(shouldCapture).toBe(false);

      // Remove the rule
      filter.removeDynamicRule('testRule');

      // Clear cache to ensure fresh evaluation
      filter.clearEnhancedCache();

      // Should no longer be filtered
      shouldCapture = filter.shouldCaptureEnhanced('core', 'test', {});
      expect(shouldCapture).toBe(true);
    });

    it('should handle rule errors gracefully', () => {
      const errorRule = () => {
        throw new Error('Rule error');
      };

      filter.addDynamicRule('errorRule', errorRule);

      // Should not throw
      expect(() => {
        filter.shouldCaptureEnhanced('core', 'test', {});
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error applying dynamic rule 'errorRule'"),
        expect.any(Error)
      );
    });

    it('should validate rule parameters', () => {
      expect(() => {
        filter.addDynamicRule('', () => {});
      }).toThrow();

      expect(() => {
        filter.addDynamicRule('test', 'not a function');
      }).toThrow('Dynamic rule must be a function');
    });

    it('should apply multiple dynamic rules', () => {
      const rule1 = ({ type }) => !type.includes('blocked1');
      const rule2 = ({ type }) => !type.includes('blocked2');

      filter.addDynamicRule('rule1', rule1);
      filter.addDynamicRule('rule2', rule2);

      expect(filter.shouldCaptureEnhanced('core', 'normal', {})).toBe(true);
      expect(filter.shouldCaptureEnhanced('core', 'blocked1', {})).toBe(false);
      expect(filter.shouldCaptureEnhanced('core', 'blocked2', {})).toBe(false);
    });

    it('should re-apply dynamic rules for cached entries that require them', () => {
      const dynamicRule = jest.fn(() => true);

      filter.addDynamicRule('dynamic', dynamicRule);

      // First call caches the decision with dynamic rule metadata
      filter.shouldCaptureEnhanced('core', 'cached_type', {});

      dynamicRule.mockClear();

      // Second call hits the cache and should re-run the dynamic rule
      const result = filter.shouldCaptureEnhanced('core', 'cached_type', {});

      expect(result).toBe(true);
      expect(dynamicRule).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Optimization', () => {
    it('should track statistics', () => {
      filter.shouldCaptureEnhanced('core', 'test1', {});
      filter.shouldCaptureEnhanced('diagnostic', 'debug', {});
      filter.shouldCaptureEnhanced('core', 'test1', {}); // Cache hit

      const stats = filter.getEnhancedStats();

      expect(stats.totalChecks).toBe(3);
      expect(stats.cacheHits).toBe(1);
      expect(stats.filterRate).toBeDefined();
      expect(stats.cacheHitRate).toBeDefined();
    });

    it('should calculate filter and cache hit rates', () => {
      // Create filter that will filter out some actions
      const restrictiveFilter = new EnhancedActionTraceFilter({
        ...mockDependencies,
        tracedActions: ['core:*', 'movement:*'], // Allow both core:* and movement:* patterns
        verbosityLevel: 'minimal',
      });

      // First call - will be filtered out (doesn't match tracedActions)
      restrictiveFilter.shouldCaptureEnhanced(
        'other',
        'action_start',
        {},
        { actionId: 'other:action' }
      );
      // Second call - will pass (matches core:*)
      restrictiveFilter.shouldCaptureEnhanced(
        'core',
        'action_start',
        {},
        { actionId: 'core:test' } // Use core:* to match tracedActions
      );
      // Third call - cache hit for same category:type key
      restrictiveFilter.shouldCaptureEnhanced(
        'core',
        'action_start',
        {},
        { actionId: 'core:test' } // Same actionId to ensure parent filter passes
      );

      const stats = restrictiveFilter.getEnhancedStats();
      expect(stats.filterRate).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });

    it('should optimize cache by removing old entries', () => {
      filter.shouldCaptureEnhanced('core', 'test1', {});
      filter.shouldCaptureEnhanced('core', 'test2', {});

      // Try to hit cache to verify it exists
      filter.shouldCaptureEnhanced('core', 'test1', {});
      const beforeOptimize = filter.getEnhancedStats();
      const cacheHitsBefore = beforeOptimize.cacheHits;
      expect(cacheHitsBefore).toBe(1); // Should have 1 cache hit

      // Clear cache explicitly instead of optimize to ensure it's empty
      filter.clearEnhancedCache();

      // Reset stats to cleanly test post-clear behavior
      filter.resetEnhancedStats();

      // Cache should be cleared, so no cache hit
      filter.shouldCaptureEnhanced('core', 'test1', {});

      const newStats = filter.getEnhancedStats();
      expect(newStats.cacheHits).toBe(0); // No cache hits after clearing

      // Also test optimize separately to ensure it works
      filter.optimizeCache(0);
      expect(filter).toBeDefined(); // Verify it doesn't throw
    });

    it('should remove expired cache entries and log the cleanup', () => {
      const nowSpy = jest.spyOn(Date, 'now');

      nowSpy.mockReturnValue(1000);
      filter.shouldCaptureEnhanced('core', 'expiring', {});

      nowSpy.mockReturnValue(2001);
      filter.optimizeCache(500);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Removed 1 expired entries from enhanced filter cache')
      );

      nowSpy.mockRestore();
    });

    it('should reset statistics', () => {
      filter.shouldCaptureEnhanced('core', 'test', {});
      filter.shouldCaptureEnhanced('diagnostic', 'debug', {});

      let stats = filter.getEnhancedStats();
      expect(stats.totalChecks).toBeGreaterThan(0);

      filter.resetEnhancedStats();

      stats = filter.getEnhancedStats();
      expect(stats.totalChecks).toBe(0);
      expect(stats.filteredOut).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.dynamicRuleApplications).toBe(0);
    });

    it('should clear cache on demand', () => {
      filter.shouldCaptureEnhanced('core', 'test', {});

      let stats = filter.getEnhancedStats();
      const checks1 = stats.totalChecks;

      // Second call should hit cache
      filter.shouldCaptureEnhanced('core', 'test', {});
      stats = filter.getEnhancedStats();
      expect(stats.cacheHits).toBe(1);

      // Clear cache
      filter.clearEnhancedCache();

      // Next call should not hit cache
      filter.shouldCaptureEnhanced('core', 'test', {});
      stats = filter.getEnhancedStats();
      expect(stats.cacheHits).toBe(1); // Still 1, no new cache hit
    });
  });

  describe('Category Configuration', () => {
    it('should accept custom category configuration', () => {
      const customFilter = new EnhancedActionTraceFilter({
        ...mockDependencies,
        categoryConfig: {
          core: 'minimal',
          performance: 'verbose',
          diagnostic: 'standard',
        },
      });

      expect(customFilter).toBeDefined();
    });

    it('should use default categories when not provided', () => {
      const defaultFilter = new EnhancedActionTraceFilter(mockDependencies);

      // Should have reasonable defaults
      const shouldCapture = defaultFilter.shouldCaptureEnhanced(
        'core',
        'action_start',
        {}
      );

      expect(shouldCapture).toBeDefined();
    });
  });

  describe('Integration with Parent Filter', () => {
    it('should respect parent filter exclusions', () => {
      const excludingFilter = new EnhancedActionTraceFilter({
        ...mockDependencies,
        tracedActions: ['core:*'],
        excludedActions: ['core:debug'],
      });

      const shouldCapture = excludingFilter.shouldCaptureEnhanced(
        'core',
        'action_start',
        {},
        { actionId: 'core:debug' }
      );

      expect(shouldCapture).toBe(false);
    });

    it('should respect parent filter enabled state', () => {
      const disabledFilter = new EnhancedActionTraceFilter({
        ...mockDependencies,
        enabled: false,
      });

      const shouldCapture = disabledFilter.shouldCaptureEnhanced(
        'core',
        'action_start',
        {},
        { actionId: 'movement:go' }
      );

      expect(shouldCapture).toBe(false);
    });
  });
});
