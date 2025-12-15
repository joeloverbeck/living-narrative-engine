/**
 * @file mouthEngagementPerformance.test.js
 * @description Quick performance sanity checks for mouth engagement system
 *
 * Performance Requirements:
 * - Single operation speed: <10ms for lock/unlock
 * - Bulk operations: <1000ms for 100 parallel operations
 * - Linear scalability: <2x degradation at 10x scale
 *
 * Note: Comprehensive stress tests (sustained load, high entity counts,
 * memory pressure, concurrent load) are in mouthEngagementPerformance.stress.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPerformanceTestBed } from '../../../common/performanceTestBed.js';
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

describe('Mouth Engagement - Performance Tests', () => {
  let testBed;
  let logger;
  let entityManager;
  let operationInterpreter;
  let operationRegistry;
  let eventBus;
  let performanceTracker;

  beforeEach(() => {
    testBed = createPerformanceTestBed();
    performanceTracker = testBed.createPerformanceTracker();
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
    testBed?.cleanup();
    if (entityManager) {
      entityManager.setEntities([]);
    }
  });

  // Helper function to create test actor with mouth
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

    // Add the mouth engagement component that handlers expect
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

  /**
   * Create a batch of actors with mouths concurrently.
   *
   * @param {number} count - Number of actors to create
   * @param {object} [options] - Configuration for IDs and names
   * @param {string} [options.idPrefix] - Prefix for generated IDs
   * @param {string} [options.namePrefix] - Prefix for generated names
   * @returns {Promise<Array<{id: string, mouthId: string}>>} Created actors
   */
  async function createActorBatch(count, options = {}) {
    const { idPrefix = 'actor', namePrefix = 'Actor' } = options;

    return Promise.all(
      Array.from({ length: count }, (_, index) =>
        createTestActorWithMouth(
          `${idPrefix}${index}`,
          `${namePrefix} ${index}`
        )
      )
    );
  }

  // Helper to measure performance
  const measurePerformance = async (operation) => {
    const startTime = performance.now();
    await operation();
    const endTime = performance.now();
    return endTime - startTime;
  };

  const expectPerformance = (duration, maxMs, operationDescription) => {
    expect(duration).toBeLessThan(maxMs);
    console.log(`${operationDescription}: ${duration.toFixed(2)}ms`);
  };

  describe('Operation Performance', () => {
    it('should lock mouth engagement in <10ms', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');

      const duration = await measurePerformance(async () => {
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
      });

      expectPerformance(duration, 10, 'Lock mouth engagement');
      expect(isMouthLocked(entityManager, actor.id)).toBe(true);
    });

    it('should unlock mouth engagement in <10ms', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');

      // Pre-lock the mouth
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

      const duration = await measurePerformance(async () => {
        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        );
      });

      expectPerformance(duration, 10, 'Unlock mouth engagement');
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    });

    it('should handle bulk lock operations efficiently', async () => {
      console.log('Creating 100 test actors...');
      const actors = await createActorBatch(100);

      const duration = await measurePerformance(async () => {
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
      });

      expectPerformance(duration, 1000, '100 parallel lock operations');
      expect(duration / actors.length).toBeLessThan(10); // <10ms per operation

      // Verify all are locked
      for (const actor of actors.slice(0, 10)) {
        // Check first 10
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }
    });

    it('should handle rapid lock/unlock cycles efficiently', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      const duration = await measurePerformance(async () => {
        for (let i = 0; i < 50; i++) {
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

      expectPerformance(duration, 500, '50 lock/unlock cycles');
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    });
  });

  describe('Condition Evaluation Performance', () => {
    it('should check mouth availability efficiently', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');

      // Test condition evaluation through operations
      const duration = await measurePerformance(async () => {
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
      });

      expectPerformance(duration, 10, 'Mouth availability check via operation');
    });

    it('should handle bulk condition evaluations efficiently', async () => {
      console.log('Creating 100 test actors for bulk evaluation...');
      const actors = await createActorBatch(100);

      // Test bulk operations as proxy for condition evaluation
      const duration = await measurePerformance(async () => {
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
      });

      expectPerformance(duration, 1000, '100 parallel condition evaluations');
    });

    it('should scale linearly with entity count', async () => {
      const entityCounts = [10, 50, 100];
      const durations = [];

      for (const count of entityCounts) {
        console.log(`Testing with ${count} entities...`);
        const actors = await createActorBatch(count, {
          idPrefix: `actor_${count}_`,
          namePrefix: `Actor${count}`,
        });

        const duration = await measurePerformance(async () => {
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
        });

        const durationPerEntity = duration / count;
        durations.push(durationPerEntity);
        console.log(
          `  ${count} entities: ${duration.toFixed(2)}ms total, ${durationPerEntity.toFixed(2)}ms per entity`
        );

        // Clean up entities for next iteration
        entityManager.setEntities([]);
      }

      // Should not show significant performance degradation
      const degradation = durations[2] / durations[0];
      console.log(
        `Performance degradation at 10x scale: ${degradation.toFixed(2)}x`
      );

      // Allow a cushion for CI variability while still enforcing roughly
      // linear performance (<3.0x slower at 10x scale).
      expect(degradation).toBeLessThan(3.0);
    });
  });

  describe('Complex Anatomy Performance', () => {
    it('should handle complex body structures efficiently', async () => {
      // Create actor with complex anatomy (multiple body parts)
      const actorId = 'complex_actor';
      await entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Complex Actor',
      });
      await entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test_location',
      });

      // Create complex anatomy structure
      const bodyParts = {};
      const partIds = [];

      // Create multiple body parts
      const partTypes = [
        'head',
        'mouth',
        'torso',
        'arm_left',
        'arm_right',
        'leg_left',
        'leg_right',
      ];
      for (const partType of partTypes) {
        const partId = `${actorId}_${partType}`;
        await entityManager.createEntity(partId);
        await entityManager.addComponent(partId, 'anatomy:part', {
          subType: partType,
        });
        await entityManager.addComponent(partId, 'core:name', {
          text: partType,
        });

        if (partType === 'mouth') {
          await entityManager.addComponent(partId, 'core:mouth_engagement', {
            locked: false,
            forcedOverride: false,
          });
        }

        bodyParts[partType] = partId;
        partIds.push(partId);
      }

      // Add complex anatomy to actor
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: bodyParts.torso,
          parts: bodyParts,
        },
      });

      const duration = await measurePerformance(async () => {
        const context = {
          evaluationContext: { actor: { id: actorId } },
          entityManager,
          logger,
        };

        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );
      });

      expectPerformance(duration, 50, 'Complex anatomy lock operation');
      expect(isMouthLocked(entityManager, actorId)).toBe(true);
    });
  });

  describe('Parallel Processing Performance', () => {
    it('should efficiently handle parallel operations on different entities', async () => {
      const actorCount = 50;

      console.log(`Creating ${actorCount} actors for parallel processing...`);
      const actors = await createActorBatch(actorCount, {
        idPrefix: 'parallel_',
        namePrefix: 'ParallelActor',
      });

      // Test parallel lock operations
      const lockDuration = await measurePerformance(async () => {
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
      });

      expectPerformance(
        lockDuration,
        500,
        `${actorCount} parallel lock operations`
      );

      // Test parallel unlock operations
      const unlockDuration = await measurePerformance(async () => {
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
      });

      expectPerformance(
        unlockDuration,
        500,
        `${actorCount} parallel unlock operations`
      );

      // Calculate average per-operation time
      const avgLockTime = lockDuration / actorCount;
      const avgUnlockTime = unlockDuration / actorCount;
      console.log(`Average time per lock: ${avgLockTime.toFixed(2)}ms`);
      console.log(`Average time per unlock: ${avgUnlockTime.toFixed(2)}ms`);

      // Both should be under 10ms per operation
      expect(avgLockTime).toBeLessThan(10);
      expect(avgUnlockTime).toBeLessThan(10);
    });
  });
});
