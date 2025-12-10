/**
 * @file mouthEngagementStress.integration.test.js
 * @description Integration tests for mouth engagement system under moderate load
 *
 * Integration Test Focus:
 * - Verifies correct behavior with multiple entities
 * - Tests concurrent operations don't cause race conditions
 * - Validates data integrity after operations
 *
 * Note: Full stress tests (200+ entities, 3+ second sustained loads, memory pressure)
 * have been moved to tests/performance/mods/core/mouthEngagementPerformance.test.js
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

describe('Mouth Engagement - Integration Tests', () => {
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

  /**
   * Creates a test actor with mouth anatomy
   * @param {string} id - Actor ID
   * @param {string} name - Actor name
   * @returns {Promise<{id: string, mouthId: string}>}
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

  describe('Multi-Entity Operations', () => {
    it('should lock and unlock mouth engagement for multiple entities', async () => {
      const actorCount = 20;
      const actors = [];

      // Create actors
      for (let i = 0; i < actorCount; i++) {
        const actor = await createTestActorWithMouth(`actor${i}`, `Actor ${i}`);
        actors.push(actor);
      }

      // Lock all mouths
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

      // Verify all are locked
      for (const actor of actors) {
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }

      // Unlock all mouths
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

      // Verify all are unlocked
      for (const actor of actors) {
        expect(isMouthLocked(entityManager, actor.id)).toBe(false);
      }
    }, 5000);
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent operations without race conditions', async () => {
      const actorCount = 10;
      const actors = [];

      // Create actors
      for (let i = 0; i < actorCount; i++) {
        const actor = await createTestActorWithMouth(
          `concurrent_${i}`,
          `ConcurrentActor${i}`
        );
        actors.push(actor);
      }

      const operationCount = 20;
      const operations = [];

      // Generate random concurrent operations
      for (let i = 0; i < operationCount; i++) {
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
            .catch(() => null)
        );
      }

      const results = await Promise.all(operations);
      const successCount = results.filter((r) => r !== null).length;

      // Most operations should succeed
      expect(successCount).toBeGreaterThan(operationCount * 0.95);

      // All actors should have valid state
      for (const actor of actors) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );
        expect(engagement).toBeDefined();
        expect(typeof engagement.locked).toBe('boolean');
      }
    }, 5000);
  });

  describe('Data Integrity', () => {
    it('should maintain data integrity after operations', async () => {
      const actorCount = 10;
      const actors = [];

      // Create actors
      for (let i = 0; i < actorCount; i++) {
        const actor = await createTestActorWithMouth(
          `integrity_${i}`,
          `IntegrityActor${i}`
        );
        actors.push(actor);
      }

      // Set initial state - all locked
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
      for (const actor of actors) {
        expect(isMouthLocked(entityManager, actor.id)).toBe(true);
      }

      // Perform mixed operations
      const mixedOps = [];
      for (let i = 0; i < 30; i++) {
        const randomActor = actors[Math.floor(Math.random() * actors.length)];
        const randomOp =
          Math.random() > 0.5
            ? 'LOCK_MOUTH_ENGAGEMENT'
            : 'UNLOCK_MOUTH_ENGAGEMENT';

        mixedOps.push(
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

      await Promise.all(mixedOps);

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
    }, 5000);

    it('should correctly toggle state through multiple operations', async () => {
      const actor = await createTestActorWithMouth('toggle_actor', 'ToggleActor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      const toggleCount = 20;

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

      // Final state should be consistent with toggle count
      const expectedState = toggleCount % 2 === 0 ? false : true;
      expect(isMouthLocked(entityManager, actor.id)).toBe(expectedState);
    }, 5000);
  });
});
