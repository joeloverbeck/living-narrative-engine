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

  async function createTestActorWithMouth(id, name = 'Test Actor') {
    await entityManager.createEntity(id);
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });
    await entityManager.addComponent(id, POSITION_COMPONENT_ID, {
      locationId: 'test_location',
    });

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

    await entityManager.addComponent(id, 'anatomy:body', {
      body: {
        root: 'torso',
        parts: { mouth: mouthId },
      },
    });

    return { id, mouthId };
  }

  // Helper to measure performance
  const measurePerformance = async (operation) => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    return endTime - startTime;
  };

  describe('High Load Scenarios', () => {
    it('should handle 1000+ entities with mouth engagement', async () => {
      const actors = [];
      const actorCount = 1000;

      console.log(`Creating ${actorCount} actors...`);
      const creationStart = performance.now();

      for (let i = 0; i < actorCount; i++) {
        actors.push(await createTestActorWithMouth(`actor${i}`, `Actor ${i}`));

        if ((i + 1) % 100 === 0) {
          console.log(`  Created ${i + 1} actors`);
        }
      }

      const creationEnd = performance.now();
      console.log(
        `Created ${actorCount} actors in ${(creationEnd - creationStart).toFixed(2)}ms`
      );

      console.log('Locking all mouths...');
      const lockStart = performance.now();

      await Promise.all(
        actors.map((actor) =>
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
        )
      );

      const lockEnd = performance.now();
      const lockDuration = lockEnd - lockStart;

      console.log(
        `Locked ${actorCount} mouths in ${lockDuration.toFixed(2)}ms`
      );
      console.log(
        `Average lock time: ${(lockDuration / actorCount).toFixed(2)}ms per actor`
      );
      expect(lockDuration).toBeLessThan(5000); // 5 seconds max

      // Verify a sample of actors are locked
      const sampleSize = Math.min(10, actors.length);
      for (let i = 0; i < sampleSize; i++) {
        const actor = actors[i];
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }

      console.log('Unlocking all mouths...');
      const unlockStart = performance.now();

      await Promise.all(
        actors.map((actor) =>
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
        )
      );

      const unlockEnd = performance.now();
      const unlockDuration = unlockEnd - unlockStart;

      console.log(
        `Unlocked ${actorCount} mouths in ${unlockDuration.toFixed(2)}ms`
      );
      console.log(
        `Average unlock time: ${(unlockDuration / actorCount).toFixed(2)}ms per actor`
      );
      expect(unlockDuration).toBeLessThan(5000);

      // Verify a sample of actors are unlocked
      for (let i = 0; i < sampleSize; i++) {
        const actor = actors[i];
        expect(isMouthLocked(entityManager, actor.id)).toBe(false);
      }
    }, 30000); // 30 second timeout

    it('should handle sustained operation load', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      console.log('Starting sustained load test (10 seconds)...');
      const startTime = performance.now();
      let operations = 0;
      let lastReportTime = startTime;
      const reportInterval = 1000; // Report every second
      const testDuration = 10000; // 10 seconds

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

        // Report progress at intervals
        const currentTime = performance.now();
        if (currentTime - lastReportTime >= reportInterval) {
          const elapsed = (currentTime - startTime) / 1000;
          const opsPerSecond = operations / elapsed;
          console.log(
            `  ${elapsed.toFixed(0)}s: ${operations} operations, ${opsPerSecond.toFixed(0)} ops/sec`
          );
          lastReportTime = currentTime;
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const opsPerSecond = (operations / totalTime) * 1000;

      console.log(
        `Total: ${operations} operations in ${(totalTime / 1000).toFixed(1)}s`
      );
      console.log(`Sustained ${opsPerSecond.toFixed(0)} ops/sec`);
      expect(opsPerSecond).toBeGreaterThan(50); // At least 50 ops/sec

      // System should still be in consistent state
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    }, 15000); // 15 second timeout

    it('should handle burst load patterns', async () => {
      const actors = [];
      const actorCount = 100;

      // Create actors
      console.log(`Creating ${actorCount} actors for burst testing...`);
      for (let i = 0; i < actorCount; i++) {
        actors.push(
          await createTestActorWithMouth(`burst_${i}`, `BurstActor${i}`)
        );
      }

      console.log('Testing burst load patterns...');
      const burstCount = 5;
      const operationsPerBurst = 200;

      for (let burst = 0; burst < burstCount; burst++) {
        console.log(
          `Burst ${burst + 1}/${burstCount}: ${operationsPerBurst} operations`
        );

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

        await Promise.all(operations);

        const burstEnd = performance.now();
        const burstDuration = burstEnd - burstStart;
        const opsPerSecond = (operationsPerBurst / burstDuration) * 1000;

        console.log(
          `  Burst ${burst + 1} completed in ${burstDuration.toFixed(2)}ms (${opsPerSecond.toFixed(0)} ops/sec)`
        );

        // Small delay between bursts
        if (burst < burstCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
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
    });
  });

  describe('Memory Pressure Tests', () => {
    it('should maintain performance under memory pressure', async () => {
      // Create memory pressure
      const memoryHogs = [];
      console.log('Creating memory pressure...');
      for (let i = 0; i < 100; i++) {
        memoryHogs.push(new Array(100000).fill('memory pressure'));
      }

      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      console.log('Testing performance under memory pressure...');
      const duration = await measurePerformance(async () => {
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
      });

      console.log(
        `200 operations under memory pressure: ${duration.toFixed(2)}ms`
      );

      // Should still complete in reasonable time despite memory pressure
      expect(duration).toBeLessThan(2000);

      // Clean up memory hogs
      memoryHogs.length = 0;

      // System should still be functional
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    });

    it('should handle entity churn (creation and destruction)', async () => {
      console.log('Testing entity churn scenario...');
      const churnCycles = 10;
      const entitiesPerCycle = 100;

      for (let cycle = 0; cycle < churnCycles; cycle++) {
        console.log(`Churn cycle ${cycle + 1}/${churnCycles}`);

        const actors = [];

        // Create entities
        for (let i = 0; i < entitiesPerCycle; i++) {
          actors.push(
            await createTestActorWithMouth(
              `churn_${cycle}_${i}`,
              `ChurnActor${i}`
            )
          );
        }

        // Perform operations
        const operations = [];
        for (const actor of actors) {
          operations.push(
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
        }
        await Promise.all(operations);

        // Verify operations succeeded
        expect(isMouthLocked(entityManager, actors[0].id)).toBe(true);

        // Clear entities
        entityManager.setEntities([]);

        console.log(`  Cycle ${cycle + 1} complete`);
      }

      // Entity manager should not have accumulated garbage
      const remainingEntities = entityManager.getEntityIds
        ? entityManager.getEntityIds().length
        : 0;
      console.log(`Remaining entities after churn: ${remainingEntities}`);
      expect(remainingEntities).toBe(0);
    });
  });

  describe('Concurrent Load Tests', () => {
    it('should handle high concurrency without race conditions', async () => {
      const actors = [];
      const actorCount = 50;

      console.log(`Creating ${actorCount} actors for concurrency testing...`);
      for (let i = 0; i < actorCount; i++) {
        actors.push(
          await createTestActorWithMouth(
            `concurrent_${i}`,
            `ConcurrentActor${i}`
          )
        );
      }

      console.log('Testing high concurrency scenario...');
      const concurrentOps = 500;
      const operations = [];
      const operationLog = [];

      // Generate random concurrent operations
      for (let i = 0; i < concurrentOps; i++) {
        const randomActor = actors[Math.floor(Math.random() * actors.length)];
        const opType =
          Math.random() > 0.5
            ? 'LOCK_MOUTH_ENGAGEMENT'
            : 'UNLOCK_MOUTH_ENGAGEMENT';

        operationLog.push({ actor: randomActor.id, operation: opType });

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
            .catch((err) => {
              console.error(
                `Operation failed for ${randomActor.id}: ${err.message}`
              );
              return null;
            })
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(operations);
      const endTime = performance.now();

      const successCount = results.filter((r) => r !== null).length;
      const failureCount = results.filter((r) => r === null).length;
      const duration = endTime - startTime;
      const opsPerSecond = (concurrentOps / duration) * 1000;

      console.log(
        `${concurrentOps} concurrent operations in ${duration.toFixed(2)}ms`
      );
      console.log(`Success: ${successCount}, Failures: ${failureCount}`);
      console.log(`Throughput: ${opsPerSecond.toFixed(0)} ops/sec`);

      // Most operations should succeed
      expect(successCount).toBeGreaterThan(concurrentOps * 0.95);

      // All actors should have valid state
      for (const actor of actors) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );
        expect(engagement).toBeDefined();
        expect(typeof engagement.locked).toBe('boolean');
      }
    });

    it('should handle mixed operation patterns efficiently', async () => {
      const actors = [];
      const actorCount = 100;

      console.log(`Creating ${actorCount} actors for mixed pattern testing...`);
      for (let i = 0; i < actorCount; i++) {
        actors.push(
          await createTestActorWithMouth(`mixed_${i}`, `MixedActor${i}`)
        );
      }

      console.log('Testing mixed operation patterns...');
      const testDuration = 5000; // 5 seconds
      const startTime = performance.now();
      let operations = 0;

      while (performance.now() - startTime < testDuration) {
        const batchOps = [];

        // Mix of different operation patterns
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

        // Pattern 2: Parallel operations on multiple actors
        for (let i = 1; i < Math.min(11, actors.length); i++) {
          batchOps.push(
            operationInterpreter.execute(
              {
                type:
                  i % 2 === 0
                    ? 'LOCK_MOUTH_ENGAGEMENT'
                    : 'UNLOCK_MOUTH_ENGAGEMENT',
                parameters: { actor_id: actors[i].id },
              },
              {
                evaluationContext: { actor: { id: actors[i].id } },
                entityManager,
                logger,
              }
            )
          );
        }

        // Pattern 3: Random operations
        for (let i = 0; i < 10; i++) {
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

      console.log(
        `Mixed patterns: ${operations} operations in ${(totalTime / 1000).toFixed(1)}s`
      );
      console.log(`Throughput: ${opsPerSecond.toFixed(0)} ops/sec`);

      expect(opsPerSecond).toBeGreaterThan(50);

      // Verify system integrity
      for (const actor of actors.slice(0, 10)) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );
        expect(engagement).toBeDefined();
      }
    });
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

      console.log('Testing rapid state toggles...');
      const toggleCount = 1000;
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
      const togglesPerSecond = (toggleCount / duration) * 1000;

      console.log(`${toggleCount} toggles in ${duration.toFixed(2)}ms`);
      console.log(`Toggle rate: ${togglesPerSecond.toFixed(0)} toggles/sec`);

      // Final state should be consistent with toggle count
      const expectedState = toggleCount % 2 === 0 ? false : true;
      expect(isMouthLocked(entityManager, actor.id)).toBe(expectedState);
    });

    it('should maintain data integrity under stress', async () => {
      const actors = [];
      const actorCount = 200;

      console.log(`Creating ${actorCount} actors for integrity testing...`);
      for (let i = 0; i < actorCount; i++) {
        actors.push(
          await createTestActorWithMouth(`integrity_${i}`, `IntegrityActor${i}`)
        );
      }

      // Set initial known state - all locked
      console.log('Setting initial state (all locked)...');
      await Promise.all(
        actors.map((actor) =>
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
        )
      );

      // Verify initial state
      for (const actor of actors.slice(0, 10)) {
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }

      // Perform stress operations
      console.log('Performing stress operations...');
      const stressOps = [];
      for (let i = 0; i < 1000; i++) {
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

      await Promise.all(stressOps);

      // Verify data integrity - all actors should have valid engagement data
      console.log('Verifying data integrity...');
      let integrityErrors = 0;

      for (const actor of actors) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );

        if (!engagement) {
          integrityErrors++;
          console.error(`Missing engagement data for ${actor.id}`);
        } else if (typeof engagement.locked !== 'boolean') {
          integrityErrors++;
          console.error(
            `Invalid engagement state for ${actor.id}: ${engagement.locked}`
          );
        } else if (
          engagement.forcedOverride !== false &&
          engagement.forcedOverride !== true
        ) {
          integrityErrors++;
          console.error(
            `Invalid forcedOverride for ${actor.id}: ${engagement.forcedOverride}`
          );
        }
      }

      console.log(
        `Integrity check complete. Errors: ${integrityErrors}/${actors.length}`
      );
      expect(integrityErrors).toBe(0);
    });
  });
});
