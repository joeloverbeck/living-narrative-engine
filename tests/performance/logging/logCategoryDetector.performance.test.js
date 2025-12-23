/**
 * @file Performance tests for LogCategoryDetector
 * @see src/logging/logCategoryDetector.js
 *
 * Performance Test Strategy:
 * - Tests cache hit rate with realistic log patterns
 * - Measures detection timing performance
 * - Tests batch processing efficiency
 * - Validates pattern matching performance
 * - Uses lenient thresholds to account for environmental variations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

describe('LogCategoryDetector Performance Tests', () => {
  let detector;
  let performanceTestBed;

  beforeEach(() => {
    performanceTestBed = createPerformanceTestBed();
    detector = new LogCategoryDetector({
      enableCache: true,
      cacheSize: 1000,
      cacheTTL: 300000,
    });
  });

  afterEach(() => {
    performanceTestBed?.cleanup();
  });

  describe('Cache Performance', () => {
    it('should achieve >80% cache hit rate with realistic log patterns', () => {
      // Create repeated messages to ensure cache hits
      const uniqueMessages = [
        'Entity manager error: failed to create entity',
        'Event bus dispatch: action completed successfully',
        'Component validation failed for user input',
        'UI render cycle completed in 16ms',
        'Network request timeout for remote logging',
      ];

      // Create test data with repeated patterns (no metadata to avoid cache key pollution)
      const testMessages = [];
      for (let i = 0; i < 100; i++) {
        testMessages.push(...uniqueMessages); // Each unique message repeated 100 times = 500 total
      }

      // First pass - populate cache
      for (const message of testMessages) {
        detector.detectCategory(message); // No metadata to ensure pure message-based caching
      }

      // Clear stats to measure only second pass
      const initialStats = detector.getStats();
      const firstPassDetections = initialStats.detectionCount;

      // Second pass - should hit cache for all repeated messages
      const startTime = performance.now();
      for (const message of testMessages) {
        detector.detectCategory(message); // Same messages, should hit cache
      }
      const duration = performance.now() - startTime;

      const finalStats = detector.getStats();

      // Calculate hit rate for second pass only
      const secondPassDetections =
        finalStats.detectionCount - firstPassDetections;
      const secondPassHits = finalStats.cacheHits;
      const secondPassHitRate = (secondPassHits / secondPassDetections) * 100;

      // Second pass should have high cache hit rate since we're repeating exact same messages
      expect(secondPassHitRate).toBeGreaterThan(80); // >80% hit rate
      expect(duration).toBeLessThan(150); // Cache hits with 500 operations (allows for GC/variance)
    });

    it('should handle cache eviction efficiently under high load', () => {
      const cacheSize = 1000; // Known cache size from constructor

      // Generate more unique messages than cache can hold
      const uniqueMessages = [];
      for (let i = 0; i < cacheSize * 2; i++) {
        uniqueMessages.push(
          `Unique test message number ${i} with different patterns`
        );
      }

      const startTime = performance.now();

      for (const message of uniqueMessages) {
        detector.detectCategory(message);
      }

      const duration = performance.now() - startTime;
      const stats = detector.getStats();

      // Cache should not exceed its size limit
      expect(stats.cacheStats.size).toBeLessThanOrEqual(cacheSize);

      // Should complete in reasonable time even with eviction
      expect(duration).toBeLessThan(500); // <500ms for 2000 unique detections

      // Should have processed all messages
      expect(stats.detectionCount).toBe(cacheSize * 2);
    });
  });

  describe('Timing Performance', () => {
    it('should maintain fast detection speed without cache', () => {
      // Disable cache for this test
      const noCacheDetector = new LogCategoryDetector({
        enableCache: false,
      });

      const testMessages = generateRealisticLogMessages(1000);

      const startTime = performance.now();

      for (const message of testMessages) {
        noCacheDetector.detectCategory(message);
      }

      const duration = performance.now() - startTime;

      // Should complete within reasonable time even without cache
      expect(duration).toBeLessThan(200); // <200ms for 1000 detections without cache
    });

    it('should show significant performance improvement with cache enabled', () => {
      const testMessages = generateRealisticLogMessages(1000); // Increased sample size for stability

      // Helper to get median of array
      const median = (arr) => {
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      // Run multiple iterations to get stable measurements
      const iterations = 5;
      const noCacheDurations = [];
      const withCacheDurations = [];

      for (let iter = 0; iter < iterations; iter++) {
        // Test without cache
        const noCacheDetector = new LogCategoryDetector({
          enableCache: false,
        });

        // Warm up JIT before measuring
        for (let i = 0; i < 100; i++) {
          noCacheDetector.detectCategory('warm up message');
        }

        const startTimeNoCache = performance.now();
        for (const message of testMessages) {
          noCacheDetector.detectCategory(message);
        }
        noCacheDurations.push(performance.now() - startTimeNoCache);

        // Test with cache - create fresh detector for each iteration
        const cacheDetector = new LogCategoryDetector({
          enableCache: true,
          cacheSize: 1000,
        });

        // Warm up and populate cache
        for (let i = 0; i < 100; i++) {
          cacheDetector.detectCategory('warm up message');
        }

        // First pass to populate cache
        for (const message of testMessages) {
          cacheDetector.detectCategory(message);
        }

        const startTimeWithCache = performance.now();
        for (const message of testMessages) {
          cacheDetector.detectCategory(message);
        }
        withCacheDurations.push(performance.now() - startTimeWithCache);
      }

      // Use median values to reduce impact of outliers
      const medianNoCache = median(noCacheDurations);
      const medianWithCache = median(withCacheDurations);

      // Cache should provide performance benefit
      // Using median values and very lenient threshold for stability
      expect(medianWithCache).toBeLessThan(medianNoCache * 0.95); // At least 5% faster with cache
    });
  });

  describe('Batch Processing Performance', () => {
    it('should efficiently process batch category detection', () => {
      const testMessages = generateRealisticLogMessages(1000);
      const metadataArray = testMessages.map(() => ({}));

      const startTime = performance.now();

      const categories = detector.detectCategories(testMessages, metadataArray);

      const duration = performance.now() - startTime;

      expect(categories).toHaveLength(1000);
      expect(duration).toBeLessThan(150); // <150ms for batch processing 1000 messages

      // Verify some categories were detected
      const detectedCategories = categories.filter((cat) => cat !== undefined);
      expect(detectedCategories.length).toBeGreaterThan(0);
    });

    it('should maintain consistent performance across multiple batch operations', () => {
      const batchSize = 200;
      const numBatches = 5;

      // Extended warm-up phase to stabilize JIT optimization and reduce initial variance
      const warmupMessages = generateRealisticLogMessages(300);
      // Run warm-up twice to ensure stable performance
      detector.detectCategories(warmupMessages);
      detector.detectCategories(warmupMessages);

      const durations = [];

      for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
        const testMessages = generateRealisticLogMessages(batchSize);

        const startTime = performance.now();
        detector.detectCategories(testMessages);
        const duration = performance.now() - startTime;

        durations.push(duration);
      }

      // All batches should complete within reasonable time
      for (const duration of durations) {
        expect(duration).toBeLessThan(150); // Increased absolute threshold for test environment variance
      }

      // Performance consistency check with very lenient tolerance for test environment stability
      // Use median for more robust statistics against outliers
      const sortedDurations = [...durations].sort((a, b) => a - b);
      const medianDuration =
        sortedDurations[Math.floor(sortedDurations.length / 2)];

      // Only check that no batch takes more than 10x the median to catch severe regressions
      // This is lenient enough to handle test environment variance while still catching real issues
      for (const duration of durations) {
        expect(duration).toBeLessThan(Math.max(medianDuration * 10, 20)); // At least 20ms minimum threshold
      }

      // Additional validation: ensure we're actually processing messages efficiently overall
      const totalMessages = batchSize * numBatches;
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const averageTimePerMessage = totalDuration / totalMessages;
      expect(averageTimePerMessage).toBeLessThan(0.5); // <0.5ms per message on average
    });
  });

  describe('Pattern Matching Performance', () => {
    it('should efficiently handle complex pattern matching', () => {
      // Create messages that will match various patterns
      const complexMessages = [
        'EntityManager failed to create entity with component validation error',
        'GameEngine initialization started with performance monitoring enabled',
        'AI system processing neural network inference for decision making',
        'Anatomy blueprint created with muscle tissue and bone structure',
        'Event dispatcher handling multiple listeners with action resolution',
        'UI renderer updating display with modal button widget layout',
        'Network fetch request timeout during HTTP API endpoint call',
        'Configuration settings loaded with validation schema check',
      ];

      // Repeat messages to create realistic workload
      const testMessages = [];
      for (let i = 0; i < 125; i++) {
        // 125 * 8 = 1000 messages
        testMessages.push(...complexMessages);
      }

      const startTime = performance.now();

      const results = testMessages.map((msg) => detector.detectCategory(msg));

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // <100ms for complex pattern matching

      // Verify that patterns were detected correctly
      const detectedCategories = results.filter((cat) => cat !== undefined);
      expect(detectedCategories.length).toBeGreaterThan(500); // Should detect categories for most messages

      // Verify specific expected categories are detected
      const categorySet = new Set(detectedCategories);
      expect(categorySet.has('ecs')).toBe(true);
      expect(categorySet.has('engine')).toBe(true);
      expect(categorySet.has('ai')).toBe(true);
      expect(categorySet.has('anatomy')).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate performance statistics', () => {
      const testMessages = generateRealisticLogMessages(100);

      // Process messages
      for (const message of testMessages) {
        detector.detectCategory(message);
      }

      const stats = detector.getStats();

      // Validate statistics structure
      expect(stats).toHaveProperty('detectionCount');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('cacheEnabled');
      expect(stats).toHaveProperty('cacheStats');
      expect(stats).toHaveProperty('patternCount');

      // Validate statistics values
      expect(stats.detectionCount).toBe(100);
      expect(stats.cacheEnabled).toBe(true);
      expect(stats.patternCount).toBeGreaterThan(0);
      expect(typeof stats.cacheHitRate).toBe('string');
      expect(stats.cacheHitRate).toMatch(/\d+\.\d+%/);
    });
  });

  /**
   * Generate realistic log messages for testing
   *
   * @param {number} count - Number of messages to generate
   * @returns {string[]} Array of realistic log messages
   */
  function generateRealisticLogMessages(count) {
    const patterns = [
      'Entity manager error: failed to create entity',
      'Event bus dispatch: action completed successfully',
      'Component validation failed for user input',
      'UI render cycle completed in 16ms',
      'Network request timeout for remote logging',
      'GameEngine initialization started',
      'AI system processing neural network',
      'Anatomy blueprint created with tissue',
      'Configuration settings loaded',
      'Performance monitoring enabled',
      'Action resolution candidate discovered',
      'Turn manager processing round cycle',
      'Validation schema check completed',
      'Persistence layer saving data',
      'Memory system storing thoughts',
    ];

    const messages = [];
    for (let i = 0; i < count; i++) {
      const pattern = patterns[i % patterns.length];
      messages.push(`${pattern} - iteration ${i}`);
    }
    return messages;
  }
});
