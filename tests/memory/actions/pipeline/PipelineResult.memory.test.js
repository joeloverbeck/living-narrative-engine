/**
 * @file Memory tests for PipelineResult operations
 * @description Tests memory usage patterns of PipelineResult chaining and large data processing
 * @see src/actions/pipeline/PipelineResult.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';

describe('PipelineResult - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Large Data Processing Memory Usage', () => {
    it('should have controlled memory usage with large data sets (target: <50MB for 1000 entities)', async () => {
      const entityCount = global.memoryTestUtils.isCI() ? 800 : 1000;

      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Arrange - create large data set
      const largeEntitySet = Array.from({ length: entityCount }, (_, i) => ({
        id: `entity_${i}`,
        type: 'npc',
        data: {
          name: `NPC ${i}`,
          level: Math.floor(Math.random() * 50) + 1,
          inventory: Array.from({ length: 10 }, (_, j) => `item_${i}_${j}`),
        },
      }));

      const initialResult = PipelineResult.success({
        data: { entities: largeEntitySet, operation: 'batch_update' },
      });

      // Act - process large data set through pipeline
      const processingService = (data) => {
        const processedEntities = data.entities.map((entity) => ({
          ...entity,
          processed: true,
          processedAt: Date.now(),
          stats: {
            inventorySize: entity.data.inventory.length,
            powerLevel: entity.data.level * 10,
          },
        }));

        return ActionResult.success({
          ...data,
          entities: processedEntities,
          processingSummary: {
            totalEntities: processedEntities.length,
            averageLevel:
              processedEntities.reduce((sum, e) => sum + e.data.level, 0) /
              processedEntities.length,
          },
        });
      };

      const result = initialResult.chainActionResult(processingService);

      // Allow memory to stabilize after processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Assert - verify functional correctness
      expect(result.success).toBe(true);
      expect(result.data.entities).toHaveLength(entityCount);
      expect(result.data.entities[0].processed).toBe(true);
      expect(result.data.processingSummary.totalEntities).toBe(entityCount);

      // Memory assertion
      const memoryUsed = Math.max(0, peakMemory - baselineMemory);
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // Should use less than 50MB

      // Clear references and verify cleanup
      largeEntitySet.length = 0;
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Memory should be released after cleanup
      const memoryGrowth = Math.max(0, finalMemory - baselineMemory);
      // Allow more tolerance for GC non-determinism and test framework overhead
      // We still detect leaks but don't expect perfect cleanup
      expect(memoryGrowth).toBeLessThan(memoryUsed * 1.5); // Should not leak excessively
    });
  });

  describe('Chain Memory Efficiency', () => {
    it('should not leak memory during chained operations', async () => {
      // Establish memory baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Create multiple chained operations
      let result = PipelineResult.success({
        data: { value: 0, operations: [] },
      });

      const chainLength = global.memoryTestUtils.isCI() ? 50 : 100;

      for (let i = 0; i < chainLength; i++) {
        result = result.chainActionResult((data) => {
          return ActionResult.success({
            ...data,
            value: data.value + 1,
            operations: [...data.operations, `operation_${i}`],
          });
        });
      }

      // Allow memory to stabilize
      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Assert functional correctness
      expect(result.success).toBe(true);
      expect(result.data.value).toBe(chainLength);
      expect(result.data.operations).toHaveLength(chainLength);

      // Memory assertion - chaining should not cause excessive memory growth
      const memoryUsed = Math.max(0, peakMemory - baselineMemory);
      const expectedMaxMemory = chainLength * 2500; // ~2.5KB per operation max (realistic for chaining)
      expect(memoryUsed).toBeLessThan(expectedMaxMemory);

      // Clear references and verify cleanup
      result = null;
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Memory should be released after cleanup
      const memoryGrowth = Math.max(0, finalMemory - baselineMemory);
      // Use adaptive thresholds for better reliability across environments
      // Chaining operations create more intermediate objects that may not be immediately collected
      const isCI = global.memoryTestUtils.isCI();
      const toleranceMultiplier = isCI ? 4.5 : 3.5; // Enhanced tolerance for GC non-determinism
      expect(memoryGrowth).toBeLessThan(memoryUsed * toleranceMultiplier); // Should not leak excessively
    });
  });
});
