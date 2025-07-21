/**
 * @file Performance benchmarking tests for UnifiedScopeResolver
 * @see specs/unified-scope-resolver-consolidation-spec.md
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { UnifiedScopeResolver } from '../../src/actions/scopes/unifiedScopeResolver.js';
import { ScopeCacheStrategy } from '../../src/actions/scopes/scopeCacheStrategy.js';

describe('UnifiedScopeResolver Performance', () => {
  // Set longer timeout for performance tests
  jest.setTimeout(20000);

  let resolver;
  let cacheStrategy;
  let mockDependencies;

  beforeEach(() => {
    // Create cache strategy
    cacheStrategy = new ScopeCacheStrategy({
      maxSize: 1000,
      defaultTTL: 5000,
    });

    // Mock dependencies
    mockDependencies = {
      scopeRegistry: {
        getScope: jest.fn().mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        }),
      },
      scopeEngine: {
        resolve: jest
          .fn()
          .mockReturnValue(new Set(['entity1', 'entity2', 'entity3'])),
      },
      entityManager: {
        getComponentData: jest.fn().mockReturnValue({ name: 'Test Actor' }),
        getEntityInstance: jest.fn().mockReturnValue({ id: 'valid-entity' }),
      },
      jsonLogicEvaluationService: {
        evaluate: jest.fn(),
      },
      dslParser: {
        parse: jest.fn().mockReturnValue({ type: 'all' }),
      },
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      actionErrorContextBuilder: {
        buildErrorContext: jest.fn((params) => params.error),
      },
      cacheStrategy,
    };

    resolver = new UnifiedScopeResolver(mockDependencies);
  });

  afterEach(() => {
    // Clear all mocks and cleanup cache
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Clear cache strategy to prevent memory leaks
    if (cacheStrategy) {
      cacheStrategy.clear();
    }

    // Reset resolver instance
    resolver = null;
    mockDependencies = null;
    cacheStrategy = null;
  });

  describe('scope resolution performance', () => {
    it('should resolve scopes faster with caching enabled', () => {
      const context = {
        actor: { id: 'actor123', componentTypeIds: ['core:actor'] },
        actorLocation: 'location1',
        actionContext: {},
      };

      const iterations = process.env.CI ? 50 : 100; // Reduce iterations in CI
      const warmupIterations = process.env.CI ? 5 : 10;
      const maxExecutionTime = 5000; // 5 second safety timeout

      // Warmup without cache
      const warmupStart = performance.now();
      for (let i = 0; i < warmupIterations; i++) {
        if (performance.now() - warmupStart > maxExecutionTime) {
          throw new Error('Warmup timeout exceeded - potential infinite loop');
        }
        resolver.resolve('test-scope', context, { useCache: false });
      }

      // Benchmark without cache
      const startNoCacheTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        if (performance.now() - startNoCacheTime > maxExecutionTime) {
          throw new Error(
            'Performance test timeout exceeded - potential infinite loop'
          );
        }
        resolver.resolve('test-scope', context, { useCache: false });
      }
      const noCacheTime = performance.now() - startNoCacheTime;

      // Clear mocks and add cache
      jest.clearAllMocks();
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

      // Warmup with cache (first call will populate cache)
      resolver.resolve('test-scope', context, { useCache: true });

      // Benchmark with cache
      const startCacheTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        if (performance.now() - startCacheTime > maxExecutionTime) {
          throw new Error(
            'Cache performance test timeout exceeded - potential infinite loop'
          );
        }
        resolver.resolve('test-scope', context, { useCache: true });
      }
      const cacheTime = performance.now() - startCacheTime;

      // Calculate improvement
      const improvementRatio = noCacheTime / cacheTime;
      const improvementPercentage =
        ((noCacheTime - cacheTime) / noCacheTime) * 100;

      console.log(`Performance Results (${iterations} iterations):`);
      console.log(`  Without cache: ${noCacheTime.toFixed(2)}ms`);
      console.log(`  With cache: ${cacheTime.toFixed(2)}ms`);
      console.log(
        `  Improvement: ${improvementRatio.toFixed(2)}x faster (${improvementPercentage.toFixed(1)}% faster)`
      );

      // Expect at least 2x improvement with caching
      expect(improvementRatio).toBeGreaterThan(2);
      expect(improvementPercentage).toBeGreaterThan(50);

      // Verify that scope engine was called much less with caching
      const noCacheCalls = iterations + warmupIterations; // Every resolve call
      const cacheCalls = mockDependencies.scopeEngine.resolve.mock.calls.length; // Only warmup call

      expect(cacheCalls).toBeLessThan(noCacheCalls / 10); // Should be dramatically fewer calls
    });

    it('should handle concurrent resolutions efficiently', async () => {
      const contexts = Array.from({ length: 50 }, (_, i) => ({
        actor: { id: `actor${i}`, componentTypeIds: ['core:actor'] },
        actorLocation: `location${i % 5}`, // 5 different locations
        actionContext: {},
      }));

      const scopes = ['scope1', 'scope2', 'scope3', 'scope4', 'scope5'];

      // Benchmark concurrent resolutions
      const startTime = performance.now();

      const promises = contexts.flatMap((context) =>
        scopes.map((scope) =>
          Promise.resolve(resolver.resolve(scope, context, { useCache: true }))
        )
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalResolutions = contexts.length * scopes.length;
      const totalTime = endTime - startTime;
      const averageTimePerResolution = totalTime / totalResolutions;

      console.log(`Concurrent Resolution Results:`);
      console.log(`  Total resolutions: ${totalResolutions}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(
        `  Average per resolution: ${averageTimePerResolution.toFixed(3)}ms`
      );

      // All resolutions should succeed
      expect(results.every((result) => result.success)).toBe(true);

      // Average resolution time should be very fast with caching
      expect(averageTimePerResolution).toBeLessThan(1); // Less than 1ms per resolution
    });

    it('should demonstrate cache hit rate improvement', () => {
      const context = {
        actor: { id: 'actor123', componentTypeIds: ['core:actor'] },
        actorLocation: 'location1',
        actionContext: {},
      };

      const iterations = process.env.CI ? 50 : 100; // Reduce iterations in CI
      const maxExecutionTime = 3000; // 3 second safety timeout for cache hit rate test

      // Reset call count
      jest.clearAllMocks();
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

      // Perform multiple resolutions of the same scope
      const testStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        if (performance.now() - testStart > maxExecutionTime) {
          throw new Error(
            'Cache hit rate test timeout exceeded - potential infinite loop'
          );
        }
        const result = resolver.resolve('test-scope', context, {
          useCache: true,
        });
        expect(result.success).toBe(true);
      }

      // Check how many times the expensive operations were called
      const scopeEngineCalls =
        mockDependencies.scopeEngine.resolve.mock.calls.length;
      const componentDataCalls =
        mockDependencies.entityManager.getComponentData.mock.calls.length;

      // Should only call expensive operations once (first cache miss)
      expect(scopeEngineCalls).toBe(1);
      expect(componentDataCalls).toBe(1);

      // Cache hit rate should be very high
      const cacheHitRate = ((iterations - 1) / iterations) * 100;
      expect(cacheHitRate).toBeGreaterThan(95); // >95% cache hit rate

      console.log(`Cache Hit Rate Results:`);
      console.log(`  Total resolutions: ${iterations}`);
      console.log(`  Scope engine calls: ${scopeEngineCalls}`);
      console.log(`  Cache hit rate: ${cacheHitRate.toFixed(1)}%`);
    });
  });

  describe('memory usage', () => {
    it('should not exceed memory limits with extensive caching', () => {
      // Create many different contexts to test memory usage
      const contextCount = process.env.CI ? 100 : 200; // Reduce in CI to prevent timeouts
      const contexts = Array.from({ length: contextCount }, (_, i) => ({
        actor: { id: `actor${i}`, componentTypeIds: ['core:actor'] },
        actorLocation: `location${i}`,
        actionContext: {},
      }));

      const initialMemory = process.memoryUsage().heapUsed;
      const maxExecutionTime = 5000; // 5 second safety timeout for memory test

      // Populate cache with many entries
      const memoryTestStart = performance.now();
      contexts.forEach((context, i) => {
        if (performance.now() - memoryTestStart > maxExecutionTime) {
          throw new Error(
            'Memory usage test timeout exceeded - potential infinite loop'
          );
        }
        const scopeName = `scope${i % 10}`; // 10 different scopes
        resolver.resolve(scopeName, context, { useCache: true });
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory Usage Results:`);
      console.log(
        `  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`  Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      console.log(`  Cache size: ${cacheStrategy.size} entries`);

      // Memory increase should be reasonable (less than 10MB for this test)
      expect(memoryIncrease).toBeLessThan(10);

      // Cache should respect maxSize limit
      expect(cacheStrategy.size).toBeLessThanOrEqual(1000);
    });
  });
});
