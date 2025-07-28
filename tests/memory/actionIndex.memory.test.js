/**
 * @file Memory tests for ActionIndex
 * @description Tests memory usage patterns and leak detection for ActionIndex
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionIndex } from '../../src/actions/actionIndex.js';
import { TestDataFactory } from '../common/actions/testDataFactory.js';
import { createMockLogger } from '../common/mockFactories/index.js';

describe('ActionIndex - Memory Tests', () => {
  jest.setTimeout(120000); // 2 minutes for memory stabilization

  let logger;
  let entityManager;
  let actionIndex;
  let testData;

  beforeEach(async () => {
    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();

    // Create logger
    logger = createMockLogger();

    // Create realistic entity manager that mimics production behavior
    const entities = new Map();
    entityManager = {
      entities,
      createEntity: (id) => {
        const entity = {
          id,
          components: {},
          hasComponent: (componentId) => componentId in entity.components,
          getComponentData: (componentId) =>
            entity.components[componentId] || null,
        };
        entities.set(id, entity);
        return entity;
      },
      getEntityById: (id) => entities.get(id),
      getEntityInstance: (id) => entities.get(id),
      addComponent: (entityId, componentId, data) => {
        const entity = entities.get(entityId);
        if (entity) {
          entity.components[componentId] = data;
        }
      },
      removeComponent: (entityId, componentId) => {
        const entity = entities.get(entityId);
        if (entity && entity.components[componentId]) {
          delete entity.components[componentId];
        }
      },
      getAllComponentTypesForEntity: (entityId) => {
        const entity =
          typeof entityId === 'string' ? entities.get(entityId) : entityId;
        return entity ? Object.keys(entity.components || {}) : [];
      },
      hasComponent: (entityId, componentId) => {
        const entity = entities.get(entityId);
        return entity ? componentId in entity.components : false;
      },
      clear: () => entities.clear(),
    };

    // Create ActionIndex instance
    actionIndex = new ActionIndex({ logger, entityManager });

    // Load test data
    testData = TestDataFactory.createCompleteTestDataset();
  });

  afterEach(async () => {
    entityManager.clear();
    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Index rebuild memory efficiency', () => {
    it('should not degrade with repeated rebuilds (memory leak test)', async () => {
      const rebuildCount = global.memoryTestUtils.isCI() ? 3 : 5;
      const actionsPerRebuild = global.memoryTestUtils.isCI() ? 150 : 200;

      // Establish baseline memory
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      const memorySnapshots = [];
      const rebuildTimes = [];

      for (let cycle = 0; cycle < rebuildCount; cycle++) {
        // Force garbage collection before measuring
        await global.memoryTestUtils.forceGCAndWait();
        const beforeMemory =
          await global.memoryTestUtils.getStableMemoryUsage();

        // Perform multiple rebuilds in this cycle
        const cycleStart = performance.now();
        for (let rebuild = 0; rebuild < 3; rebuild++) {
          const actions = Array.from({ length: actionsPerRebuild }, (_, i) => ({
            id: `cycle_${cycle}_rebuild_${rebuild}:action_${i}`,
            name: `Cycle ${cycle} Rebuild ${rebuild} Action ${i}`,
            required_components: { actor: [`component_${i % 15}`] },
          }));

          actionIndex.buildIndex(actions);
        }
        const cycleEnd = performance.now();
        const cycleTime = cycleEnd - cycleStart;

        rebuildTimes.push(cycleTime);

        // Allow memory to stabilize
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Measure memory after cycle
        await global.memoryTestUtils.forceGCAndWait();
        const afterMemory = await global.memoryTestUtils.getStableMemoryUsage();

        const memoryChange = afterMemory - beforeMemory;
        memorySnapshots.push(memoryChange);

        console.log(
          `Cycle ${cycle}: ${cycleTime.toFixed(2)}ms, memory change: ${(memoryChange / 1024).toFixed(2)}KB`
        );
      }

      // Performance should not degrade significantly
      const firstCycleTime = rebuildTimes[0];
      const lastCycleTime = rebuildTimes[rebuildTimes.length - 1];
      expect(lastCycleTime / firstCycleTime).toBeLessThan(2); // Performance shouldn't double

      // Memory usage should remain reasonable
      const firstCycleMemory = memorySnapshots[0];
      const lastCycleMemory = memorySnapshots[memorySnapshots.length - 1];

      // Allow some variance but check for memory leaks
      if (firstCycleMemory > 0) {
        expect(lastCycleMemory / firstCycleMemory).toBeLessThan(3); // Memory shouldn't triple
      }

      // Check that memory returned close to baseline after cleanup
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();
      const totalLeak = finalMemory - baselineMemory;

      // Should have minimal permanent memory increase
      const leakPerCycle = totalLeak / rebuildCount;
      console.log(
        `Total memory leak: ${(totalLeak / 1024).toFixed(2)}KB, per cycle: ${(leakPerCycle / 1024).toFixed(2)}KB`
      );

      // Allow up to 200KB per cycle on average
      expect(leakPerCycle).toBeLessThan(200 * 1024);
    });
  });

  describe('Large entity memory efficiency', () => {
    it('should maintain memory efficiency with large entity sets', async () => {
      const entityCount = global.memoryTestUtils.isCI() ? 500 : 1000;

      // Build index with comprehensive actions
      actionIndex.buildIndex(testData.actions.comprehensive);

      // Establish baseline after index build
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Create many entities
      const entities = [];
      const entityCreationStart = performance.now();

      for (let i = 0; i < entityCount; i++) {
        const entity = entityManager.createEntity(`entity_${i}`);
        entityManager.addComponent(entity.id, 'core:position', {
          locationId: `location_${i % 10}`,
        });
        entities.push(entity);
      }

      const entityCreationEnd = performance.now();
      const entityCreationTime = entityCreationEnd - entityCreationStart;

      console.log(
        `Entity creation time: ${entityCreationTime.toFixed(2)}ms for ${entityCount} entities`
      );

      // Allow memory to stabilize
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterEntitiesMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Query all entities to test memory usage during queries
      const startTime = performance.now();
      const allCandidates = entities.map((entity) =>
        actionIndex.getCandidateActions(entity)
      );
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(entityCount); // Should be less than 1ms per entity
      expect(allCandidates).toHaveLength(entityCount);

      // Each should have found some candidates
      allCandidates.forEach((candidates) => {
        expect(candidates.length).toBeGreaterThan(0);
      });

      // Allow memory to stabilize after queries
      await new Promise((resolve) => setTimeout(resolve, 100));
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate performance metrics
      const avgQueryTime = queryTime / entityCount;
      const totalCandidates = allCandidates.reduce(
        (sum, candidates) => sum + candidates.length,
        0
      );
      const avgCandidatesPerEntity = totalCandidates / entityCount;

      console.log(
        `Bulk query performance: ${queryTime.toFixed(2)}ms total, ${avgQueryTime.toFixed(3)}ms per entity`
      );
      console.log(
        `Average candidates per entity: ${avgCandidatesPerEntity.toFixed(1)}`
      );

      // Memory efficiency check
      const entityMemoryIncrease = afterEntitiesMemory - baselineMemory;
      const queryMemoryIncrease = peakMemory - afterEntitiesMemory;
      const totalMemoryIncrease = peakMemory - baselineMemory;

      const memoryPerEntity = entityMemoryIncrease / entityCount;
      const queryMemoryPerEntity = queryMemoryIncrease / entityCount;

      console.log(
        `Entity memory: ${(entityMemoryIncrease / 1024 / 1024).toFixed(2)}MB total, ${memoryPerEntity.toFixed(0)} bytes per entity`
      );
      console.log(
        `Query memory: ${(queryMemoryIncrease / 1024 / 1024).toFixed(2)}MB total, ${queryMemoryPerEntity.toFixed(0)} bytes per query`
      );
      console.log(
        `Total memory: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );

      // Should use less than 5KB per entity on average
      expect(memoryPerEntity).toBeLessThan(5120);

      // Query memory overhead should be reasonable
      expect(queryMemoryPerEntity).toBeLessThan(10240); // Less than 10KB per query

      // Clear references and check for leaks
      entities.length = 0;
      allCandidates.length = 0;
      entityManager.clear();

      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Most memory should be released
      const retainedMemory = finalMemory - baselineMemory;
      const retentionRate = retainedMemory / totalMemoryIncrease;

      console.log(
        `Memory retention: ${(retainedMemory / 1024).toFixed(2)}KB retained of ${(totalMemoryIncrease / 1024).toFixed(2)}KB used (${(retentionRate * 100).toFixed(1)}%)`
      );

      // Should retain less than 20% of peak memory usage
      expect(retentionRate).toBeLessThan(0.2);
    });
  });
});
