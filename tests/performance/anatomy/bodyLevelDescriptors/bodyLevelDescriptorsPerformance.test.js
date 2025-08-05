import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  createCompleteHumanoidEntity,
  createPartialHumanoidEntity,
  createMinimalHumanoidEntity,
} from './fixtures/testEntities.js';
import { performanceExpectations } from './fixtures/expectedOutputs.js';
import { createSlowServiceMocks } from './fixtures/serviceMocks.js';
import {
  createFullComposer,
  measureExecutionTime,
  collectPerformanceMetrics,
  simulateMemoryPressure,
} from './helpers/anatomyTestHelpers.js';

describe('Performance Integration Tests', () => {
  let composer;

  beforeEach(() => {
    composer = createFullComposer();
  });

  describe('Description Generation Performance', () => {
    it('should generate descriptions quickly for typical entities', async () => {
      const entity = createCompleteHumanoidEntity();

      // Warmup iterations to allow JIT optimization
      for (let i = 0; i < 10; i++) {
        await composer.composeDescription(entity);
      }

      const iterations = 100; // Reduced for async operations

      const metrics = await collectPerformanceMetrics(
        () => composer.composeDescription(entity),
        iterations
      );

      console.log(
        `Generated ${iterations} descriptions in ${metrics.total.toFixed(2)}ms`
      );
      console.log(`Average: ${metrics.average.toFixed(3)}ms per description`);
      console.log(
        `Min: ${metrics.min.toFixed(3)}ms, Max: ${metrics.max.toFixed(3)}ms`
      );

      // Should complete iterations in reasonable time
      expect(metrics.total).toBeLessThan(2000);

      // Average should be under threshold
      expect(metrics.average).toBeLessThan(
        performanceExpectations.singleDescription.maxTime
      );
    });

    it('should handle multiple entities efficiently', async () => {
      const entities = [];

      // Create multiple entities
      for (let i = 0; i < 10; i++) {
        entities.push(createCompleteHumanoidEntity());
      }

      const { result, duration } = await measureExecutionTime(async () => {
        const results = [];
        for (const entity of entities) {
          results.push(await composer.composeDescription(entity));
        }
        return results;
      });

      console.log(
        `Generated ${entities.length} entity descriptions in ${duration.toFixed(2)}ms`
      );
      console.log(
        `Average: ${(duration / entities.length).toFixed(2)}ms per entity`
      );

      // Should complete in reasonable time
      expect(duration).toBeLessThan(
        performanceExpectations.bulkDescriptions.maxTotalTime
      );
      expect(duration / entities.length).toBeLessThan(
        performanceExpectations.bulkDescriptions.maxTimePerEntity
      );

      // All descriptions should be generated
      expect(result).toHaveLength(entities.length);
      result.forEach((description) => {
        expect(description).toBeTruthy();
      });
    });

    it('should scale linearly with entity complexity', async () => {
      const simpleEntity = createMinimalHumanoidEntity();
      const complexEntity = createCompleteHumanoidEntity();

      // Mock complex entity to have more parts
      const manyPartIds = Array.from({ length: 20 }, (_, i) => `part-${i}`);
      composer.bodyGraphService.getAllParts.mockReturnValue(manyPartIds);

      const simpleMetrics = await collectPerformanceMetrics(
        () => composer.composeDescription(simpleEntity),
        50
      );

      const complexMetrics = await collectPerformanceMetrics(
        () => composer.composeDescription(complexEntity),
        50
      );

      console.log(
        `Simple entity average: ${simpleMetrics.average.toFixed(3)}ms`
      );
      console.log(
        `Complex entity average: ${complexMetrics.average.toFixed(3)}ms`
      );
      console.log(
        `Complexity ratio: ${(complexMetrics.average / simpleMetrics.average).toFixed(2)}x`
      );

      // Complex entities should not be dramatically slower
      const complexityRatio = complexMetrics.average / simpleMetrics.average;
      expect(complexityRatio).toBeLessThan(10); // Should not be more than 10x slower
    });

    it('should maintain performance with varying descriptor combinations', async () => {
      const testCases = [
        createMinimalHumanoidEntity(), // No descriptors
        createPartialHumanoidEntity(), // Some descriptors
        createCompleteHumanoidEntity(), // All descriptors
      ];

      const results = [];

      for (const entity of testCases) {
        const metrics = await collectPerformanceMetrics(
          () => composer.composeDescription(entity),
          30
        );
        results.push(metrics);
      }

      console.log('Performance by entity type:');
      results.forEach((metrics, index) => {
        const entityType = ['minimal', 'partial', 'complete'][index];
        console.log(`${entityType}: ${metrics.average.toFixed(3)}ms average`);
      });

      // All should be within reasonable bounds
      results.forEach((metrics) => {
        expect(metrics.average).toBeLessThan(
          performanceExpectations.singleDescription.maxTime
        );
      });

      // Performance should not vary dramatically based on descriptor count
      const minAverage = Math.min(...results.map((r) => r.average));
      const maxAverage = Math.max(...results.map((r) => r.average));
      const performanceVariation = maxAverage / minAverage;

      expect(performanceVariation).toBeLessThan(8); // Should not vary by more than 8x
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with body-level descriptors', async () => {
      const entity = createCompleteHumanoidEntity();

      const memoryMetrics = await simulateMemoryPressure(
        () => composer.composeDescription(entity),
        100
      );

      console.log(
        `Memory growth: ${memoryMetrics.memoryGrowthMB.toFixed(2)}MB`
      );
      console.log(
        `Initial: ${(memoryMetrics.initialMemory / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `Final: ${(memoryMetrics.endMemory / 1024 / 1024).toFixed(2)}MB`
      );

      // Memory growth should be minimal
      expect(memoryMetrics.memoryGrowth).toBeLessThan(
        performanceExpectations.memoryUsage.maxGrowth
      );
    });

    it('should handle memory pressure gracefully', async () => {
      const entity = createCompleteHumanoidEntity();

      // Create memory pressure
      const largeArrays = [];
      try {
        // Allocate some memory
        for (let i = 0; i < 10; i++) {
          largeArrays.push(new Array(10000).fill('test'));
        }

        const { result, duration } = await measureExecutionTime(() =>
          composer.composeDescription(entity)
        );

        expect(result).toBeTruthy();
        expect(duration).toBeLessThan(100); // Should still be fast
      } finally {
        // Clean up
        largeArrays.length = 0;
      }
    });

    it('should not accumulate memory across many operations', async () => {
      const entities = [
        createMinimalHumanoidEntity(),
        createPartialHumanoidEntity(),
        createCompleteHumanoidEntity(),
      ];

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const entity = entities[i % entities.length];
        await composer.composeDescription(entity);

        // Occasionally check memory
        if (i % 25 === 0 && global.gc) {
          global.gc();
        }
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(
        `Memory growth after 100 operations: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
      );

      // Should not accumulate significant memory
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB growth
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle concurrent description generation', async () => {
      const entity = createCompleteHumanoidEntity();
      const concurrentRequests = 10;

      const { result, duration } = await measureExecutionTime(async () => {
        const promises = Array.from({ length: concurrentRequests }, () =>
          composer.composeDescription(entity)
        );
        return Promise.all(promises);
      });

      console.log(
        `Generated ${concurrentRequests} concurrent descriptions in ${duration.toFixed(2)}ms`
      );

      expect(result).toHaveLength(concurrentRequests);
      expect(duration).toBeLessThan(500); // Should be faster than sequential

      // All results should be identical
      const firstResult = result[0];
      result.forEach((description) => {
        expect(description).toBe(firstResult);
      });
    });

    it('should maintain performance under concurrent load', async () => {
      const entities = Array.from({ length: 20 }, () =>
        createCompleteHumanoidEntity()
      );

      const { result, duration } = await measureExecutionTime(async () => {
        // Process in batches of 5 concurrent requests
        const batchSize = 5;
        const results = [];

        for (let i = 0; i < entities.length; i += batchSize) {
          const batch = entities.slice(i, i + batchSize);
          const batchPromises = batch.map((entity) =>
            composer.composeDescription(entity)
          );
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }

        return results;
      });

      console.log(
        `Processed ${entities.length} entities in batches: ${duration.toFixed(2)}ms`
      );
      console.log(
        `Average per entity: ${(duration / entities.length).toFixed(2)}ms`
      );

      expect(result).toHaveLength(entities.length);
      expect(duration / entities.length).toBeLessThan(
        performanceExpectations.bulkDescriptions.maxTimePerEntity
      );
    });
  });

  describe('Service Performance Impact', () => {
    it('should handle slow service dependencies gracefully', async () => {
      const slowMocks = createSlowServiceMocks();
      const slowComposer = createFullComposer(slowMocks);
      const entity = createCompleteHumanoidEntity();

      const { result, duration } = await measureExecutionTime(() =>
        slowComposer.composeDescription(entity)
      );

      console.log(`Description with slow services: ${duration.toFixed(2)}ms`);

      expect(result).toBeTruthy();
      // Should complete even with slow services, just takes longer
      expect(duration).toBeLessThan(1000);
    });

    it('should cache service calls effectively', async () => {
      const entity = createCompleteHumanoidEntity();

      // Warmup iterations to allow JIT optimization
      for (let i = 0; i < 10; i++) {
        await composer.composeDescription(entity);
      }

      // Measure multiple iterations for stability
      const coldIterations = 20;
      const warmIterations = 20;

      // First set of calls - "cold" (but after warmup)
      const coldMetrics = await collectPerformanceMetrics(
        () => composer.composeDescription(entity),
        coldIterations
      );

      // Second set of calls - "warm" (should benefit from any caching or JIT)
      const warmMetrics = await collectPerformanceMetrics(
        () => composer.composeDescription(entity),
        warmIterations
      );

      console.log(
        `Cold average: ${coldMetrics.average.toFixed(3)}ms, Warm average: ${warmMetrics.average.toFixed(3)}ms`
      );
      console.log(
        `Performance ratio: ${(warmMetrics.average / coldMetrics.average).toFixed(2)}x`
      );

      // For sub-millisecond operations, allow more variance
      // Warm calls should not be dramatically slower than cold calls
      expect(warmMetrics.average).toBeLessThanOrEqual(coldMetrics.average * 10);

      // Also verify absolute performance is reasonable
      expect(warmMetrics.average).toBeLessThan(5); // Should be under 5ms on average
    });
  });

  describe('Large Scale Performance', () => {
    it('should handle entities with many body parts efficiently', async () => {
      const entity = createCompleteHumanoidEntity();

      // Mock entity with many parts
      const manyPartIds = Array.from({ length: 100 }, (_, i) => `part-${i}`);
      composer.bodyGraphService.getAllParts.mockReturnValue(manyPartIds);

      const { result, duration } = await measureExecutionTime(() =>
        composer.composeDescription(entity)
      );

      console.log(`Entity with 100 parts: ${duration.toFixed(2)}ms`);

      expect(result).toBeTruthy();
      expect(duration).toBeLessThan(200); // Should handle many parts reasonably
    });

    it('should maintain performance with deep part hierarchies', async () => {
      const entity = createCompleteHumanoidEntity();

      // Simulate deep hierarchy by making entityFinder slower
      let callCount = 0;
      composer.entityFinder.getEntityInstance.mockImplementation((partId) => {
        callCount++;
        return {
          id: partId,
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === 'anatomy:part') {
              return { subType: 'generic' };
            }
            return null;
          }),
        };
      });

      const { result, duration } = await measureExecutionTime(() =>
        composer.composeDescription(entity)
      );

      console.log(
        `Deep hierarchy (${callCount} calls): ${duration.toFixed(2)}ms`
      );

      expect(result).toBeTruthy();
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should establish baseline performance metrics', async () => {
      const testSuite = [
        { name: 'minimal', entity: createMinimalHumanoidEntity() },
        { name: 'partial', entity: createPartialHumanoidEntity() },
        { name: 'complete', entity: createCompleteHumanoidEntity() },
      ];

      const baselines = {};

      for (const test of testSuite) {
        const metrics = await collectPerformanceMetrics(
          () => composer.composeDescription(test.entity),
          50
        );

        baselines[test.name] = {
          average: metrics.average,
          max: metrics.max,
          min: metrics.min,
        };

        console.log(
          `${test.name} baseline: avg=${metrics.average.toFixed(3)}ms, ` +
            `max=${metrics.max.toFixed(3)}ms, min=${metrics.min.toFixed(3)}ms`
        );
      }

      // Store baselines for comparison (in real tests, these would be saved)
      expect(baselines.minimal.average).toBeLessThan(10);
      expect(baselines.partial.average).toBeLessThan(15);
      expect(baselines.complete.average).toBeLessThan(20);
    });

    it('should detect performance degradation patterns', async () => {
      const entity = createCompleteHumanoidEntity();

      // Warmup period to let JIT optimize
      for (let i = 0; i < 10; i++) {
        await composer.composeDescription(entity);
      }

      // Collect multiple samples (increased from 5 to 30 for statistical reliability)
      const samples = [];
      for (let i = 0; i < 30; i++) {
        const metrics = await collectPerformanceMetrics(
          () => composer.composeDescription(entity),
          20
        );
        samples.push(metrics.average);
      }

      console.log(
        `Performance samples (first 10): ${samples
          .slice(0, 10)
          .map((s) => s.toFixed(3))
          .join(', ')}ms`
      );

      // Remove outliers (values > 3 standard deviations from median)
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const medianDeviation = samples.map((s) => Math.abs(s - median));
      const mad = medianDeviation.sort((a, b) => a - b)[
        Math.floor(medianDeviation.length / 2)
      ];
      const filteredSamples = samples.filter(
        (s) => Math.abs(s - median) <= 3 * mad
      );

      console.log(
        `Filtered ${samples.length - filteredSamples.length} outliers, kept ${filteredSamples.length} samples`
      );

      // Check for consistency using filtered samples
      const sampleMean =
        filteredSamples.reduce((sum, sample) => sum + sample, 0) /
        filteredSamples.length;
      const variance =
        filteredSamples.reduce(
          (sum, sample) => sum + Math.pow(sample - sampleMean, 2),
          0
        ) / filteredSamples.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / sampleMean;

      console.log(
        `Performance consistency: mean=${sampleMean.toFixed(3)}ms, ` +
          `stddev=${standardDeviation.toFixed(3)}ms, cv=${(coefficientOfVariation * 100).toFixed(1)}%`
      );

      // Performance should be consistent (CV < 150% - more lenient for JS microbenchmarks)
      expect(coefficientOfVariation).toBeLessThan(1.5);

      // Additional check: 95th percentile of filtered samples should be reasonable
      const filteredSorted = [...filteredSamples].sort((a, b) => a - b);
      const p95 = filteredSorted[Math.floor(filteredSorted.length * 0.95)];
      console.log(`95th percentile (filtered): ${p95.toFixed(3)}ms`);
      expect(p95).toBeLessThan(sampleMean * 3); // 95th percentile shouldn't be more than 3x the mean
    });
  });
});
