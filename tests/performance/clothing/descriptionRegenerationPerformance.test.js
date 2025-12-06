/**
 * @file Performance tests for the REGENERATE_DESCRIPTION operation
 * @description Validates that description regeneration meets <100ms requirement
 * and handles complex entity configurations efficiently
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';
import { ClothingIntegrationTestBed } from '../../common/clothing/clothingIntegrationTestBed.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('Description Regeneration Performance', () => {
  let testBed;
  let clothingTestBed;
  let performanceTracker;
  let entityManager;
  let operationHandler;
  let bodyDescriptionComposer;

  beforeAll(async () => {
    // Set up performance tracking
    testBed = createPerformanceTestBed();
    performanceTracker = testBed.createPerformanceTracker();

    // Set up clothing integration test bed for entity management
    clothingTestBed = new ClothingIntegrationTestBed();
    await clothingTestBed.setup();

    entityManager = clothingTestBed.getEntityManager();

    // Add the addComponent method that's required by RegenerateDescriptionHandler
    entityManager.addComponent = jest.fn((entityId, componentId, data) => {
      const entity = entityManager.entities.get(entityId);
      if (entity) {
        if (!entity.components) {
          entity.components = {};
        }
        entity.components[componentId] = data;
      }
      return Promise.resolve();
    });

    // Set up body description composer with mocked compose functionality
    bodyDescriptionComposer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder:
        clothingTestBed.createMockBodyPartDescriptionBuilder(),
      bodyGraphService: clothingTestBed.createMockBodyGraphService(),
      entityFinder: entityManager,
      anatomyFormattingService:
        clothingTestBed.createMockAnatomyFormattingService(),
      partDescriptionGenerator:
        clothingTestBed.createMockPartDescriptionGenerator(),
      equipmentDescriptionService: clothingTestBed.services.get(
        'equipmentDescriptionService'
      ),
      logger: clothingTestBed.logger,
    });

    // Mock the composeDescription method to return a realistic description
    bodyDescriptionComposer.composeDescription = jest.fn(async (entity) => {
      const equipment = entityManager.getComponentData(
        entity.instanceId,
        'clothing:equipment'
      );
      const itemCount = equipment
        ? Object.keys(equipment.equipped || {}).length
        : 0;
      return `A test entity with ${itemCount} equipped items. The entity has a humanoid form with various clothing and equipment pieces.`;
    });

    // Set up operation handler
    operationHandler = new RegenerateDescriptionHandler({
      entityManager,
      bodyDescriptionComposer,
      logger: clothingTestBed.logger,
      safeEventDispatcher: clothingTestBed.eventDispatcher,
    });
  });

  afterAll(async () => {
    await clothingTestBed.cleanup();
    testBed.cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Performance Requirements', () => {
    // Helper function to create entity with clothing
    const createEntityWithClothing = (clothingItems) => {
      const entityId = `test_entity_${Math.random().toString(36).substr(2, 9)}`;
      const entity = createEntityInstance({
        instanceId: entityId,
        definitionId: 'core:actor',
        baseComponents: {
          'core:description': { text: 'A test entity' },
          'core:anatomy': { blueprint: 'humanoid' },
        },
        overrides: {
          'clothing:equipment': {
            equipped: clothingItems.reduce((acc, item, index) => {
              acc[`slot_${index}`] = item;
              return acc;
            }, {}),
          },
        },
        logger: clothingTestBed.logger,
      });

      // Register entity with entity manager
      entityManager.entities.set(entityId, entity);
      return entity;
    };

    it('should regenerate simple entity description within 100ms', async () => {
      // Setup: Simple entity with 2-3 clothing items
      const entity = createEntityWithClothing(['hat', 'shirt', 'pants']);

      // Create execution context
      const executionContext = {
        actorId: entity.instanceId,
        targetId: null,
        locationId: 'test_location',
      };

      // Measure: Single description regeneration
      const benchmark = performanceTracker.startBenchmark(
        'simple_entity_regeneration'
      );

      await operationHandler.execute(
        {
          entity_ref: entity.instanceId,
        },
        executionContext
      );

      const metrics = benchmark.end();

      // Assert: Within 100ms requirement
      expect(metrics.totalTime).toBeLessThan(100);

      // Log: Actual performance for analysis
      console.log(
        `Simple entity description regeneration: ${metrics.totalTime.toFixed(2)}ms`
      );
    });

    it('should handle complex entities within 100ms', async () => {
      // Setup: Complex entity with 20+ clothing items
      const clothingItems = Array.from({ length: 25 }, (_, i) => `item_${i}`);
      const complexEntity = createEntityWithClothing(clothingItems);

      // Add additional complexity with anatomy details
      entityManager.setComponentData(complexEntity.instanceId, 'core:anatomy', {
        blueprint: 'detailed_human',
        customParts: ['rings', 'necklace', 'watch'],
      });

      const executionContext = {
        actorId: complexEntity.instanceId,
        targetId: null,
        locationId: 'test_location',
      };

      // Measure: Complex description regeneration
      const measurements = [];

      for (let i = 0; i < 10; i++) {
        const benchmark = performanceTracker.startBenchmark(
          `complex_entity_run_${i}`
        );

        await operationHandler.execute(
          {
            entity_ref: complexEntity.instanceId,
          },
          executionContext
        );

        const metrics = benchmark.end();
        measurements.push(metrics.totalTime);
      }

      const averageTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      const maxTime = Math.max(...measurements);

      // Assert: Average and max times within limits
      expect(averageTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(150); // Allow some variance for complex cases

      console.log(
        `Complex entity - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`
      );
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple simultaneous description regenerations', async () => {
      // Setup: Multiple entities with clothing
      const entities = Array.from({ length: 10 }, (_, i) => {
        const entityId = `entity_${i}`;
        const entity = createEntityInstance({
          instanceId: entityId,
          definitionId: 'core:actor',
          baseComponents: {
            'core:description': { text: `Test entity ${i}` },
          },
          overrides: {
            'clothing:equipment': {
              equipped: {
                head: 'hat',
                torso: 'shirt',
                legs: 'pants',
                feet: 'shoes',
              },
            },
          },
          logger: clothingTestBed.logger,
        });
        entityManager.entities.set(entityId, entity);
        return entity;
      });

      // Measure: Concurrent regeneration operations
      const benchmark = performanceTracker.startBenchmark(
        'concurrent_operations'
      );

      const promises = entities.map((entity) =>
        operationHandler.execute(
          {
            entity_ref: entity.instanceId,
          },
          {
            actorId: entity.instanceId,
            targetId: null,
            locationId: 'test_location',
          }
        )
      );

      await Promise.all(promises);

      const metrics = benchmark.end();
      const averageTimePerEntity = metrics.totalTime / entities.length;

      // Assert: Concurrent operations remain efficient
      expect(averageTimePerEntity).toBeLessThan(120); // Slight overhead allowed for concurrency
      expect(metrics.totalTime).toBeLessThan(500); // Total batch should complete quickly

      console.log(
        `Concurrent operations - ${entities.length} entities in ${metrics.totalTime.toFixed(2)}ms`
      );
    });

    it('should maintain performance under high concurrency', async () => {
      // Test with 50+ concurrent operations
      const entityCount = 50;
      const entities = Array.from({ length: entityCount }, (_, i) => {
        const entityId = `high_concurrency_entity_${i}`;
        const entity = createEntityInstance({
          instanceId: entityId,
          definitionId: 'core:actor',
          baseComponents: {
            'core:description': { text: `Entity ${i}` },
          },
          overrides: {
            'clothing:equipment': {
              equipped: { slot_0: `item_${i}` },
            },
          },
          logger: clothingTestBed.logger,
        });
        entityManager.entities.set(entityId, entity);
        return entity;
      });

      const benchmark = performanceTracker.startBenchmark('high_concurrency', {
        trackMemory: true,
      });

      const promises = entities.map((entity) =>
        operationHandler.execute(
          { entity_ref: entity.instanceId },
          {
            actorId: entity.instanceId,
            targetId: null,
            locationId: 'test_location',
          }
        )
      );

      await Promise.all(promises);
      const metrics = await benchmark.endWithAdvancedMemoryTracking();

      // Assert: No significant performance degradation
      const avgTimePerEntity = metrics.totalTime / entityCount;
      expect(avgTimePerEntity).toBeLessThan(150);

      // Check memory usage remains reasonable
      const memoryGrowthMB = metrics.memoryUsage
        ? metrics.memoryUsage.growth / (1024 * 1024)
        : 0;
      expect(memoryGrowthMB).toBeLessThan(50); // Less than 50MB growth

      console.log(
        `High concurrency - ${entityCount} entities: ${metrics.totalTime.toFixed(2)}ms total, ${avgTimePerEntity.toFixed(2)}ms avg`
      );
    });
  });

  describe('Scalability Tests', () => {
    it('should scale with increasing entity complexity', async () => {
      const complexityLevels = [1, 5, 10, 15, 20, 25, 30];
      const results = [];

      for (const itemCount of complexityLevels) {
        const clothingItems = Array.from(
          { length: itemCount },
          (_, i) => `item_${i}`
        );
        const entity = createEntityInstance({
          instanceId: `scaling_test_${itemCount}`,
          definitionId: 'core:actor',
          baseComponents: {
            'core:description': { text: `Entity with ${itemCount} items` },
          },
          overrides: {
            'clothing:equipment': {
              equipped: clothingItems.reduce((acc, item, index) => {
                acc[`slot_${index}`] = item;
                return acc;
              }, {}),
            },
          },
          logger: clothingTestBed.logger,
        });
        entityManager.entities.set(entity.instanceId, entity);

        const executionContext = {
          actorId: entity.instanceId,
          targetId: null,
          locationId: 'test_location',
        };

        // Measure performance at this complexity level
        const times = [];
        for (let run = 0; run < 5; run++) {
          const benchmark = performanceTracker.startBenchmark(
            `complexity_${itemCount}_run_${run}`
          );

          await operationHandler.execute(
            {
              entity_ref: entity.instanceId,
            },
            executionContext
          );

          const metrics = benchmark.end();
          times.push(metrics.totalTime);
        }

        const avgTime = times.reduce((a, b) => a + b) / times.length;
        results.push({ itemCount, avgTime });

        // Clean up entity for next test
        entityManager.entities.delete(entity.instanceId);
      }

      // Assert: Performance scales reasonably with absolute bounds
      const maxComplexityTime = results[results.length - 1].avgTime;
      expect(maxComplexityTime).toBeLessThan(150);

      // Verify scaling doesn't degrade catastrophically (allow O(n) with variance)
      // Note: Relative scaling factors amplify measurement noise, so we use generous bounds
      const firstTime = results[0].avgTime;
      const lastTime = results[results.length - 1].avgTime;
      const scalingFactor = lastTime / firstTime;
      const itemIncreaseFactor = 30; // 30 items vs 1 item

      // Performance should not degrade worse than O(n²)
      // Allow 2x variance buffer for JavaScript GC, JIT, and measurement overhead
      expect(scalingFactor).toBeLessThan(
        itemIncreaseFactor * itemIncreaseFactor * 0.1
      ); // < 90

      // Log: Scaling curve for analysis
      console.log('Scaling results:');
      results.forEach((result) => {
        console.log(
          `  ${result.itemCount} items: ${result.avgTime.toFixed(2)}ms`
        );
      });
    });

    it('should handle large numbers of entities efficiently', async () => {
      // Test with 100+ entities in game state
      const entityCount = 100;
      const entities = [];

      // Create entities with varying complexity
      for (let i = 0; i < entityCount; i++) {
        const clothingCount = (i % 10) + 1; // 1 to 10 items
        const entity = createEntityInstance({
          instanceId: `large_scale_entity_${i}`,
          definitionId: 'core:actor',
          baseComponents: {
            'core:description': { text: `Entity ${i}` },
          },
          overrides: {
            'clothing:equipment': {
              equipped: Array.from({ length: clothingCount }, (_, j) => ({
                [`slot_${j}`]: `item_${i}_${j}`,
              })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
            },
          },
          logger: clothingTestBed.logger,
        });
        entityManager.entities.set(entity.instanceId, entity);
        entities.push(entity);
      }

      // Measure batch processing performance
      const benchmark = performanceTracker.startBenchmark('large_scale_batch', {
        trackMemory: true,
      });

      // Process a subset to simulate real-world usage
      const entitiesToProcess = entities.slice(0, 20);
      await Promise.all(
        entitiesToProcess.map((entity) =>
          operationHandler.execute(
            { entity_ref: entity.instanceId },
            {
              actorId: entity.instanceId,
              targetId: null,
              locationId: 'test_location',
            }
          )
        )
      );

      const metrics = await benchmark.endWithAdvancedMemoryTracking();

      // Assert: No O(n²) performance issues
      const timePerEntity = metrics.totalTime / entitiesToProcess.length;
      expect(timePerEntity).toBeLessThan(100); // Should remain efficient even with many entities

      // Check memory usage remains reasonable
      const memoryPerEntity = metrics.memoryUsage
        ? metrics.memoryUsage.growth / entityCount
        : 0;
      expect(memoryPerEntity).toBeLessThan(10 * 1024); // Less than 10KB per entity

      console.log(
        `Large-scale test: ${entityCount} entities created, ${entitiesToProcess.length} processed in ${metrics.totalTime.toFixed(2)}ms`
      );

      // Clean up
      entities.forEach((entity) =>
        entityManager.entities.delete(entity.instanceId)
      );
    });
  });

  describe('Integration Performance', () => {
    it('should maintain performance within full rule execution', async () => {
      // Setup: Complete rule processing context
      // Note: This test simulates the complete flow but focuses on the REGENERATE_DESCRIPTION operation
      const testActor = createEntityInstance({
        instanceId: 'test_actor',
        definitionId: 'core:actor',
        baseComponents: {
          'core:description': { text: 'Test actor' },
          'clothing:equipment': {
            equipped: {
              head: 'test_hat',
              torso: 'test_shirt',
              legs: 'test_pants',
            },
          },
        },
        overrides: {},
        logger: clothingTestBed.logger,
      });
      entityManager.entities.set(testActor.instanceId, testActor);

      // Create a mock rule execution that includes description regeneration
      const simulateRuleExecution = async () => {
        // Simulate clothing removal
        const equipment = entityManager.getComponentData(
          testActor.instanceId,
          'clothing:equipment'
        );
        if (equipment && equipment.equipped) {
          delete equipment.equipped.head;
          entityManager.setComponentData(
            testActor.instanceId,
            'clothing:equipment',
            equipment
          );
        }

        // Execute description regeneration (the focus of this test)
        await operationHandler.execute(
          { entity_ref: testActor.instanceId },
          {
            actorId: testActor.instanceId,
            targetId: null,
            locationId: 'test_location',
          }
        );
      };

      // Measure: Full rule execution including description regeneration
      const measurements = [];

      for (let i = 0; i < 20; i++) {
        const benchmark = performanceTracker.startBenchmark(
          `rule_execution_${i}`
        );

        await simulateRuleExecution();

        const metrics = benchmark.end();
        measurements.push(metrics.totalTime);

        // Reset equipment for next iteration
        if (!testActor.components) {
          testActor.components = {};
        }
        testActor.components['clothing:equipment'] = {
          equipped: {
            head: 'test_hat',
            torso: 'test_shirt',
            legs: 'test_pants',
          },
        };
      }

      const averageRuleTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      const minTime = Math.min(...measurements);
      const maxTime = Math.max(...measurements);

      // Assert: Rule execution remains fast
      expect(averageRuleTime).toBeLessThan(200); // Allow overhead for full rule processing
      expect(maxTime).toBeLessThan(250); // Maximum should still be reasonable

      console.log(
        `Full rule execution with description update:\n` +
          `  Average: ${averageRuleTime.toFixed(2)}ms\n` +
          `  Min: ${minTime.toFixed(2)}ms\n` +
          `  Max: ${maxTime.toFixed(2)}ms`
      );
    });
  });
});
