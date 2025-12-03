/**
 * @file entityFactoryResourceExhaustion.memory.test.js
 * @description Memory tests for entity factory resource exhaustion scenarios
 *
 * Tests the factory's ability to handle large-scale entity creation
 * while monitoring memory growth and ensuring system stability.
 *
 * Run with: npm run test:memory -- tests/memory/entities/entityFactoryResourceExhaustion.memory.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityWorkflowTestBed from '../../e2e/entities/common/entityWorkflowTestBed.js';

describe('Entity Factory Resource Exhaustion - Memory Tests', () => {
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

  describe('Resource Exhaustion Handling', () => {
    it('should properly handle and report factory resource exhaustion', async () => {
      // Arrange
      const entityLimit = 1000; // Large number to test resource handling
      const entities = [];
      const memorySnapshots = [];
      const creationErrors = [];

      const definitionId = 'test:resource_test';
      await testBed.ensureEntityDefinitionExists(definitionId, {
        id: definitionId,
        components: {
          'test:large_data': {
            // Create a large component to consume memory
            data: Array(1000)
              .fill(0)
              .map((_, i) => ({
                id: `item_${i}`,
                value: Math.random(),
                description: 'x'.repeat(100), // 100 chars per item
              })),
          },
        },
      });

      // Register schema for large data
      await testBed.validator.addSchema(
        {
          type: 'object',
          properties: {
            data: { type: 'array' },
          },
        },
        'test:large_data'
      );

      // Take initial memory snapshot
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage();
      memorySnapshots.push({
        index: 0,
        heapUsed: initialMemory.heapUsed / (1024 * 1024), // MB
      });

      // Act - Create many entities to stress the factory
      for (let i = 0; i < entityLimit; i++) {
        try {
          const entity = await testBed.createTestEntity(definitionId, {
            instanceId: `resource_entity_${i}`,
            validateDefinition: i === 0, // Only validate first to save time
          });

          entities.push(entity.id);

          // Take memory snapshots periodically
          if (i % 100 === 0) {
            const currentMemory = process.memoryUsage();
            memorySnapshots.push({
              index: i,
              heapUsed: currentMemory.heapUsed / (1024 * 1024), // MB
            });
          }
        } catch (error) {
          creationErrors.push({
            index: i,
            error: error.message,
          });

          // Stop if we hit too many errors
          if (creationErrors.length > 10) {
            break;
          }
        }
      }

      // Calculate memory growth
      const finalMemory = process.memoryUsage();
      const memoryGrowth =
        (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024); // MB
      const memoryPerEntity = memoryGrowth / entities.length;

      // Assert resource usage is reasonable
      expect(entities.length).toBeGreaterThan(0); // Should create some entities
      expect(creationErrors.length).toBeLessThan(10); // Should not fail excessively
      expect(memoryPerEntity).toBeLessThan(1); // < 1MB per entity average

      // Verify system can still function after stress test
      const postStressEntity = await testBed.createTestEntity(definitionId, {
        instanceId: 'post_stress_validation',
      });

      expect(postStressEntity).toBeDefined();

      // Log resource metrics
      testBed.logger.info(`Resource Test Results:
        Entities Created: ${entities.length}/${entityLimit}
        Creation Errors: ${creationErrors.length}
        Memory Growth: ${memoryGrowth.toFixed(2)} MB
        Memory Per Entity: ${memoryPerEntity.toFixed(3)} MB
        Final Heap: ${(finalMemory.heapUsed / (1024 * 1024)).toFixed(2)} MB`);
    });
  });
});
