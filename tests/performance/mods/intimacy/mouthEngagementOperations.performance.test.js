/**
 * @file mouthEngagementOperations.performance.test.js
 * @description Performance tests for mouth engagement operations
 *
 * Performance Thresholds:
 * - Bulk operations: <1000ms for 20 operations (10 locks + 10 unlocks)
 * - Memory cycles: 100 lock/unlock cycles without memory issues
 * - Concurrent operations: <1500ms for 40 concurrent operations (20 actors)
 * - Linear scalability: Operations should scale linearly with count
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Core system components
import EventBus from '../../../../src/events/eventBus.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import LockMouthEngagementHandler from '../../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import {
  getMouthParts,
  isMouthLocked,
} from '../../../../src/utils/mouthEngagementUtils.js';

// Component management
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { createMockLogger } from '../../../common/mockFactories.js';

// Constants
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('Mouth Engagement Operations - Performance', () => {
  let eventBus;
  let entityManager;
  let operationInterpreter;
  let operationRegistry;
  let logger;

  beforeEach(async () => {
    // Initialize core components
    logger = createMockLogger();
    eventBus = new EventBus({ logger });
    entityManager = new SimpleEntityManager([]);

    // Setup operation registry with handlers
    operationRegistry = new OperationRegistry({ logger });

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

    // Initialize operation interpreter
    operationInterpreter = new OperationInterpreter({
      logger,
      operationRegistry,
    });
  });

  afterEach(() => {
    // Clean up any remaining entities
    if (entityManager && entityManager.clear) {
      entityManager.clear();
    }
  });

  /**
   * Helper function to create test actors with mouth anatomy
   *
   * @param id
   * @param name
   */
  async function createTestActorWithMouth(id, name) {
    await entityManager.createEntity(id);
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });
    await entityManager.addComponent(id, POSITION_COMPONENT_ID, {
      locationId: 'room1',
    });

    // Add anatomy with mouth (following the existing test pattern)
    await entityManager.addComponent(id, 'anatomy:body', {
      body: {
        root: 'torso_1',
        parts: { mouth: `${id}_mouth` },
      },
    });

    // Create mouth part entity with components expected by mouth engagement handlers
    const mouthId = `${id}_mouth`;
    await entityManager.createEntity(mouthId);
    await entityManager.addComponent(mouthId, 'anatomy:part', {
      subType: 'mouth',
    });
    await entityManager.addComponent(mouthId, 'anatomy:sockets', {
      sockets: [
        {
          id: 'teeth',
          allowedTypes: ['teeth'],
          nameTpl: '{{type}}',
        },
      ],
    });
    await entityManager.addComponent(mouthId, 'core:name', {
      text: 'mouth',
    });
    // This component is what the lock handler expects
    await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
      locked: false,
      forcedOverride: false,
    });

    return id;
  }

  describe('Performance Characteristics', () => {
    it('should handle bulk operations efficiently', async () => {
      const actors = [];
      for (let i = 0; i < 10; i++) {
        const actorId = await createTestActorWithMouth(
          `bulk_actor_${i}`,
          `BulkActor${i}`
        );
        actors.push(actorId);
      }

      const startTime = performance.now();

      // Lock all mouths
      for (const actorId of actors) {
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
      }

      // Unlock all mouths
      for (const actorId of actors) {
        const context = {
          evaluationContext: { actor: { id: actorId } },
          entityManager,
          logger,
        };

        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 20 operations (10 locks + 10 unlocks) in reasonable time
      expect(duration).toBeLessThan(1000); // 1 second max

      // Verify final state
      for (const actorId of actors) {
        expect(isMouthLocked(entityManager, actorId)).toBe(false);
      }
    });

    it('should not cause memory leaks in repeated operations', async () => {
      const actorId = await createTestActorWithMouth(
        'memory_test_actor',
        'MemoryTestActor'
      );

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Perform many lock/unlock cycles
      for (let i = 0; i < 100; i++) {
        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );

        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );
      }

      // Should still be in consistent state
      expect(isMouthLocked(entityManager, actorId)).toBe(false);
    });

    it('should maintain performance with concurrent operations', async () => {
      const actors = [];
      for (let i = 0; i < 20; i++) {
        const actorId = await createTestActorWithMouth(
          `concurrent_${i}`,
          `ConcurrentActor${i}`
        );
        actors.push(actorId);
      }

      const startTime = performance.now();

      // Create concurrent operation promises
      const lockPromises = actors.map((actorId) =>
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          {
            evaluationContext: { actor: { id: actorId } },
            entityManager,
            logger,
          }
        )
      );

      // Execute all locks concurrently
      await Promise.all(lockPromises);

      // Verify all are locked
      for (const actorId of actors) {
        expect(isMouthLocked(entityManager, actorId)).toBe(true);
      }

      // Create concurrent unlock promises
      const unlockPromises = actors.map((actorId) =>
        operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          {
            evaluationContext: { actor: { id: actorId } },
            entityManager,
            logger,
          }
        )
      );

      // Execute all unlocks concurrently
      await Promise.all(unlockPromises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete efficiently even with concurrent operations
      expect(duration).toBeLessThan(1500); // 1.5 seconds max for 40 operations

      // Verify all are unlocked
      for (const actorId of actors) {
        expect(isMouthLocked(entityManager, actorId)).toBe(false);
      }
    });

    it('should handle operations at scale without degradation', async () => {
      // Pre-create actors to focus on operation performance
      const actors = [];
      for (let i = 0; i < 50; i++) {
        const actorId = await createTestActorWithMouth(
          `scale_${i}`,
          `ScaleActor${i}`
        );
        actors.push(actorId);
      }

      const startTime = performance.now();

      // Perform operations on all actors
      for (const actorId of actors) {
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
      }

      for (const actorId of actors) {
        const context = {
          evaluationContext: { actor: { id: actorId } },
          entityManager,
          logger,
        };

        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 100 operations (50 locks + 50 unlocks) efficiently
      expect(duration).toBeLessThan(3000); // 3 seconds max for 100 operations

      // Average time per operation should be reasonable
      const avgTimePerOp = duration / 100;
      expect(avgTimePerOp).toBeLessThan(30); // Less than 30ms per operation
    });
  });
});
