/**
 * @file Performance tests for operation handlers
 * @description Tests performance characteristics of operation handlers extracted from integration tests
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ModifyArrayFieldHandler from '../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import { SimpleEntityManager } from '../common/entities/index.js';

const ENTITY_ID = 'test_entity';
const COMPONENT_TYPE = 'test:component';

describe('Operation Handler Performance Tests', () => {
  let handler;
  let entityManager;
  let executionContext;
  let mockLogger;
  let mockDispatcher;

  beforeEach(() => {
    // Create proper logger with all required methods
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };

    // Create entity manager using SimpleEntityManager
    entityManager = new SimpleEntityManager();

    // Create the handler
    handler = new ModifyArrayFieldHandler({
      entityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    // Create execution context
    executionContext = {
      evaluationContext: {
        actor: { id: 'actor_1' },
        event: {},
        entityManager,
      },
      placeholderResolver: {
        resolvePlaceholders: (template) => template,
      },
    };

    // Create test entity using addComponent (SimpleEntityManager creates entities on-demand)
    entityManager.addComponent(ENTITY_ID, COMPONENT_TYPE, { items: [] });
  });

  afterEach(() => {
    // Clear entity manager
    entityManager.entities.clear();
  });

  describe('ModifyArrayFieldHandler Performance', () => {
    test('should handle large data operations efficiently', async () => {
      // Create a large array for performance testing
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
      entityManager.addComponent(ENTITY_ID, COMPONENT_TYPE, {
        largeItems: largeArray,
      });

      const params = {
        entity_ref: ENTITY_ID,
        component_type: COMPONENT_TYPE,
        field: 'largeItems',
        mode: 'push',
        value: 'new_large_item',
      };

      const startTime = performance.now();
      await handler.execute(params, executionContext);
      const endTime = performance.now();

      const operationTime = endTime - startTime;

      // Verify operation completed efficiently (should be fast even with large arrays)
      expect(operationTime).toBeLessThan(100); // 100ms threshold

      // Verify the operation worked correctly
      const updatedComponent = entityManager.getComponentData(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(updatedComponent.largeItems).toHaveLength(1001);
      expect(updatedComponent.largeItems[1000]).toBe('new_large_item');

      console.log(
        `Large array modification completed in ${operationTime.toFixed(2)}ms`
      );
    });

    test('should handle multiple rapid operations efficiently', async () => {
      // Setup initial array
      entityManager.addComponent(ENTITY_ID, COMPONENT_TYPE, {
        rapidItems: [],
      });

      const operationCount = 100;
      const times = [];

      // Perform multiple rapid operations
      for (let i = 0; i < operationCount; i++) {
        const params = {
          entity_ref: ENTITY_ID,
          component_type: COMPONENT_TYPE,
          field: 'rapidItems',
          mode: 'push',
          value: `rapid_item_${i}`,
        };

        const startTime = performance.now();
        await handler.execute(params, executionContext);
        const endTime = performance.now();

        times.push(endTime - startTime);
      }

      // Calculate performance metrics
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const averageTime = totalTime / operationCount;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(
        `\nRapid Operations Performance (${operationCount} operations):`
      );
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time: ${averageTime.toFixed(3)}ms`);
      console.log(`  Max time: ${maxTime.toFixed(3)}ms`);
      console.log(`  Min time: ${minTime.toFixed(3)}ms`);

      // Performance expectations
      expect(averageTime).toBeLessThan(10); // Average < 10ms per operation
      expect(maxTime).toBeLessThan(50); // Max < 50ms per operation
      expect(totalTime).toBeLessThan(1000); // Total < 1s for 100 operations

      // Verify all operations succeeded
      const finalComponent = entityManager.getComponentData(
        ENTITY_ID,
        COMPONENT_TYPE
      );
      expect(finalComponent.rapidItems).toHaveLength(operationCount);
    });

    test('should maintain performance across different array sizes', async () => {
      const arraySizes = [10, 100, 500, 1000];
      const results = [];

      for (const size of arraySizes) {
        // Create array of specified size
        const testArray = Array.from({ length: size }, (_, i) => `item_${i}`);
        const testComponentType = `test:component_${size}`;

        entityManager.addComponent(`entity_${size}`, testComponentType, {
          testItems: testArray,
        });

        const params = {
          entity_ref: `entity_${size}`,
          component_type: testComponentType,
          field: 'testItems',
          mode: 'push',
          value: 'new_item',
        };

        // Perform multiple iterations for this size
        const iterations = 10;
        const iterationTimes = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          await handler.execute(params, executionContext);
          const endTime = performance.now();
          iterationTimes.push(endTime - startTime);
        }

        const avgTime =
          iterationTimes.reduce((sum, t) => sum + t, 0) / iterations;
        results.push({ size, avgTime });

        console.log(`Array size ${size}: ${avgTime.toFixed(3)}ms average`);
      }

      // Verify performance scaling is reasonable
      // Performance shouldn't degrade dramatically with size for simple push operations
      const baselineTime = results[0].avgTime;
      const largestTime = results[results.length - 1].avgTime;
      const scalingFactor = largestTime / baselineTime;

      expect(scalingFactor).toBeLessThan(20); // Should scale reasonably (adjusted for CI environment)
      console.log(`Performance scaling factor: ${scalingFactor.toFixed(2)}x`);
    });
  });
});
