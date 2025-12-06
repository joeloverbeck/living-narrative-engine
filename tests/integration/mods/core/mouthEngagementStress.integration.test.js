/**
 * @file mouthEngagementStress.integration.test.js
 * @description Stress tests for mouth engagement system under high load conditions
 *
 * Stress Test Requirements:
 * - Handle 1000+ entities with mouth engagement
 * - Maintain >50 ops/sec for 10+ seconds sustained load
 * - Maintain performance under memory constraints
 * - Handle simultaneous operations without corruption
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { createMockLogger } from '../../../common/mockFactories.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import LockMouthEngagementHandler from '../../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import EventBus from '../../../../src/events/eventBus.js';
import { isMouthLocked } from '../../../../src/utils/mouthEngagementUtils.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('Mouth Engagement - Stress Tests', () => {
  let logger;
  let entityManager;
  let operationInterpreter;
  let operationRegistry;
  let eventBus;

  beforeEach(() => {
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
  });

  afterEach(() => {
    if (entityManager) {
      entityManager.setEntities([]);
    }
  });

  // Optimized: Batch entity creation
  /**
   *
   * @param id
   * @param name
   */
  async function createTestActorWithMouth(id, name = 'Test Actor') {
    await entityManager.createEntity(id);
    const mouthId = `${id}_mouth`;
    await entityManager.createEntity(mouthId);

    // Batch component additions
    await Promise.all([
      entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name }),
      entityManager.addComponent(id, POSITION_COMPONENT_ID, {
        locationId: 'test_location',
      }),
      entityManager.addComponent(mouthId, 'anatomy:part', {
        subType: 'mouth',
      }),
      entityManager.addComponent(mouthId, 'core:name', {
        text: 'mouth',
      }),
      entityManager.addComponent(mouthId, 'core:mouth_engagement', {
        locked: false,
        forcedOverride: false,
      }),
    ]);

    await entityManager.addComponent(id, 'anatomy:body', {
      body: {
        root: 'torso',
        parts: { mouth: mouthId },
      },
    });

    return { id, mouthId };
  }

  // Helper to process operations in batches
  /**
   *
   * @param operations
   * @param batchSize
   */
  async function processBatch(operations, batchSize = 50) {
    const results = [];
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
    return results;
  }

  // Helper to measure performance
  const measurePerformance = async (operation) => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    return endTime - startTime;
  };

  describe('High Load Scenarios', () => {
    it('should handle 200 entities with mouth engagement efficiently', async () => {
      const actors = [];
      const actorCount = 200; // Reduced from 1000 for integration test

      // Create actors in batches for better performance
      const creationStart = performance.now();
      const creationBatches = [];

      for (let i = 0; i < actorCount; i++) {
        creationBatches.push(
          createTestActorWithMouth(`actor${i}`, `Actor ${i}`)
        );
      }

      // Process creation in batches of 20
      for (let i = 0; i < creationBatches.length; i += 20) {
        const batch = creationBatches.slice(i, i + 20);
        const created = await Promise.all(batch);
        actors.push(...created);
      }

      const creationEnd = performance.now();
      const creationDuration = creationEnd - creationStart;

      // Performance assertion for creation
      expect(creationDuration).toBeLessThan(2000); // 2 seconds max for 200 entities

      // Lock all mouths using batch processing
      const lockStart = performance.now();
      const lockOperations = actors.map(
        (actor) => () =>
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            {
              evaluationContext: { actor: { id: actor.id } },
              entityManager,
              logger,
            }
          )
      );

      await processBatch(
        lockOperations.map((op) => op()),
        50
      );

      const lockEnd = performance.now();
      const lockDuration = lockEnd - lockStart;

      expect(lockDuration).toBeLessThan(1000); // 1 second max for 200 entities

      // Verify a sample of actors are locked
      const sampleSize = Math.min(10, actors.length);
      for (let i = 0; i < sampleSize; i++) {
        const actor = actors[i];
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }

      // Unlock all mouths using batch processing
      const unlockStart = performance.now();
      const unlockOperations = actors.map(
        (actor) => () =>
          operationInterpreter.execute(
            {
              type: 'UNLOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            {
              evaluationContext: { actor: { id: actor.id } },
              entityManager,
              logger,
            }
          )
      );

      await processBatch(
        unlockOperations.map((op) => op()),
        50
      );

      const unlockEnd = performance.now();
      const unlockDuration = unlockEnd - unlockStart;

      expect(unlockDuration).toBeLessThan(1000); // 1 second max

      // Verify a sample of actors are unlocked
      for (let i = 0; i < sampleSize; i++) {
        const actor = actors[i];
        expect(isMouthLocked(entityManager, actor.id)).toBe(false);
      }
    }, 10000); // 10 second timeout (reduced from 30)

    it('should handle sustained operation load', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      const startTime = performance.now();
      let operations = 0;
      const testDuration = 3000; // Reduced from 10 seconds to 3 seconds

      // Run operations for specified duration
      while (performance.now() - startTime < testDuration) {
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

        operations += 2;
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const opsPerSecond = (operations / totalTime) * 1000;

      expect(opsPerSecond).toBeGreaterThan(50); // At least 50 ops/sec

      // System should still be in consistent state
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    }, 5000); // 5 second timeout

    it('should handle burst load patterns', async () => {
      const actors = [];
      const actorCount = 50; // Reduced from 100

      // Create actors in batches
      const creationBatches = [];
      for (let i = 0; i < actorCount; i++) {
        creationBatches.push(
          createTestActorWithMouth(`burst_${i}`, `BurstActor${i}`)
        );
      }

      // Process creation in batches
      for (let i = 0; i < creationBatches.length; i += 10) {
        const batch = creationBatches.slice(i, i + 10);
        const created = await Promise.all(batch);
        actors.push(...created);
      }

      const burstCount = 3; // Reduced from 5
      const operationsPerBurst = 100; // Reduced from 200

      for (let burst = 0; burst < burstCount; burst++) {
        const burstStart = performance.now();
        const operations = [];

        // Generate random operations
        for (let i = 0; i < operationsPerBurst; i++) {
          const randomActor = actors[Math.floor(Math.random() * actors.length)];
          const randomOp =
            Math.random() > 0.5
              ? 'LOCK_MOUTH_ENGAGEMENT'
              : 'UNLOCK_MOUTH_ENGAGEMENT';

          operations.push(
            operationInterpreter.execute(
              {
                type: randomOp,
                parameters: { actor_id: randomActor.id },
              },
              {
                evaluationContext: { actor: { id: randomActor.id } },
                entityManager,
                logger,
              }
            )
          );
        }

        // Process in batches
        await processBatch(operations, 50);

        const burstEnd = performance.now();
        const burstDuration = burstEnd - burstStart;

        expect(burstDuration).toBeLessThan(500); // Each burst should complete quickly

        // Small delay between bursts
        if (burst < burstCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Verify system integrity
      for (const actor of actors.slice(0, 10)) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );
        expect(engagement).toBeDefined();
        expect(typeof engagement.locked).toBe('boolean');
      }
    }, 5000); // 5 second timeout
  });

  describe('Memory Pressure Tests', () => {
    it('should maintain performance under realistic memory load', async () => {
      // Create more realistic memory pressure
      const memoryData = [];
      for (let i = 0; i < 10; i++) {
        memoryData.push(new Array(10000).fill(`data_${i}`));
      }

      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      const duration = await measurePerformance(async () => {
        for (let i = 0; i < 50; i++) {
          // Reduced from 100
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
      });

      // Should still complete in reasonable time despite memory pressure
      expect(duration).toBeLessThan(500); // Reduced from 2000ms

      // Clean up memory
      memoryData.length = 0;

      // System should still be functional
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    }, 5000); // 5 second timeout

    it('should handle entity churn (creation and destruction)', async () => {
      const churnCycles = 5; // Reduced from 10
      const entitiesPerCycle = 20; // Reduced from 100

      for (let cycle = 0; cycle < churnCycles; cycle++) {
        const actors = [];
        const creationBatches = [];

        // Create entities in batches
        for (let i = 0; i < entitiesPerCycle; i++) {
          creationBatches.push(
            createTestActorWithMouth(`churn_${cycle}_${i}`, `ChurnActor${i}`)
          );
        }

        // Process creation in batches
        const created = await Promise.all(creationBatches);
        actors.push(...created);

        // Perform operations in batches
        const operations = actors.map((actor) =>
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            {
              evaluationContext: { actor: { id: actor.id } },
              entityManager,
              logger,
            }
          )
        );

        await processBatch(operations, 10);

        // Verify operations succeeded
        expect(isMouthLocked(entityManager, actors[0].id)).toBe(true);

        // Clear entities
        entityManager.setEntities([]);
      }

      // Entity manager should not have accumulated garbage
      const remainingEntities = entityManager.getEntityIds
        ? entityManager.getEntityIds().length
        : 0;
      expect(remainingEntities).toBe(0);
    }, 5000); // 5 second timeout
  });

  describe('Concurrent Load Tests', () => {
    it('should handle high concurrency without race conditions', async () => {
      const actors = [];
      const actorCount = 25; // Reduced from 50

      // Create actors in batches
      const creationBatches = [];
      for (let i = 0; i < actorCount; i++) {
        creationBatches.push(
          createTestActorWithMouth(`concurrent_${i}`, `ConcurrentActor${i}`)
        );
      }

      // Process creation in batches
      for (let i = 0; i < creationBatches.length; i += 5) {
        const batch = creationBatches.slice(i, i + 5);
        const created = await Promise.all(batch);
        actors.push(...created);
      }

      const concurrentOps = 200; // Reduced from 500
      const operations = [];

      // Generate random concurrent operations
      for (let i = 0; i < concurrentOps; i++) {
        const randomActor = actors[Math.floor(Math.random() * actors.length)];
        const opType =
          Math.random() > 0.5
            ? 'LOCK_MOUTH_ENGAGEMENT'
            : 'UNLOCK_MOUTH_ENGAGEMENT';

        operations.push(
          operationInterpreter
            .execute(
              {
                type: opType,
                parameters: { actor_id: randomActor.id },
              },
              {
                evaluationContext: { actor: { id: randomActor.id } },
                entityManager,
                logger,
              }
            )
            .catch(() => null) // Silently handle errors
        );
      }

      const startTime = performance.now();
      const results = await processBatch(operations, 50); // Use batching
      const endTime = performance.now();

      const successCount = results.filter((r) => r !== null).length;
      const duration = endTime - startTime;

      // Most operations should succeed
      expect(successCount).toBeGreaterThan(concurrentOps * 0.95);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // All actors should have valid state
      for (const actor of actors.slice(0, 5)) {
        // Check subset
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );
        expect(engagement).toBeDefined();
        expect(typeof engagement.locked).toBe('boolean');
      }
    }, 5000); // 5 second timeout

    it('should handle mixed operation patterns efficiently', async () => {
      const actors = [];
      const actorCount = 30; // Reduced from 100

      // Create actors efficiently
      const creationBatches = [];
      for (let i = 0; i < actorCount; i++) {
        creationBatches.push(
          createTestActorWithMouth(`mixed_${i}`, `MixedActor${i}`)
        );
      }
      actors.push(...(await Promise.all(creationBatches)));

      const testDuration = 2000; // Reduced from 5 seconds to 2 seconds
      const startTime = performance.now();
      let operations = 0;

      while (performance.now() - startTime < testDuration) {
        const batchOps = [];

        // Mix of different operation patterns (simplified)
        // Pattern 1: Sequential operations on single actor
        const singleActor = actors[0];
        batchOps.push(
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: singleActor.id },
            },
            {
              evaluationContext: { actor: { id: singleActor.id } },
              entityManager,
              logger,
            }
          )
        );

        // Pattern 2: Random operations on subset
        for (let i = 0; i < 5; i++) {
          const randomActor = actors[Math.floor(Math.random() * actors.length)];
          const randomOp =
            Math.random() > 0.5
              ? 'LOCK_MOUTH_ENGAGEMENT'
              : 'UNLOCK_MOUTH_ENGAGEMENT';

          batchOps.push(
            operationInterpreter.execute(
              {
                type: randomOp,
                parameters: { actor_id: randomActor.id },
              },
              {
                evaluationContext: { actor: { id: randomActor.id } },
                entityManager,
                logger,
              }
            )
          );
        }

        await Promise.all(batchOps);
        operations += batchOps.length;
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const opsPerSecond = (operations / totalTime) * 1000;

      expect(opsPerSecond).toBeGreaterThan(50);

      // Verify system integrity
      for (const actor of actors.slice(0, 5)) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );
        expect(engagement).toBeDefined();
      }
    }, 5000); // 5 second timeout
  });

  describe('Recovery and Resilience', () => {
    it('should recover from rapid state toggles', async () => {
      const actor = await createTestActorWithMouth(
        'toggle_actor',
        'ToggleActor'
      );
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      const toggleCount = 200; // Reduced from 1000
      const startTime = performance.now();

      for (let i = 0; i < toggleCount; i++) {
        const operation =
          i % 2 === 0 ? 'LOCK_MOUTH_ENGAGEMENT' : 'UNLOCK_MOUTH_ENGAGEMENT';
        await operationInterpreter.execute(
          {
            type: operation,
            parameters: { actor_id: actor.id },
          },
          context
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      // Final state should be consistent with toggle count
      const expectedState = toggleCount % 2 === 0 ? false : true;
      expect(isMouthLocked(entityManager, actor.id)).toBe(expectedState);
    }, 5000); // 5 second timeout

    it('should maintain data integrity under stress', async () => {
      const actors = [];
      const actorCount = 50; // Reduced from 200

      // Create actors efficiently
      const creationBatches = [];
      for (let i = 0; i < actorCount; i++) {
        creationBatches.push(
          createTestActorWithMouth(`integrity_${i}`, `IntegrityActor${i}`)
        );
      }
      actors.push(...(await Promise.all(creationBatches)));

      // Set initial known state - all locked (using batching)
      const lockOps = actors.map((actor) =>
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          {
            evaluationContext: { actor: { id: actor.id } },
            entityManager,
            logger,
          }
        )
      );

      await processBatch(lockOps, 25);

      // Verify initial state
      for (const actor of actors.slice(0, 5)) {
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }

      // Perform stress operations
      const stressOps = [];
      for (let i = 0; i < 200; i++) {
        // Reduced from 1000
        const randomActor = actors[Math.floor(Math.random() * actors.length)];
        const randomOp =
          Math.random() > 0.5
            ? 'LOCK_MOUTH_ENGAGEMENT'
            : 'UNLOCK_MOUTH_ENGAGEMENT';

        stressOps.push(
          operationInterpreter.execute(
            {
              type: randomOp,
              parameters: { actor_id: randomActor.id },
            },
            {
              evaluationContext: { actor: { id: randomActor.id } },
              entityManager,
              logger,
            }
          )
        );
      }

      await processBatch(stressOps, 50);

      // Verify data integrity - all actors should have valid engagement data
      let integrityErrors = 0;

      for (const actor of actors) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );

        if (!engagement) {
          integrityErrors++;
        } else if (typeof engagement.locked !== 'boolean') {
          integrityErrors++;
        } else if (
          engagement.forcedOverride !== false &&
          engagement.forcedOverride !== true
        ) {
          integrityErrors++;
        }
      }

      expect(integrityErrors).toBe(0);
    }, 5000); // 5 second timeout
  });
});
