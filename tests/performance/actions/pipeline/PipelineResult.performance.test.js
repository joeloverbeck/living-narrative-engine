/**
 * @file Performance benchmarks for PipelineResult operations
 * @description Performance tests for PipelineResult chaining, concurrent operations, and data processing
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

describe('PipelineResult - Performance Tests', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Large Data Processing Performance', () => {
    it('should handle large data sets efficiently (target: <1s for 1000 entities)', () => {
      // Arrange - create large data set
      const largeEntitySet = Array.from({ length: 1000 }, (_, i) => ({
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

      const startTime = Date.now();

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
      const endTime = Date.now();

      // Assert - verify performance characteristics
      expect(result.success).toBe(true);
      expect(result.data.entities).toHaveLength(1000);
      expect(result.data.entities[0].processed).toBe(true);
      expect(result.data.processingSummary.totalEntities).toBe(1000);

      // Performance assertion
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent pipeline operations efficiently (target: <200ms for 10 concurrent ops)', async () => {
      // Arrange - simulate concurrent pipeline operations
      const createConcurrentOperation = (id) => {
        const initialResult = PipelineResult.success({
          data: { operationId: id, entities: [] },
        });

        const dataFetchService = (data) => {
          // Simulate async data fetching
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                ActionResult.success({
                  ...data,
                  entities: Array.from({ length: 100 }, (_, i) => ({
                    id: `entity_${data.operationId}_${i}`,
                    data: `data_${i}`,
                  })),
                  fetchedAt: Date.now(),
                })
              );
            }, Math.random() * 50); // Random delay 0-50ms
          });
        };

        return dataFetchService(initialResult.data);
      };

      const startTime = Date.now();

      // Act - run multiple concurrent operations
      const concurrentOperations = Array.from({ length: 10 }, (_, i) =>
        createConcurrentOperation(i)
      );

      const results = await Promise.all(concurrentOperations);
      const endTime = Date.now();

      // Assert - verify concurrent execution
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toBeInstanceOf(ActionResult);
        expect(result.success).toBe(true);
        expect(result.value.operationId).toBe(index);
        expect(result.value.entities).toHaveLength(100);
      });

      // Performance assertion - should complete faster than sequential execution
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(200); // Much faster than 10 * 50ms sequential
    });
  });

  describe('Chain Depth Performance', () => {
    it('should handle deeply nested pipeline chains without stack overflow (target: 100 levels)', () => {
      // Arrange - create deep chain to test stack safety
      let result = PipelineResult.success({ data: { value: 0, depth: 0 } });

      const startTime = Date.now();

      // Act - create deep chain (100 levels)
      for (let i = 0; i < 100; i++) {
        result = result.chainActionResult((data) => {
          return ActionResult.success({
            ...data,
            value: data.value + 1,
            depth: data.depth + 1,
          });
        });
      }

      const endTime = Date.now();

      // Assert - verify deep chaining works
      expect(result.success).toBe(true);
      expect(result.data.value).toBe(100);
      expect(result.data.depth).toBe(100);

      // Performance assertion - should complete quickly without stack issues
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(100); // Should be very fast for simple operations
    });
  });
});