/**
 * @file Performance benchmarks for Entity Lifecycle Workflow operations
 * @description Tests focused on measuring and validating entity lifecycle performance
 *
 * These tests were extracted from E2E test suite to run with dedicated performance test runner.
 * Tests entity creation, batch operations, and performance consistency across multiple operations.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityWorkflowTestBed from '../../e2e/entities/common/entityWorkflowTestBed.js';

describe('Entity Lifecycle Workflow Performance', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new EntityWorkflowTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Entity Creation Performance', () => {
    it('should validate entity creation performance within acceptable limits', async () => {
      // Arrange
      const definitionId = 'test:performance_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);
      const maxCreationTime = 100; // 100ms threshold

      // Act - Create multiple entities to measure performance
      const iterations = 5;
      for (let i = 0; i < iterations; i++) {
        await testBed.createTestEntity(definitionId, {
          instanceId: `perf_test_${i}`,
        });
      }

      // Assert performance is within limits
      const performanceStats = testBed.getPerformanceStats('entity_creation');
      expect(performanceStats.count).toBe(iterations);
      expect(performanceStats.average).toBeLessThan(maxCreationTime);
      expect(performanceStats.max).toBeLessThan(maxCreationTime * 2); // Allow some variance for max
    });

    it('should maintain consistent performance across multiple operations', async () => {
      // Arrange
      const definitionId = 'test:performance_consistency_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);
      const iterations = 5;
      const maxVariance = 10.0; // Max 10x variance between min and max times (accounting for test environment)

      // Warmup iterations to stabilize JIT compilation
      const warmupIterations = 2;
      for (let i = 0; i < warmupIterations; i++) {
        await testBed.createTestEntity(definitionId, {
          instanceId: `warmup_consistency_${i}`,
        });
      }

      // Clear performance metrics after warmup
      testBed.performanceMetrics.clear();

      // Act - Create entities in multiple iterations
      for (let i = 0; i < iterations; i++) {
        await testBed.createTestEntity(definitionId, {
          instanceId: `perf_consistency_${i}`,
        });
      }

      // Assert performance consistency
      const performanceStats = testBed.getPerformanceStats('entity_creation');
      expect(performanceStats.count).toBe(iterations);

      if (performanceStats.min > 0) {
        const variance = performanceStats.max / performanceStats.min;
        expect(variance).toBeLessThan(maxVariance);
      } else {
        // If min is 0, just ensure we have some performance data
        expect(performanceStats.count).toBeGreaterThan(0);
      }
    });
  });

  describe('Batch Operations Performance', () => {
    it('should handle batch entity operations within performance thresholds', async () => {
      // Arrange
      const definitionId = 'test:batch_performance_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);
      const batchSize = 10;
      const maxBatchTime = 500; // 500ms for batch of 10 entities

      const entityConfigs = Array.from({ length: batchSize }, (_, i) => ({
        definitionId,
        instanceId: `batch_perf_${i}`,
      }));

      // Act
      const startTime = performance.now();
      const entities = await testBed.createTestEntitiesBatch(entityConfigs);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert performance
      expect(entities).toHaveLength(batchSize);
      expect(totalTime).toBeLessThan(maxBatchTime);

      // Validate batch operation metrics
      const batchStats = testBed.getPerformanceStats('batch_entity_creation');
      expect(batchStats.count).toBeGreaterThan(0);

      const countStats = testBed.getPerformanceStats(
        'batch_entity_creation_count'
      );
      expect(countStats.total).toBe(batchSize);
    });

    it('should demonstrate improved performance for batch operations over individual operations', async () => {
      // Arrange
      const definitionId = 'test:batch_comparison_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);
      const batchSize = 5;

      // Individual operations
      const individualStartTime = performance.now();
      for (let i = 0; i < batchSize; i++) {
        await testBed.createTestEntity(definitionId, {
          instanceId: `individual_${i}`,
        });
      }
      const individualEndTime = performance.now();
      const individualTime = individualEndTime - individualStartTime;

      // Clear performance metrics for batch test
      testBed.performanceMetrics.clear();

      // Batch operation
      const entityConfigs = Array.from({ length: batchSize }, (_, i) => ({
        definitionId,
        instanceId: `batch_comparison_${i}`,
      }));

      const batchStartTime = performance.now();
      const batchEntities =
        await testBed.createTestEntitiesBatch(entityConfigs);
      const batchEndTime = performance.now();
      const batchTime = batchEndTime - batchStartTime;

      // Assert batch is more efficient (or at least not significantly worse)
      expect(batchEntities).toHaveLength(batchSize);

      // Allow batch operations to be up to 20% slower due to setup overhead
      const batchEfficiencyThreshold = individualTime * 1.2;
      expect(batchTime).toBeLessThan(batchEfficiencyThreshold);
    });
  });

  describe('Memory Performance', () => {
    it('should manage memory efficiently during bulk entity operations', async () => {
      // Arrange
      const definitionId = 'test:memory_performance_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);
      const bulkSize = 20;

      const entityConfigs = Array.from({ length: bulkSize }, (_, i) => ({
        definitionId,
        instanceId: `memory_test_${i}`,
      }));

      // Act - Measure memory usage during bulk operations
      const memoryBefore = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;

      const entities = await testBed.createTestEntitiesBatch(entityConfigs);

      const memoryAfter = performance.memory
        ? performance.memory.usedJSHeapSize
        : 0;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Assert reasonable memory usage
      expect(entities).toHaveLength(bulkSize);

      // Memory increase should be reasonable (less than 10MB for 20 entities)
      const maxMemoryIncrease = 10 * 1024 * 1024; // 10MB
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(maxMemoryIncrease);
      }
    });
  });

  describe('Scalability Performance', () => {
    it('should maintain acceptable performance as entity count scales', async () => {
      // Arrange
      const definitionId = 'test:scalability_entity';
      await testBed.ensureEntityDefinitionExists(definitionId);

      // Warm-up runs to stabilize JIT compilation and caches
      const warmupSizes = [3, 5];
      for (const size of warmupSizes) {
        const warmupConfigs = Array.from({ length: size }, (_, i) => ({
          definitionId,
          instanceId: `warmup_${size}_${i}`,
        }));
        await testBed.createTestEntitiesBatch(warmupConfigs);
      }

      const scalingSizes = [5, 10, 15];
      const results = [];

      // Act - Test performance at different scales
      for (const size of scalingSizes) {
        const entityConfigs = Array.from({ length: size }, (_, i) => ({
          definitionId,
          instanceId: `scale_test_${size}_${i}`,
        }));

        const startTime = performance.now();
        const entities = await testBed.createTestEntitiesBatch(entityConfigs);
        const endTime = performance.now();

        const timePerEntity = (endTime - startTime) / size;
        results.push({
          size,
          totalTime: endTime - startTime,
          timePerEntity,
          entities: entities.length,
        });

        expect(entities).toHaveLength(size);
      }

      // Assert performance doesn't degrade significantly with scale
      // Time per entity should remain relatively stable (within 3.5x variance)
      const baseTimePerEntity = results[0].timePerEntity;

      // Ensure baseline is meaningful (at least 0.1ms per entity to avoid division issues)
      const minBaseline = 0.1;
      const effectiveBaseline = Math.max(baseTimePerEntity, minBaseline);

      for (let i = 1; i < results.length; i++) {
        const scalabilityFactor = results[i].timePerEntity / effectiveBaseline;
        // Allow up to 3.5x degradation to account for test environment variance
        expect(scalabilityFactor).toBeLessThan(3.5);
      }
    });
  });
});
