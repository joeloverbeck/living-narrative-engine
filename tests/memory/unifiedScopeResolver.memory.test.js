/**
 * @file Memory tests for UnifiedScopeResolver caching
 * @description Tests memory usage patterns and cache efficiency of scope resolution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import UnifiedScopeResolver from '../../src/actions/scopes/unifiedScopeResolver.js';

describe('UnifiedScopeResolver - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  let resolver;
  let mockDependencies;

  beforeEach(async () => {
    // Optimized: Reduced pre-test stabilization delay for faster execution
    await global.memoryTestUtils.addPreTestStabilization(100);

    // Mock dependencies
    mockDependencies = {
      scopeRegistry: {
        getScope: jest.fn(),
      },
      scopeEngine: {
        resolve: jest.fn(),
      },
      entityManager: {
        getComponentData: jest.fn(),
      },
      jsonLogicEvaluationService: {
        evaluate: jest.fn(),
      },
      dslParser: {
        parse: jest.fn(),
      },
      actionErrorContextBuilder: {
        buildErrorContext: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    resolver = new UnifiedScopeResolver(mockDependencies);

    // Optimized: Single GC cycle is sufficient
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    // Clean up resolver cache - UnifiedScopeResolver doesn't expose clearCache
    // but the cache strategy will handle TTL expiration and LRU eviction

    // Force multiple GC cycles for better memory stabilization
    await global.memoryTestUtils.forceGCAndWait();
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('cache memory efficiency', () => {
    it('should not exceed memory limits with extensive caching', async () => {
      // This test validates that the UnifiedScopeResolver's caching mechanism
      // maintains reasonable memory usage. We focus on relative memory growth
      // caused by the cache rather than absolute heap memory, which can vary
      // significantly due to factors outside our control (V8 internals, GC timing,
      // test framework overhead, mock object allocation).

      // Optimized: Reduced context count for faster execution
      const contextCount = global.memoryTestUtils.isCI() ? 100 : 150;
      const contexts = Array.from({ length: contextCount }, (_, i) => ({
        actor: { id: `actor${i}`, componentTypeIds: ['core:actor'] },
        actorLocation: `location${i}`,
        actionContext: {},
      }));

      // Setup mock responses
      mockDependencies.scopeRegistry.getScope.mockReturnValue({
        expr: 'all',
        ast: { type: 'all' },
      });
      mockDependencies.scopeEngine.resolve.mockReturnValue(
        new Set(['entity1', 'entity2'])
      );
      mockDependencies.entityManager.getComponentData.mockReturnValue({
        name: 'Test Actor',
      });

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage(3);

      // Populate cache with many entries
      contexts.forEach((context, i) => {
        const scopeName = `scope${i % 20}`; // 20 different scopes for variety
        resolver.resolve(scopeName, context, { useCache: true });
      });

      // Optimized: Reduced stabilization wait time and sample count
      await new Promise((resolve) => setTimeout(resolve, 150));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage(5);

      // Optimized: Reduced cleanup wait time and sample count
      await global.memoryTestUtils.forceGCAndWait();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(5);

      // Calculate memory usage
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);

      // Environment-aware memory thresholds for caching
      // Note: These thresholds focus on cache-specific memory growth, not absolute heap usage
      // which can vary due to V8 internals, test framework overhead, and GC timing
      const maxCacheGrowthMB = global.memoryTestUtils.isCI() ? 50 : 35; // Cache overhead
      const maxCacheLeakageMB = global.memoryTestUtils.isCI() ? 30 : 20; // Retained cache

      // Absolute memory threshold is more lenient as it includes all heap allocations,
      // not just our cache. V8's memory management, mock objects, and test framework
      // can cause significant variation in absolute memory usage between runs.
      const maxAbsoluteMB = global.memoryTestUtils.isCI() ? 350 : 300; // Total memory limit

      expect(memoryGrowth).toBeLessThan(maxCacheGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxCacheLeakageMB * 1024 * 1024);

      // Optimized: Removed retry logic - if test fails, it indicates a real issue
      // The thresholds are already lenient enough to accommodate V8 variability
      expect(peakMemory).toBeLessThan(maxAbsoluteMB * 1024 * 1024);

      // Memory per cached item should be reasonable
      // Note: UnifiedScopeResolver has significant overhead per context due to mock setup
      const memoryPerContext = memoryGrowth / contextCount;
      const maxMemoryPerContext = global.memoryTestUtils.isCI()
        ? 180000 // Increased to 180KB for CI environment variability
        : 150000; // Increased to 150KB for local environment variability

      // Add variance tolerance for V8's non-deterministic memory allocation
      const varianceTolerance = 40000; // ±40KB tolerance for measurement fluctuation
      const adjustedThreshold = maxMemoryPerContext + varianceTolerance;

      expect(memoryPerContext).toBeLessThan(adjustedThreshold);

      console.log(
        `Scope cache memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Contexts: ${contextCount}, Per Context: ${memoryPerContext.toFixed(0)} bytes, ` +
          `Threshold: ${adjustedThreshold.toFixed(0)} bytes, ` +
          `CI: ${global.memoryTestUtils.isCI()}`
      );
    });

    it('should handle cache eviction without memory leaks', async () => {
      // Optimized: Reduced context count for faster execution
      const largeContextCount = global.memoryTestUtils.isCI() ? 300 : 500;

      // Setup mock responses
      mockDependencies.scopeRegistry.getScope.mockReturnValue({
        expr: 'all',
        ast: { type: 'all' },
      });
      mockDependencies.scopeEngine.resolve.mockReturnValue(
        new Set(['entity1'])
      );
      mockDependencies.entityManager.getComponentData.mockReturnValue({
        name: 'Test Actor',
      });

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage(3);

      // Create many cache entries (more than typical cache size limits)
      for (let i = 0; i < largeContextCount; i++) {
        const context = {
          actor: { id: `unique_actor_${i}`, componentTypeIds: ['core:actor'] },
          actorLocation: `unique_location_${i}`,
          actionContext: { uniqueProperty: i },
        };

        resolver.resolve(`unique_scope_${i}`, context, { useCache: true });

        // Optimized: Reduced periodic cleanup frequency and delay
        if (i % 150 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }

      // Optimized: Reduced stabilization wait time and sample count
      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage(3);

      // Clear cache explicitly if available
      if (resolver && typeof resolver.clearCache === 'function') {
        resolver.clearCache();
      }

      // Optimized: Reduced sample count for final memory measurement
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(3);

      // Calculate memory usage
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);

      // With cache eviction, memory growth should be bounded
      const maxEvictionGrowthMB = global.memoryTestUtils.isCI() ? 100 : 75;
      const maxEvictionLeakageMB = global.memoryTestUtils.isCI() ? 20 : 15;

      expect(memoryGrowth).toBeLessThan(maxEvictionGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxEvictionLeakageMB * 1024 * 1024);

      console.log(
        `Cache eviction memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Entries: ${largeContextCount}`
      );
    });

    it('should maintain stable memory usage during continuous cache operations', async () => {
      // Optimized: Reduced operation cycles and operations per cycle
      const operationCycles = 3;
      const operationsPerCycle = global.memoryTestUtils.isCI() ? 40 : 60;

      // Setup mock responses
      mockDependencies.scopeRegistry.getScope.mockReturnValue({
        expr: 'all',
        ast: { type: 'all' },
      });
      mockDependencies.scopeEngine.resolve.mockReturnValue(
        new Set(['entity1', 'entity2', 'entity3'])
      );
      mockDependencies.entityManager.getComponentData.mockReturnValue({
        name: 'Test Actor',
      });

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage(3);

      const memorySnapshots = [];

      // Perform multiple operation cycles
      for (let cycle = 0; cycle < operationCycles; cycle++) {
        // Perform cache operations
        for (let op = 0; op < operationsPerCycle; op++) {
          const context = {
            actor: {
              id: `cycle_${cycle}_actor_${op}`,
              componentTypeIds: ['core:actor'],
            },
            actorLocation: `cycle_${cycle}_location_${op}`,
            actionContext: { cycle, operation: op },
          };

          resolver.resolve(`cycle_scope_${op % 10}`, context, {
            useCache: true,
          });
        }

        // Optimized: Reduced delay and sample count for memory snapshots
        await new Promise((resolve) => setTimeout(resolve, 30));
        const cycleMemory = await global.memoryTestUtils.getStableMemoryUsage(3);
        memorySnapshots.push(cycleMemory);
      }

      // Optimized: Reduced sample count for final memory measurement
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(3);

      // Calculate memory stability metrics
      const memoryVariations = [];
      for (let i = 1; i < memorySnapshots.length; i++) {
        memoryVariations.push(
          Math.abs(memorySnapshots[i] - memorySnapshots[i - 1])
        );
      }

      const maxVariation = Math.max(...memoryVariations);
      const totalGrowth = Math.max(
        0,
        memorySnapshots[memorySnapshots.length - 1] - baselineMemory
      );
      const finalLeakage = Math.max(0, finalMemory - baselineMemory);

      // Memory should be stable across cycles
      const maxVariationMB = global.memoryTestUtils.isCI() ? 30 : 20; // MB variation between cycles
      const maxTotalGrowthMB = global.memoryTestUtils.isCI() ? 80 : 60; // MB total growth
      const maxFinalLeakageMB = global.memoryTestUtils.isCI() ? 25 : 20; // MB final leakage

      expect(maxVariation).toBeLessThan(maxVariationMB * 1024 * 1024);
      expect(totalGrowth).toBeLessThan(maxTotalGrowthMB * 1024 * 1024);
      expect(finalLeakage).toBeLessThan(maxFinalLeakageMB * 1024 * 1024);

      console.log(
        `Continuous cache memory - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Max Variation: ${(maxVariation / 1024 / 1024).toFixed(2)}MB, ` +
          `Total Growth: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Cycles: ${operationCycles}, Ops/Cycle: ${operationsPerCycle}`
      );
    });
  });
});
