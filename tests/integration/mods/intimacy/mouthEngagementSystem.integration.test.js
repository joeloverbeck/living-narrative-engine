/**
 * @file Core Mouth Engagement System Integration Tests
 * @description Tests complete mouth engagement system integration with real components
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Core system components
import EventBus from '../../../../src/events/eventBus.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import LockMouthEngagementHandler from '../../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import { getMouthParts } from '../../../../src/utils/mouthEngagementUtils.js';

// Component management
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { createMockLogger } from '../../../common/mockFactories.js';

// Constants
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('Mouth Engagement System - Core Integration', () => {
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

  /**
   * Helper function to check if mouth is locked using the utility function
   */
  function isMouthLocked(actorId) {
    const mouthParts = getMouthParts(entityManager, actorId);
    return mouthParts.length > 0 && mouthParts[0].engagement?.locked === true;
  }

  describe('Operation Integration', () => {
    it('should execute LOCK_MOUTH_ENGAGEMENT through interpreter', async () => {
      const actorId = await createTestActorWithMouth('test_actor', 'TestActor');

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

      expect(isMouthLocked(actorId)).toBe(true);
    });

    it('should execute UNLOCK_MOUTH_ENGAGEMENT through interpreter', async () => {
      const actorId = await createTestActorWithMouth('test_actor', 'TestActor');

      // First lock the mouth
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

      expect(isMouthLocked(actorId)).toBe(true);

      // Then unlock it
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      expect(isMouthLocked(actorId)).toBe(false);
    });

    it('should handle operation failures gracefully', async () => {
      const context = {
        evaluationContext: { actor: { id: 'non_existent' } },
        entityManager,
        logger,
      };

      // Test with non-existent entity
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: 'non_existent' },
          },
          context
        )
      ).resolves.not.toThrow();

      // Should log error but not crash
    });

    it('should handle multiple sequential operations correctly', async () => {
      const actorId = await createTestActorWithMouth(
        'sequential_actor',
        'SequentialActor'
      );

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Multiple lock/unlock cycles
      for (let i = 0; i < 3; i++) {
        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );

        expect(isMouthLocked(actorId)).toBe(true);

        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );

        expect(isMouthLocked(actorId)).toBe(false);
      }
    });
  });

  describe('Multi-Actor Integration', () => {
    it('should handle multiple actors independently', async () => {
      const actor1 = await createTestActorWithMouth('actor1', 'Actor1');
      const actor2 = await createTestActorWithMouth('actor2', 'Actor2');
      const actor3 = await createTestActorWithMouth('actor3', 'Actor3');

      const context1 = {
        evaluationContext: { actor: { id: actor1 } },
        entityManager,
        logger,
      };
      const context2 = {
        evaluationContext: { actor: { id: actor2 } },
        entityManager,
        logger,
      };
      const context3 = {
        evaluationContext: { actor: { id: actor3 } },
        entityManager,
        logger,
      };

      // Lock first two actors
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor1 },
        },
        context1
      );

      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor2 },
        },
        context2
      );

      // Verify states
      expect(isMouthLocked(actor1)).toBe(true);
      expect(isMouthLocked(actor2)).toBe(true);
      expect(isMouthLocked(actor3)).toBe(false);

      // Unlock first actor only
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor1 },
        },
        context1
      );

      // Verify independent state changes
      expect(isMouthLocked(actor1)).toBe(false);
      expect(isMouthLocked(actor2)).toBe(true);
      expect(isMouthLocked(actor3)).toBe(false);
    });

    it('should handle concurrent-like operations on different actors', async () => {
      const actors = [];
      const contexts = [];

      // Create multiple actors
      for (let i = 0; i < 5; i++) {
        const actorId = await createTestActorWithMouth(
          `concurrent_actor_${i}`,
          `ConcurrentActor${i}`
        );
        actors.push(actorId);
        contexts.push({
          evaluationContext: { actor: { id: actorId } },
          entityManager,
          logger,
        });
      }

      // Lock all actors in sequence (simulating concurrent operations)
      const lockPromises = actors.map((actorId, index) =>
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          contexts[index]
        )
      );

      await Promise.all(lockPromises);

      // Verify all are locked
      actors.forEach((actorId) => {
        expect(isMouthLocked(actorId)).toBe(true);
      });

      // Unlock all actors
      const unlockPromises = actors.map((actorId, index) =>
        operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          contexts[index]
        )
      );

      await Promise.all(unlockPromises);

      // Verify all are unlocked
      actors.forEach((actorId) => {
        expect(isMouthLocked(actorId)).toBe(false);
      });
    });
  });

  describe('Event System Integration', () => {
    it('should complete operations without errors even if no events are dispatched', async () => {
      const actorId = await createTestActorWithMouth(
        'event_actor',
        'EventActor'
      );
      const capturedEvents = [];

      // Subscribe to all events
      const unsubscribe = eventBus.subscribe('*', (event) => {
        capturedEvents.push(event);
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

      // Operation should complete successfully regardless of event dispatch
      expect(isMouthLocked(actorId)).toBe(true);

      // If events are dispatched, they should be properly formatted
      capturedEvents.forEach((event) => {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('payload');
      });

      unsubscribe();
    });

    it('should not break when no event subscribers exist', async () => {
      const actorId = await createTestActorWithMouth(
        'no_sub_actor',
        'NoSubActor'
      );

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Should work fine without subscribers
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        )
      ).resolves.not.toThrow();

      expect(isMouthLocked(actorId)).toBe(true);
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    it('should handle actors without mouth anatomy gracefully', async () => {
      // Create actor without mouth
      const actorId = 'no_mouth_actor';
      await entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'NoMouthActor',
      });

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Operations should not fail even without mouth anatomy
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        )
      ).resolves.not.toThrow();

      await expect(
        operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('should handle malformed parameters gracefully', async () => {
      const context = {
        evaluationContext: { actor: { id: 'test' } },
        entityManager,
        logger,
      };

      // Test various invalid parameter formats
      const invalidParams = [
        {},
        { actor_id: '' },
        { actor_id: null },
        { actor_id: undefined },
        { wrong_param: 'test' },
      ];

      for (const params of invalidParams) {
        await expect(
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: params,
            },
            context
          )
        ).resolves.not.toThrow();

        await expect(
          operationInterpreter.execute(
            {
              type: 'UNLOCK_MOUTH_ENGAGEMENT',
              parameters: params,
            },
            context
          )
        ).resolves.not.toThrow();
      }
    });

    it('should maintain consistency under rapid state changes', async () => {
      const actorId = await createTestActorWithMouth(
        'rapid_actor',
        'RapidActor'
      );

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Rapid lock/unlock operations
      for (let i = 0; i < 10; i++) {
        await operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );

        expect(isMouthLocked(actorId)).toBe(true);

        await operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        );

        expect(isMouthLocked(actorId)).toBe(false);
      }
    });
  });

  describe('System State Consistency', () => {
    it('should maintain mouth part data integrity', async () => {
      const actorId = await createTestActorWithMouth(
        'integrity_actor',
        'IntegrityActor'
      );

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Get initial mouth parts
      const initialMouthParts = getMouthParts(entityManager, actorId);
      expect(initialMouthParts).toHaveLength(1);
      expect(initialMouthParts[0].engagement).toBeTruthy();

      // Lock mouth
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      const lockedMouthParts = getMouthParts(entityManager, actorId);
      expect(lockedMouthParts).toHaveLength(1);
      expect(lockedMouthParts[0].engagement.locked).toBe(true);

      // Verify other component data is unchanged
      expect(lockedMouthParts[0].partComponent).toEqual(
        initialMouthParts[0].partComponent
      );

      // Unlock mouth
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      const unlockedMouthParts = getMouthParts(entityManager, actorId);
      expect(unlockedMouthParts).toHaveLength(1);
      expect(unlockedMouthParts[0].engagement.locked).toBe(false);

      // Verify component integrity maintained
      expect(unlockedMouthParts[0].partComponent).toEqual(
        initialMouthParts[0].partComponent
      );
    });
  });
});
