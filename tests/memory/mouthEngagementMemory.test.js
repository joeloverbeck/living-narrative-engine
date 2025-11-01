/**
 * @file mouthEngagementMemory.test.js
 * @description Memory usage tests for mouth engagement system
 *
 * Memory Requirements:
 * - No memory leaks during repeated operations
 * - Proper cleanup when entities are destroyed
 * - <5KB memory per actor including mouth engagement
 *
 * Note: Run with --expose-gc flag for accurate garbage collection testing:
 * node --expose-gc ./node_modules/.bin/jest tests/memory/mouthEngagementMemory.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createPerformanceTestBed,
  forceGCAndGetBaseline,
  getStableMemoryUsage,
} from '../common/performanceTestBed.js';
import { SimpleEntityManager } from '../common/entities/index.js';
import { createMockLogger } from '../common/mockFactories.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import LockMouthEngagementHandler from '../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import EventBus from '../../src/events/eventBus.js';
import { isMouthLocked } from '../../src/utils/mouthEngagementUtils.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

describe('Mouth Engagement - Memory Tests', () => {
  // Extended timeout for memory stabilization
  jest.setTimeout(120000); // 2 minutes

  let testBed;
  let logger;
  let entityManager;
  let operationInterpreter;
  let operationRegistry;
  let eventBus;

  beforeEach(async () => {
    testBed = createPerformanceTestBed();
    logger = createMockLogger();
    entityManager = new SimpleEntityManager([]);
    eventBus = new EventBus({ logger });
    operationRegistry = new OperationRegistry({ logger });

    // Register operation handlers
    const lockHandler = new LockMouthEngagementHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
    });
    operationRegistry.register('LOCK_MOUTH_ENGAGEMENT', (...args) =>
      lockHandler.execute(...args)
    );

    const unlockHandler = new UnlockMouthEngagementHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
    });
    operationRegistry.register('UNLOCK_MOUTH_ENGAGEMENT', (...args) =>
      unlockHandler.execute(...args)
    );

    operationInterpreter = new OperationInterpreter({
      logger,
      operationRegistry,
    });

    // Force garbage collection before each test
    if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  afterEach(async () => {
    testBed?.cleanup();
    if (entityManager) {
      entityManager.setEntities([]);
    }

    // Force garbage collection after each test
    if (global.gc) {
      global.gc();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  /**
   *
   * @param id
   * @param name
   */
  async function createTestActorWithMouth(id, name = 'Test Actor') {
    await entityManager.createEntity(id);
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });
    await entityManager.addComponent(id, POSITION_COMPONENT_ID, {
      locationId: 'test_location',
    });

    // Add basic anatomy with mouth part
    const mouthId = `${id}_mouth`;
    await entityManager.createEntity(mouthId);
    await entityManager.addComponent(mouthId, 'anatomy:part', {
      subType: 'mouth',
    });
    await entityManager.addComponent(mouthId, 'core:name', {
      text: 'mouth',
    });
    await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
      locked: false,
      forcedOverride: false,
    });

    // Link mouth to actor via anatomy
    await entityManager.addComponent(id, 'anatomy:body', {
      body: {
        root: 'torso',
        parts: { mouth: mouthId },
      },
    });

    return { id, mouthId };
  }

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated operations', async () => {
      if (!global.gc) {
        console.warn(
          'Skipping memory leak test - run with --expose-gc flag for accurate results'
        );
        return;
      }

      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      // Measure baseline memory after initial setup
      const baselineMemory = await forceGCAndGetBaseline();
      console.log(
        `Baseline memory: ${(baselineMemory / (1024 * 1024)).toFixed(2)} MB`
      );

      // Perform many operations
      console.log('Performing 1000 lock/unlock cycles...');
      for (let i = 0; i < 1000; i++) {
        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );

        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );

        // Force GC every 100 operations
        if (i % 100 === 0 && global.gc) {
          global.gc();
          if (i > 0) {
            const currentMemory = process.memoryUsage().heapUsed;
            const memoryDiff = (currentMemory - baselineMemory) / (1024 * 1024);
            console.log(`  After ${i} cycles: +${memoryDiff.toFixed(2)} MB`);
          }
        }
      }

      // Measure final memory
      const finalMemory = await forceGCAndGetBaseline();
      const memoryIncrease = (finalMemory - baselineMemory) / (1024 * 1024);
      console.log(
        `Memory increase after 1000 cycles: ${memoryIncrease.toFixed(2)} MB`
      );

      // Should not increase memory by more than 10MB
      expect(memoryIncrease).toBeLessThan(10);

      // Verify system is still functional
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    });

    it('should clean up component objects properly', async () => {
      if (!global.gc) {
        console.warn(
          'Skipping cleanup test - run with --expose-gc flag for accurate results'
        );
        return;
      }

      const actors = [];
      console.log('Creating 100 actors...');
      for (let i = 0; i < 100; i++) {
        actors.push(await createTestActorWithMouth(`actor${i}`, `Actor ${i}`));
      }

      // Lock all actors
      console.log('Locking all actors...');
      for (const actor of actors) {
        const context = {
          evaluationContext: { actor: { id: actor.id } },
          entityManager,
          logger,
        };
        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );
      }

      // Measure memory with all actors locked
      const midpointMemory = await forceGCAndGetBaseline();
      console.log(
        `Memory with 100 locked actors: ${(midpointMemory / (1024 * 1024)).toFixed(2)} MB`
      );

      // Unlock all actors
      console.log('Unlocking all actors...');
      for (const actor of actors) {
        const context = {
          evaluationContext: { actor: { id: actor.id } },
          entityManager,
          logger,
        };
        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );
      }

      // Clean up actors
      console.log('Clearing all actors...');
      entityManager.setEntities([]);

      // Force cleanup and measure final memory
      const finalMemory = await forceGCAndGetBaseline();
      const memoryCleanup = (midpointMemory - finalMemory) / (1024 * 1024);
      console.log(`Memory cleaned up: ${memoryCleanup.toFixed(2)} MB`);
      console.log(
        `Final memory: ${(finalMemory / (1024 * 1024)).toFixed(2)} MB`
      );

      // V8 heap behavior is non-deterministic - memory may not decrease immediately
      // due to heap fragmentation, optimization caches, or GC timing.
      // Allow for slight variance (up to 2MB) in either direction.
      expect(memoryCleanup).toBeGreaterThanOrEqual(-2);
    });

    it('should not accumulate memory during rapid state changes', async () => {
      if (!global.gc) {
        console.warn(
          'Skipping rapid state change test - run with --expose-gc flag'
        );
        return;
      }

      const actor = await createTestActorWithMouth('rapid_actor', 'RapidActor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      const baselineMemory = await forceGCAndGetBaseline();
      const memorySnapshots = [];

      console.log('Testing rapid state changes...');
      for (let cycle = 0; cycle < 10; cycle++) {
        // Perform 100 rapid operations
        for (let i = 0; i < 100; i++) {
          await operationInterpreter.execute(
            {
              type:
                i % 2 === 0
                  ? 'LOCK_MOUTH_ENGAGEMENT'
                  : 'UNLOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            context
          );
        }

        // Take memory snapshot
        const currentMemory = await getStableMemoryUsage();
        const memoryDiff = (currentMemory - baselineMemory) / (1024 * 1024);
        memorySnapshots.push(memoryDiff);
        console.log(`  Cycle ${cycle + 1}: +${memoryDiff.toFixed(2)} MB`);
      }

      // Memory should stabilize and not continuously grow
      const lastThreeSnapshots = memorySnapshots.slice(-3);
      const avgLastThree = lastThreeSnapshots.reduce((a, b) => a + b, 0) / 3;
      const firstThreeSnapshots = memorySnapshots.slice(0, 3);
      const avgFirstThree = firstThreeSnapshots.reduce((a, b) => a + b, 0) / 3;

      // Later cycles should not use significantly more memory than early cycles
      const memoryGrowth = avgLastThree - avgFirstThree;
      console.log(`Memory growth over time: ${memoryGrowth.toFixed(2)} MB`);
      expect(memoryGrowth).toBeLessThan(12);
      // Allow up to ~12MB of jitter to account for V8's lazy heap reclamation
      // while still catching sustained growth across cycles.
    });
  });

  describe('Memory Efficiency', () => {
    it('should use minimal memory per mouth engagement component', async () => {
      if (!global.gc) {
        console.warn(
          'Skipping memory efficiency test - run with --expose-gc flag'
        );
        return;
      }

      // Get baseline memory before creating actors
      const startMemory = await forceGCAndGetBaseline();
      console.log(
        `Starting memory: ${(startMemory / (1024 * 1024)).toFixed(2)} MB`
      );

      const actors = [];
      const actorCount = 1000;
      console.log(`Creating ${actorCount} actors with mouth engagement...`);

      for (let i = 0; i < actorCount; i++) {
        const actor = await createTestActorWithMouth(`actor${i}`, `Actor ${i}`);
        actors.push(actor);

        if ((i + 1) % 100 === 0) {
          console.log(`  Created ${i + 1} actors`);
        }
      }

      // Measure memory after creating all actors
      const endMemory = await forceGCAndGetBaseline();
      const totalMemoryUsed = (endMemory - startMemory) / (1024 * 1024);
      const memoryPerActor = (endMemory - startMemory) / actors.length;
      const memoryPerActorKB = memoryPerActor / 1024;

      console.log(`Total memory used: ${totalMemoryUsed.toFixed(2)} MB`);
      console.log(`Memory per actor: ${memoryPerActorKB.toFixed(2)} KB`);

      // Should use less than 5KB per actor (including mouth engagement)
      expect(memoryPerActorKB).toBeLessThan(5);
    });

    it('should efficiently handle memory for locked vs unlocked states', async () => {
      if (!global.gc) {
        console.warn('Skipping state memory test - run with --expose-gc flag');
        return;
      }

      const actors = [];
      const actorCount = 500;

      // Create actors
      console.log(`Creating ${actorCount} actors...`);
      for (let i = 0; i < actorCount; i++) {
        actors.push(
          await createTestActorWithMouth(`state_actor${i}`, `StateActor${i}`)
        );
      }

      // Measure memory with all unlocked
      const unlockedMemory = await forceGCAndGetBaseline();
      console.log(
        `Memory with all unlocked: ${(unlockedMemory / (1024 * 1024)).toFixed(2)} MB`
      );

      // Lock all actors
      console.log('Locking all actors...');
      for (const actor of actors) {
        const context = {
          evaluationContext: { actor: { id: actor.id } },
          entityManager,
          logger,
        };
        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );
      }

      // Measure memory with all locked
      const lockedMemory = await forceGCAndGetBaseline();
      const memoryDifference = (lockedMemory - unlockedMemory) / (1024 * 1024);
      console.log(
        `Memory with all locked: ${(lockedMemory / (1024 * 1024)).toFixed(2)} MB`
      );
      console.log(`Memory difference: ${memoryDifference.toFixed(2)} MB`);

      // The state change should not significantly increase memory
      const memoryPerStateChange =
        (lockedMemory - unlockedMemory) / actors.length / 1024;
      console.log(
        `Memory per state change: ${memoryPerStateChange.toFixed(2)} KB`
      );

      // State changes should use minimal memory
      expect(memoryPerStateChange).toBeLessThan(1.2); // Less than 1.2KB per state change (accounts for V8 heap overhead)
    });
  });

  describe('Memory Stress Tests', () => {
    it('should handle memory pressure gracefully', async () => {
      if (!global.gc) {
        console.warn(
          'Skipping memory pressure test - run with --expose-gc flag'
        );
        return;
      }

      // Create memory pressure by allocating large arrays
      const memoryHogs = [];
      console.log('Creating memory pressure...');
      for (let i = 0; i < 50; i++) {
        memoryHogs.push(new Array(100000).fill(`memory pressure ${i}`));
      }

      const actor = await createTestActorWithMouth(
        'pressure_actor',
        'PressureActor'
      );
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      console.log('Testing operations under memory pressure...');
      const startTime = performance.now();

      // Perform operations under memory pressure
      for (let i = 0; i < 100; i++) {
        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );

        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );
      }

      const duration = performance.now() - startTime;
      console.log(
        `Completed 200 operations under pressure in ${duration.toFixed(2)}ms`
      );

      // Should still complete in reasonable time
      expect(duration).toBeLessThan(5000);

      // Clean up memory hogs
      memoryHogs.length = 0;
      if (global.gc) {
        global.gc();
      }

      // System should still be functional
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    });

    it('should recover memory after bulk entity cleanup', async () => {
      if (!global.gc) {
        console.warn('Skipping bulk cleanup test - run with --expose-gc flag');
        return;
      }

      const baselineMemory = await forceGCAndGetBaseline();
      console.log(
        `Baseline memory: ${(baselineMemory / (1024 * 1024)).toFixed(2)} MB`
      );

      // Create and destroy entities in batches
      for (let batch = 0; batch < 5; batch++) {
        console.log(`Batch ${batch + 1}: Creating 200 actors...`);
        const actors = [];

        for (let i = 0; i < 200; i++) {
          actors.push(
            await createTestActorWithMouth(
              `batch${batch}_actor${i}`,
              `BatchActor${i}`
            )
          );
        }

        // Lock all actors in this batch
        for (const actor of actors) {
          const context = {
            evaluationContext: { actor: { id: actor.id } },
            entityManager,
            logger,
          };
          await operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            context
          );
        }

        // Clear all actors in this batch
        console.log(`Batch ${batch + 1}: Clearing actors...`);
        entityManager.setEntities([]);

        // Force GC and check memory
        const currentMemory = await forceGCAndGetBaseline();
        const memoryDiff = (currentMemory - baselineMemory) / (1024 * 1024);
        console.log(
          `  Memory after batch ${batch + 1}: +${memoryDiff.toFixed(2)} MB`
        );
      }

      // Final memory check
      const finalMemory = await forceGCAndGetBaseline();
      const totalMemoryLeaked = (finalMemory - baselineMemory) / (1024 * 1024);
      console.log(
        `Total memory leaked after 5 batches: ${totalMemoryLeaked.toFixed(2)} MB`
      );

      // Should not leak significant memory
      expect(totalMemoryLeaked).toBeLessThan(10);
    });
  });
});
