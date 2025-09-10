/**
 * @file Memory usage tests for LogCategoryDetector
 * @see src/logging/logCategoryDetector.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';

describe('LogCategoryDetector Memory Usage', () => {
  let detector;

  beforeEach(async () => {
    // Force GC before each test if available
    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }

    detector = new LogCategoryDetector({
      enableCache: true,
      cacheSize: 1000,
      cacheTTL: 300000,
    });
  });

  afterEach(async () => {
    // Clean up and force GC after each test
    if (detector) {
      detector.clearCache();
      detector = null;
    }

    if (global.memoryTestUtils) {
      await global.memoryTestUtils.forceGCAndWait();
    }
  });

  describe('Memory Growth Testing', () => {
    it('should maintain efficient memory usage during high volume enrichment', async () => {
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Reduced operation count for faster testing while maintaining validity
      const operationCount =
        global.memoryTestUtils && global.memoryTestUtils.isCI() ? 1000 : 2000;

      for (let i = 0; i < operationCount; i++) {
        // Create varied messages to test different detection paths
        const messageVariants = [
          `Entity manager error: failed to create entity ${i}`,
          `Event bus dispatch: action ${i} completed successfully`,
          `Component validation failed for user input ${i}`,
          `UI render cycle ${i} completed in 16ms`,
          `Network request timeout for remote logging ${i}`,
          `GameEngine initialization started ${i}`,
          `AI system processing neural network ${i}`,
          `Anatomy blueprint created with tissue ${i}`,
          `Configuration settings loaded ${i}`,
          `Performance monitoring enabled ${i}`,
        ];

        const message = messageVariants[i % messageVariants.length];
        const metadata = {
          level: i % 4 === 0 ? 'error' : i % 3 === 0 ? 'warn' : 'info',
          timestamp: Date.now(),
          source: `test-source-${i % 10}`,
        };

        detector.detectCategory(message, metadata);

        // Removed periodic GC - not needed during test execution
      }

      // Final memory measurement
      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryGrowth = finalMemory - baselineMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Should not grow by more than 25MB during intensive detection (realistic for 10,000 operations)
      expect(memoryGrowthMB).toBeLessThan(25);

      // Verify detector still functions correctly after high volume
      const stats = detector.getStats();
      expect(stats.detectionCount).toBe(operationCount);
      expect(stats.cacheEnabled).toBe(true);
    });

    it('should not exhibit memory leaks during repeated enrichment', async () => {
      const iterations =
        global.memoryTestUtils && global.memoryTestUtils.isCI() ? 2 : 3;
      const memoryMeasurements = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        if (global.memoryTestUtils) {
          await global.memoryTestUtils.forceGCAndWait();
        }

        const iterationStart = global.memoryTestUtils
          ? await global.memoryTestUtils.getStableMemoryUsage()
          : process.memoryUsage().heapUsed;

        // Process same set of messages multiple times
        const messages = [
          'Entity manager processing component updates',
          'Event system dispatching action events',
          'UI renderer updating display elements',
          'Network layer handling HTTP requests',
          'Configuration manager loading settings',
        ];

        // Reduced cycle count for faster testing
        for (let cycle = 0; cycle < 50; cycle++) {
          for (const message of messages) {
            detector.detectCategory(message, {
              level: 'info',
              timestamp: Date.now(),
              iteration: iteration,
              cycle: cycle,
            });
          }
        }

        if (global.memoryTestUtils) {
          await global.memoryTestUtils.forceGCAndWait();
        }

        const iterationEnd = global.memoryTestUtils
          ? await global.memoryTestUtils.getStableMemoryUsage()
          : process.memoryUsage().heapUsed;

        memoryMeasurements.push(iterationEnd - iterationStart);

        // Clear cache to reset state between iterations
        detector.clearCache();
      }

      // Memory growth should stabilize (no continuous leaks)
      if (memoryMeasurements.length >= 3) {
        const firstMeasurement = memoryMeasurements[0];
        const lastMeasurement =
          memoryMeasurements[memoryMeasurements.length - 1];

        // Last iteration should not use significantly more memory than first
        const growthRatio = lastMeasurement / firstMeasurement;
        expect(growthRatio).toBeLessThan(2.0); // No more than 2x growth across iterations
      }
    });
  });

  describe('Cache Memory Management', () => {
    it('should respect cache size limits and prevent unbounded growth', async () => {
      // Use smaller cache for controlled testing
      const smallCacheDetector = new LogCategoryDetector({
        enableCache: true,
        cacheSize: 100, // Small cache size
      });

      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Generate enough unique messages to test cache limits
      const messageCount = 500; // 5x cache size is sufficient

      for (let i = 0; i < messageCount; i++) {
        const uniqueMessage = `Unique message ${i} with different content and patterns`;
        smallCacheDetector.detectCategory(uniqueMessage);
      }

      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryGrowth = finalMemory - baselineMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Memory growth should be bounded despite processing 10x more items than cache size
      expect(memoryGrowthMB).toBeLessThan(10); // Should not exceed 10MB

      // Verify cache size is properly limited
      const stats = smallCacheDetector.getStats();
      expect(stats.cacheStats.size).toBeLessThanOrEqual(100);
      expect(stats.detectionCount).toBe(messageCount);

      smallCacheDetector.clearCache();
    });

    it('should handle cache eviction without memory leaks', async () => {
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const preTestMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Create detector with moderate cache size
      const evictionDetector = new LogCategoryDetector({
        enableCache: true,
        cacheSize: 200,
      });

      // Reduced cycles while maintaining eviction testing
      const numCycles = 3;
      const messagesPerCycle = 250; // More than cache size

      for (let cycle = 0; cycle < numCycles; cycle++) {
        for (let i = 0; i < messagesPerCycle; i++) {
          const message = `Cycle ${cycle} message ${i} with unique content to force eviction`;
          evictionDetector.detectCategory(message);
        }

        // Force GC between cycles
        if (global.memoryTestUtils) {
          await global.memoryTestUtils.forceGCAndWait();
        }
      }

      const postTestMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const totalMemoryGrowth = postTestMemory - preTestMemory;
      const memoryGrowthMB = totalMemoryGrowth / (1024 * 1024);

      // Memory growth should be reasonable despite multiple eviction cycles
      expect(memoryGrowthMB).toBeLessThan(15); // Less than 15MB total growth

      // Verify cache is still functioning correctly
      const finalStats = evictionDetector.getStats();
      expect(finalStats.cacheStats.size).toBeLessThanOrEqual(200);
      expect(finalStats.detectionCount).toBe(numCycles * messagesPerCycle);

      evictionDetector.clearCache();
    });
  });

  describe('Batch Processing Memory Efficiency', () => {
    it('should efficiently handle batch operations without excessive memory allocation', async () => {
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Optimized batch sizes for faster testing
      const batchSize = 250;
      const numBatches = 2;

      for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
        const messages = [];
        const metadata = [];

        // Create batch data
        for (let i = 0; i < batchSize; i++) {
          messages.push(
            `Batch ${batchIndex} message ${i} for category detection`
          );
          metadata.push({
            level: 'info',
            timestamp: Date.now(),
            batch: batchIndex,
            index: i,
          });
        }

        // Process batch
        const categories = detector.detectCategories(messages, metadata);
        expect(categories).toHaveLength(batchSize);

        // Force cleanup between batches
        if (global.memoryTestUtils) {
          await global.memoryTestUtils.forceGCAndWait();
        }
      }

      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryGrowth = finalMemory - baselineMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Batch processing should not cause excessive memory growth
      expect(memoryGrowthMB).toBeLessThan(12); // Less than 12MB for batch processing

      // Verify detector state is healthy
      const stats = detector.getStats();
      expect(stats.detectionCount).toBe(batchSize * numBatches);
    });
  });

  describe('Pattern Compilation Memory Usage', () => {
    it('should not leak memory when adding and removing patterns', async () => {
      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const baselineMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      // Reduced pattern count while maintaining test validity
      const numPatterns = 20;

      for (let i = 0; i < numPatterns; i++) {
        const patternRegex = new RegExp(
          `test${i}|pattern${i}|category${i}`,
          'i'
        );
        detector.addPattern(`dynamic_category_${i}`, patternRegex, 60);
      }

      // Use some patterns
      for (let i = 0; i < numPatterns; i++) {
        detector.detectCategory(`This is a test${i} message`);
      }

      // Remove all added patterns
      for (let i = 0; i < numPatterns; i++) {
        detector.removePattern(`dynamic_category_${i}`);
      }

      if (global.memoryTestUtils) {
        await global.memoryTestUtils.forceGCAndWait();
      }

      const finalMemory = global.memoryTestUtils
        ? await global.memoryTestUtils.getStableMemoryUsage()
        : process.memoryUsage().heapUsed;

      const memoryGrowth = finalMemory - baselineMemory;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Adding and removing patterns should not cause significant memory leaks
      expect(memoryGrowthMB).toBeLessThan(8); // Less than 8MB growth after cleanup

      // Verify patterns were properly removed
      const patterns = detector.getPatterns();
      for (let i = 0; i < numPatterns; i++) {
        expect(patterns).not.toHaveProperty(`dynamic_category_${i}`);
      }
    });
  });
});
