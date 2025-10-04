/**
 * @file Memory tests for description regeneration operations
 * @description Tests memory usage patterns and leak detection for the REGENERATE_DESCRIPTION operation
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

describe('Description Regeneration - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  let testBed;
  let clothingTestBed;
  let entityManager;
  let operationHandler;
  let bodyDescriptionComposer;

  beforeAll(async () => {
    // Set up performance tracking for benchmarking
    testBed = createPerformanceTestBed();

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

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Memory leak detection', () => {
    it('should not leak memory during repeated description regenerations', async () => {
      // Setup: Single entity for repeated operations
      const entity = createEntityInstance({
        instanceId: 'memory_test_entity',
        definitionId: 'core:actor',
        baseComponents: {
          'core:description': { text: 'Memory test entity' },
        },
        overrides: {
          'clothing:equipment': {
            equipped: {
              head: 'hat',
              torso: 'shirt',
              legs: 'pants',
              feet: 'boots',
            },
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

      // Establish baseline with forced GC and stabilization
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Execute: Many repeated operations (adjust for CI environment)
      const iterations = global.memoryTestUtils.isCI() ? 800 : 1000;
      for (let i = 0; i < iterations; i++) {
        await operationHandler.execute(
          {
            entity_ref: entity.instanceId,
          },
          executionContext
        );

        // Force garbage collection every 100 operations
        if (i % 100 === 0 && global.gc) {
          global.gc();
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      // Allow memory to stabilize with extended time
      await new Promise((resolve) => setTimeout(resolve, 200));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage(8);

      // Clear references and force cleanup
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(8);

      // Calculate memory metrics
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);
      const memoryPerOperation = memoryGrowth / iterations;

      // Memory efficiency assertions - adjusted for test environment
      const maxMemoryGrowthMB = global.memoryTestUtils.isCI() ? 3 : 2.5; // Peak growth during operations
      const maxMemoryLeakageMB = global.memoryTestUtils.isCI() ? 0.5 : 0.3; // Memory not reclaimed after GC
      const maxMemoryPerOperationBytes = global.memoryTestUtils.isCI()
        ? 3000
        : 2500; // Per operation overhead

      expect(memoryGrowth).toBeLessThan(maxMemoryGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxMemoryLeakageMB * 1024 * 1024);
      expect(memoryPerOperation).toBeLessThan(maxMemoryPerOperationBytes);

      console.log(
        `Memory leak test - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Leakage: ${(memoryLeakage / 1024 / 1024).toFixed(2)}MB, ` +
          `Per Operation: ${memoryPerOperation.toFixed(2)} bytes, ` +
          `Iterations: ${iterations}`
      );
    });

    it('should manage garbage collection efficiently during bulk operations', async () => {
      // Test GC pressure during operations
      const entityCount = global.memoryTestUtils.isCI() ? 15 : 20;
      const operationsPerEntity = global.memoryTestUtils.isCI() ? 40 : 50;

      // Create multiple entities
      const entities = Array.from({ length: entityCount }, (_, i) => {
        const entity = createEntityInstance({
          instanceId: `gc_test_entity_${i}`,
          definitionId: 'core:actor',
          baseComponents: {
            'core:description': { text: `GC test entity ${i}` },
          },
          overrides: {
            'clothing:equipment': { equipped: { slot_0: `item_${i}` } },
          },
          logger: clothingTestBed.logger,
        });
        entityManager.entities.set(entity.instanceId, entity);
        return entity;
      });

      // Establish baseline with forced GC
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Track memory across operations
      const memorySnapshots = [];

      for (let round = 0; round < operationsPerEntity; round++) {
        // Run operations for all entities
        await Promise.all(
          entities.map((entity) =>
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

        // Measure memory after each round
        if (round % 10 === 0) {
          const memory = await global.memoryTestUtils.getStableMemoryUsage();
          memorySnapshots.push(memory);
        }
      }

      // Allow memory to stabilize
      await new Promise((resolve) => setTimeout(resolve, 300));
      const peakMemory = Math.max(...memorySnapshots);

      // Force cleanup and final measurement
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage(8);

      // Calculate memory metrics
      const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
      const memoryLeakage = Math.max(0, finalMemory - baselineMemory);
      const memoryReclaimed =
        peakMemory > finalMemory ? (peakMemory - finalMemory) / peakMemory : 0;

      // GC efficiency assertions - ensure memory is properly managed
      const maxMemoryGrowthMB = global.memoryTestUtils.isCI() ? 15 : 12; // Peak during operations
      const maxMemoryLeakageMB = global.memoryTestUtils.isCI() ? 2 : 1.5; // Memory not reclaimed

      expect(memoryGrowth).toBeLessThan(maxMemoryGrowthMB * 1024 * 1024);
      expect(memoryLeakage).toBeLessThan(maxMemoryLeakageMB * 1024 * 1024);

      // More lenient check - just ensure memory doesn't grow unbounded
      expect(finalMemory).toBeLessThan(peakMemory * 1.5); // Final memory shouldn't be more than 1.5x peak

      console.log(
        `GC efficiency test - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
          `Peak: ${(peakMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB, ` +
          `Leakage: ${(memoryLeakage / 1024 / 1024).toFixed(2)}MB, ` +
          `Reclaimed: ${(memoryReclaimed * 100).toFixed(1)}%, ` +
          `Entities: ${entityCount}, Operations per entity: ${operationsPerEntity}`
      );
    });
  });
});
