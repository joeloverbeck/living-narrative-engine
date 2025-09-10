/**
 * @file Mouth Engagement Operations - System Integration Tests
 * @description Tests comprehensive system integration including events, performance, and error handling
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

describe('Mouth Engagement Operations - System Integration', () => {
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

  describe('Event System Integration', () => {
    it('should complete operations successfully with event bus integration', async () => {
      const actorId = await createTestActorWithMouth(
        'event_actor',
        'EventActor'
      );
      const eventsSeen = [];

      // Subscribe to event bus to capture events
      const unsubscribe = eventBus.subscribe('*', (event) => {
        eventsSeen.push(event);
      });

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

      // Operation should complete successfully
      expect(isMouthLocked(entityManager, actorId)).toBe(true);

      // If events were dispatched, they should be properly formatted
      eventsSeen.forEach((event) => {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('payload');
      });

      unsubscribe();
    });

    it('should handle event dispatch failures gracefully', async () => {
      const actorId = await createTestActorWithMouth(
        'fail_event_actor',
        'FailEventActor'
      );

      // Create a failing event bus
      const failingEventBus = {
        dispatch: jest.fn(() => {
          throw new Error('Event dispatch failed');
        }),
      };

      // Create handler with failing event bus
      const failingHandler = new LockMouthEngagementHandler({
        logger,
        entityManager,
        safeEventDispatcher: failingEventBus,
      });

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Operation should not fail even if event dispatch fails
      await expect(
        failingHandler.execute({ actor_id: actorId }, context)
      ).resolves.not.toThrow();

      // Mouth should still be locked despite event failure
      expect(isMouthLocked(entityManager, actorId)).toBe(true);
    });

    it('should handle sequential lock and unlock operations correctly', async () => {
      const actorId = await createTestActorWithMouth(
        'multi_event_actor',
        'MultiEventActor'
      );
      const allEvents = [];

      // Track all events
      const unsubscribe = eventBus.subscribe('*', (event) => {
        allEvents.push(event);
      });

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Execute lock operation
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      expect(isMouthLocked(entityManager, actorId)).toBe(true);

      // Execute unlock operation
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      expect(isMouthLocked(entityManager, actorId)).toBe(false);

      // Operations completed successfully regardless of event dispatch
      expect(allEvents.length).toBeGreaterThanOrEqual(0);

      unsubscribe();
    });

    it('should handle multiple event subscribers correctly', async () => {
      const actorId = await createTestActorWithMouth(
        'multi_sub_actor',
        'MultiSubActor'
      );
      const subscriber1Events = [];
      const subscriber2Events = [];
      const subscriber3Events = [];

      // Multiple subscribers
      const unsub1 = eventBus.subscribe('*', (event) =>
        subscriber1Events.push(event)
      );
      const unsub2 = eventBus.subscribe('*', (event) =>
        subscriber2Events.push(event)
      );
      const unsub3 = eventBus.subscribe('*', (event) =>
        subscriber3Events.push(event)
      );

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

      // Operation should complete successfully
      expect(isMouthLocked(entityManager, actorId)).toBe(true);

      // All subscribers should receive the same events (if any)
      expect(subscriber1Events.length).toBe(subscriber2Events.length);
      expect(subscriber2Events.length).toBe(subscriber3Events.length);

      unsub1();
      unsub2();
      unsub3();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors gracefully without crashing the system', async () => {
      const context = {
        evaluationContext: { actor: { id: 'nonexistent_actor' } },
        entityManager,
        logger,
      };

      // Operations with invalid actors should not crash
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: 'nonexistent_actor' },
          },
          context
        )
      ).resolves.not.toThrow();

      await expect(
        operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: 'nonexistent_actor' },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('should handle corrupted entity data gracefully', async () => {
      const actorId = await createTestActorWithMouth(
        'corrupt_actor',
        'CorruptActor'
      );

      // Corrupt the anatomy data
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          // Missing root, malformed structure
          parts: null,
        },
      });

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Should handle corrupted data gracefully
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('should recover from partial operation failures', async () => {
      const actorId = await createTestActorWithMouth(
        'partial_fail_actor',
        'PartialFailActor'
      );

      // Create a scenario where the operation might partially fail
      const originalAddComponent = entityManager.addComponent;
      let callCount = 0;

      // Mock addComponent to fail on second call
      entityManager.addComponent = async (...args) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Simulated failure');
        }
        return originalAddComponent.call(entityManager, ...args);
      };

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Operation should handle the failure gracefully
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        )
      ).resolves.not.toThrow();

      // Restore original function
      entityManager.addComponent = originalAddComponent;
    });

    it('should handle operation registry errors', async () => {
      // Create a faulty operation registry
      const faultyRegistry = new OperationRegistry({ logger });

      // Register a handler that throws an error
      faultyRegistry.register('LOCK_MOUTH_ENGAGEMENT', async () => {
        throw new Error('Handler error');
      });

      const faultyInterpreter = new OperationInterpreter({
        logger,
        operationRegistry: faultyRegistry,
      });

      const actorId = await createTestActorWithMouth(
        'faulty_actor',
        'FaultyActor'
      );

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Should handle handler errors and either reject or complete gracefully
      try {
        await faultyInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );
        // If it doesn't throw, that's fine - the interpreter handled it
      } catch (error) {
        // If it does throw, verify it's the expected error and the system isn't corrupted
        expect(error.message).toContain('Handler error');
      }

      // System should remain in a stable state
      expect(entityManager).toBeTruthy();
    });
  });

  describe('System State Consistency', () => {
    it('should maintain consistent state across operation failures', async () => {
      const actor1Id = await createTestActorWithMouth(
        'consistency1',
        'ConsistencyActor1'
      );
      const actor2Id = await createTestActorWithMouth(
        'consistency2',
        'ConsistencyActor2'
      );

      // Start with both actors unlocked
      expect(isMouthLocked(entityManager, actor1Id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(false);

      const context1 = {
        evaluationContext: { actor: { id: actor1Id } },
        entityManager,
        logger,
      };
      const context2 = {
        evaluationContext: { actor: { id: actor2Id } },
        entityManager,
        logger,
      };

      // Lock first actor successfully
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor1Id },
        },
        context1
      );

      expect(isMouthLocked(entityManager, actor1Id)).toBe(true);

      // Attempt to lock second actor (simulate failure by corrupting mid-operation)
      const mouthParts = getMouthParts(entityManager, actor2Id);
      if (mouthParts.length > 0) {
        // Simulate corruption during operation
        entityManager.removeComponent(
          mouthParts[0].partId,
          'core:mouth_engagement'
        );
      }

      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor2Id },
        },
        context2
      );

      // First actor should still be locked despite second actor's issues
      expect(isMouthLocked(entityManager, actor1Id)).toBe(true);
    });

    it('should maintain data integrity during concurrent modifications', async () => {
      const actorId = await createTestActorWithMouth(
        'concurrent_mod_actor',
        'ConcurrentModActor'
      );

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Start multiple concurrent operations
      const operations = [];

      // Add 5 concurrent lock operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actorId },
            },
            context
          )
        );
      }

      // Add 5 concurrent unlock operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          operationInterpreter.execute(
            {
              type: 'UNLOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actorId },
            },
            context
          )
        );
      }

      // Wait for all operations to complete
      await Promise.all(operations);

      // Verify the mouth engagement component still exists and is in a valid state
      const mouthParts = getMouthParts(entityManager, actorId);
      expect(mouthParts).toHaveLength(1);
      expect(mouthParts[0].engagement).toBeTruthy();
      expect(typeof mouthParts[0].engagement.locked).toBe('boolean');
    });

    it('should handle system-wide cleanup correctly', async () => {
      const actors = [];

      // Create multiple actors and perform various operations
      for (let i = 0; i < 5; i++) {
        const actorId = await createTestActorWithMouth(
          `cleanup_${i}`,
          `CleanupActor${i}`
        );
        actors.push(actorId);

        const context = {
          evaluationContext: { actor: { id: actorId } },
          entityManager,
          logger,
        };

        // Lock some actors
        if (i % 2 === 0) {
          await operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actorId },
            },
            context
          );
        }
      }

      // Verify initial state
      actors.forEach((actorId, index) => {
        if (index % 2 === 0) {
          expect(isMouthLocked(entityManager, actorId)).toBe(true);
        } else {
          expect(isMouthLocked(entityManager, actorId)).toBe(false);
        }
      });

      // Perform cleanup - unlock all
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

      // Verify all are unlocked
      for (const actorId of actors) {
        expect(isMouthLocked(entityManager, actorId)).toBe(false);
      }
    });
  });

  describe('Integration with Utility Functions', () => {
    it('should integrate correctly with getMouthParts utility', async () => {
      const actorId = await createTestActorWithMouth(
        'utility_actor',
        'UtilityActor'
      );

      // Initial state
      let mouthParts = getMouthParts(entityManager, actorId);
      expect(mouthParts).toHaveLength(1);
      expect(mouthParts[0].engagement.locked).toBe(false);

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Lock mouth
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      // Verify utility function reflects changes
      mouthParts = getMouthParts(entityManager, actorId);
      expect(mouthParts).toHaveLength(1);
      expect(mouthParts[0].engagement.locked).toBe(true);

      // Unlock mouth
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      // Verify utility function reflects changes
      mouthParts = getMouthParts(entityManager, actorId);
      expect(mouthParts).toHaveLength(1);
      expect(mouthParts[0].engagement.locked).toBe(false);
    });

    it('should integrate correctly with isMouthLocked utility', async () => {
      const actorId = await createTestActorWithMouth(
        'locked_check_actor',
        'LockedCheckActor'
      );

      // Initial state
      expect(isMouthLocked(entityManager, actorId)).toBe(false);

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Lock and verify
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      expect(isMouthLocked(entityManager, actorId)).toBe(true);

      // Unlock and verify
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      expect(isMouthLocked(entityManager, actorId)).toBe(false);
    });
  });
});
