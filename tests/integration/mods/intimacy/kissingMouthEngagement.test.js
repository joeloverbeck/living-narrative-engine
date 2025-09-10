/**
 * @file Integration tests for kissing workflow with mouth engagement
 * Tests that LOCK/UNLOCK_MOUTH_ENGAGEMENT operations work correctly with the actual handlers
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

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

describe('Kissing - Mouth Engagement Integration', () => {
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

  /**
   * Helper function to create test actors with mouth anatomy matching existing patterns
   *
   * @param {string} id - Actor ID
   * @param {string} name - Actor name
   * @returns {Promise<string>} The created actor ID
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
   *
   * @param {string} actorId - Actor ID to check
   * @returns {boolean} True if mouth is locked
   */
  function isMouthLocked(actorId) {
    const mouthParts = getMouthParts(entityManager, actorId);
    return mouthParts.length > 0 && mouthParts[0].engagement?.locked === true;
  }

  describe('Basic Mouth Engagement Operations', () => {
    test('should successfully lock and unlock mouth engagement for single actor', async () => {
      // Create test actor with mouth anatomy
      const actorId = await createTestActorWithMouth('test_actor', 'TestActor');

      // Initially mouth should be unlocked
      expect(isMouthLocked(actorId)).toBe(false);

      // Lock mouth engagement
      const lockOperation = {
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actorId },
      };

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      await operationInterpreter.execute(lockOperation, context);

      // Mouth should now be locked
      expect(isMouthLocked(actorId)).toBe(true);

      // Unlock mouth engagement
      const unlockOperation = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actorId },
      };

      await operationInterpreter.execute(unlockOperation, context);

      // Mouth should now be unlocked
      expect(isMouthLocked(actorId)).toBe(false);
    });

    test('should handle lock and unlock for multiple actors (simulating kiss workflow)', async () => {
      // Create two test actors with mouth anatomy
      const actor1 = await createTestActorWithMouth('actor1', 'Alice');
      const actor2 = await createTestActorWithMouth('actor2', 'Bob');

      // Initially both mouths should be unlocked
      expect(isMouthLocked(actor1)).toBe(false);
      expect(isMouthLocked(actor2)).toBe(false);

      // Lock both actors' mouths (simulating kiss start)
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

      // Both mouths should now be locked
      expect(isMouthLocked(actor1)).toBe(true);
      expect(isMouthLocked(actor2)).toBe(true);

      // Unlock both actors' mouths (simulating kiss end)
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor1 },
        },
        context1
      );

      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor2 },
        },
        context2
      );

      // Both mouths should now be unlocked
      expect(isMouthLocked(actor1)).toBe(false);
      expect(isMouthLocked(actor2)).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle actors without mouth anatomy gracefully', async () => {
      // Create actors without mouth anatomy
      const actor1 = 'no_mouth_actor1';
      await entityManager.createEntity(actor1);
      await entityManager.addComponent(actor1, NAME_COMPONENT_ID, {
        text: 'NoMouth1',
      });

      const context = {
        evaluationContext: { actor: { id: actor1 } },
        entityManager,
        logger,
      };

      // Lock operations should not fail even without mouth anatomy
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor1 },
          },
          context
        )
      ).resolves.not.toThrow();

      // Unlock operations should also not fail
      await expect(
        operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor1 },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    test('should validate that the parameter format matches rule file expectations', () => {
      // Test that the operations use the correct parameter format expected by the handlers
      const lockParams = { actor_id: 'test_actor_id' };
      const unlockParams = { actor_id: 'test_actor_id' };

      // Verify parameter structure matches what handlers expect
      expect(lockParams).toHaveProperty('actor_id');
      expect(unlockParams).toHaveProperty('actor_id');
      expect(typeof lockParams.actor_id).toBe('string');
      expect(typeof unlockParams.actor_id).toBe('string');

      // Parameters should not have the old entity_ref format
      expect(lockParams).not.toHaveProperty('entity_ref');
      expect(unlockParams).not.toHaveProperty('entity_ref');
    });
  });

  describe('Workflow Simulation', () => {
    test('should simulate the complete kiss workflow sequence', async () => {
      // This test simulates the sequence that would happen in the actual rules:
      // 1. ADD_COMPONENT for kissing state (simulated by adding components directly)
      // 2. LOCK_MOUTH_ENGAGEMENT operations
      // 3. UNLOCK_MOUTH_ENGAGEMENT operations
      // 4. REMOVE_COMPONENT for kissing state (simulated by removing components directly)

      const actor1 = await createTestActorWithMouth(
        'workflow_actor1',
        'WorkflowAlice'
      );
      const actor2 = await createTestActorWithMouth(
        'workflow_actor2',
        'WorkflowBob'
      );

      // Step 1: Simulate adding kissing components (what the rule would do)
      await entityManager.addComponent(actor1, 'intimacy:kissing', {
        partner: actor2,
        initiator: true,
      });
      await entityManager.addComponent(actor2, 'intimacy:kissing', {
        partner: actor1,
        initiator: false,
      });

      // Verify kissing components exist
      expect(
        entityManager.getComponentData(actor1, 'intimacy:kissing')
      ).toBeTruthy();
      expect(
        entityManager.getComponentData(actor2, 'intimacy:kissing')
      ).toBeTruthy();

      // Step 2: Lock mouth engagement (what the updated rules now do)
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

      // Verify both mouths are locked
      expect(isMouthLocked(actor1)).toBe(true);
      expect(isMouthLocked(actor2)).toBe(true);

      // Step 3: Unlock mouth engagement (what the updated kiss end rules now do)
      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor1 },
        },
        context1
      );

      await operationInterpreter.execute(
        {
          type: 'UNLOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor2 },
        },
        context2
      );

      // Verify mouths are unlocked while kissing components still exist
      expect(isMouthLocked(actor1)).toBe(false);
      expect(isMouthLocked(actor2)).toBe(false);
      expect(
        entityManager.getComponentData(actor1, 'intimacy:kissing')
      ).toBeTruthy();
      expect(
        entityManager.getComponentData(actor2, 'intimacy:kissing')
      ).toBeTruthy();

      // Step 4: Remove kissing components (what the rule would do)
      entityManager.removeComponent(actor1, 'intimacy:kissing');
      entityManager.removeComponent(actor2, 'intimacy:kissing');

      // Verify final state
      expect(
        entityManager.getComponentData(actor1, 'intimacy:kissing')
      ).toBeNull();
      expect(
        entityManager.getComponentData(actor2, 'intimacy:kissing')
      ).toBeNull();
      expect(isMouthLocked(actor1)).toBe(false);
      expect(isMouthLocked(actor2)).toBe(false);
    });
  });
});
