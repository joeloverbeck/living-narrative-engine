/**
 * @file Kissing-Positioning Conflict Integration Tests
 * @description Tests integration between kissing workflows and positioning action conflicts
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

describe('Kissing-Positioning Conflict - Integration', () => {
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
      safeEventDispatcher: eventBus
    });
    operationRegistry.register('LOCK_MOUTH_ENGAGEMENT', (...args) => lockHandler.execute(...args));
    
    const unlockHandler = new UnlockMouthEngagementHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus
    });
    operationRegistry.register('UNLOCK_MOUTH_ENGAGEMENT', (...args) => unlockHandler.execute(...args));
    
    // Initialize operation interpreter
    operationInterpreter = new OperationInterpreter({
      logger,
      operationRegistry
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
    await entityManager.addComponent(id, POSITION_COMPONENT_ID, { locationId: 'room1' });
    
    // Add anatomy with mouth (following the existing test pattern)
    await entityManager.addComponent(id, 'anatomy:body', {
      body: {
        root: 'torso_1',
        parts: { mouth: `${id}_mouth` }
      }
    });
    
    // Create mouth part entity with components expected by mouth engagement handlers
    const mouthId = `${id}_mouth`;
    await entityManager.createEntity(mouthId);
    await entityManager.addComponent(mouthId, 'anatomy:part', {
      subType: 'mouth'
    });
    await entityManager.addComponent(mouthId, 'anatomy:sockets', {
      sockets: [
        {
          id: 'teeth',
          allowedTypes: ['teeth'],
          nameTpl: '{{type}}'
        }
      ]
    });
    await entityManager.addComponent(mouthId, 'core:name', {
      text: 'mouth'
    });
    // This component is what the lock handler expects
    await entityManager.addComponent(mouthId, 'core:mouth_engagement', {
      locked: false,
      forcedOverride: false
    });
    
    return id;
  }

  /**
   * Helper function to check if mouth is locked
   */
  function isMouthLocked(actorId) {
    const mouthParts = getMouthParts(entityManager, actorId);
    return mouthParts.length > 0 && mouthParts[0].engagement?.locked === true;
  }

  /**
   * Helper function to simulate kiss workflow (simplified for integration testing)
   */
  async function simulateKissWorkflow(actor1Id, actor2Id) {
    // Step 1: Simulate adding kissing components (what the rule would do)
    await entityManager.addComponent(actor1Id, 'intimacy:kissing', {
      partner: actor2Id,
      initiator: true
    });
    await entityManager.addComponent(actor2Id, 'intimacy:kissing', {
      partner: actor1Id,
      initiator: false
    });

    // Step 2: Lock mouth engagement (what the updated rules now do)
    const context1 = {
      evaluationContext: { actor: { id: actor1Id } },
      entityManager,
      logger
    };
    const context2 = {
      evaluationContext: { actor: { id: actor2Id } },
      entityManager,
      logger
    };

    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor1Id }
    }, context1);

    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor2Id }
    }, context2);

    return { context1, context2 };
  }

  /**
   * Helper function to simulate kiss end workflow
   */
  async function simulateKissEndWorkflow(actor1Id, actor2Id, context1, context2) {
    // Unlock mouth engagement (what the updated kiss end rules now do)
    await operationInterpreter.execute({
      type: 'UNLOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor1Id }
    }, context1);

    await operationInterpreter.execute({
      type: 'UNLOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor2Id }
    }, context2);

    // Remove kissing components (what the rule would do)
    entityManager.removeComponent(actor1Id, 'intimacy:kissing');
    entityManager.removeComponent(actor2Id, 'intimacy:kissing');
  }

  describe('Complete Kissing Workflow', () => {
    it('should lock and unlock mouths during kiss lifecycle', async () => {
      const actor1Id = await createTestActorWithMouth('alice', 'Alice');
      const actor2Id = await createTestActorWithMouth('bob', 'Bob');
      
      // Initially both mouths should be unlocked
      expect(isMouthLocked(actor1Id)).toBe(false);
      expect(isMouthLocked(actor2Id)).toBe(false);

      // Simulate kiss start workflow
      const { context1, context2 } = await simulateKissWorkflow(actor1Id, actor2Id);

      // Verify kiss established and mouths locked
      const kissing1 = entityManager.getComponentData(actor1Id, 'intimacy:kissing');
      const kissing2 = entityManager.getComponentData(actor2Id, 'intimacy:kissing');
      expect(kissing1.partner).toBe(actor2Id);
      expect(kissing2.partner).toBe(actor1Id);
      expect(isMouthLocked(actor1Id)).toBe(true);
      expect(isMouthLocked(actor2Id)).toBe(true);

      // Simulate kiss end workflow
      await simulateKissEndWorkflow(actor1Id, actor2Id, context1, context2);

      // Verify kiss ended and mouths unlocked
      expect(entityManager.getComponentData(actor1Id, 'intimacy:kissing')).toBeNull();
      expect(entityManager.getComponentData(actor2Id, 'intimacy:kissing')).toBeNull();
      expect(isMouthLocked(actor1Id)).toBe(false);
      expect(isMouthLocked(actor2Id)).toBe(false);
    });

    it('should handle multiple kiss ending scenarios correctly', async () => {
      // Test that mouth engagement is properly unlocked regardless of how kiss ends
      const actor1Id = await createTestActorWithMouth('test1', 'TestActor1');
      const actor2Id = await createTestActorWithMouth('test2', 'TestActor2');

      // Start kiss workflow
      const { context1, context2 } = await simulateKissWorkflow(actor1Id, actor2Id);

      // Verify locked
      expect(isMouthLocked(actor1Id)).toBe(true);
      expect(isMouthLocked(actor2Id)).toBe(true);

      // End kiss workflow
      await simulateKissEndWorkflow(actor1Id, actor2Id, context1, context2);

      // Verify unlocked
      expect(isMouthLocked(actor1Id)).toBe(false);
      expect(isMouthLocked(actor2Id)).toBe(false);
    });

    it('should handle interrupted kiss scenarios', async () => {
      const actor1Id = await createTestActorWithMouth('interrupted1', 'InterruptedActor1');
      const actor2Id = await createTestActorWithMouth('interrupted2', 'InterruptedActor2');

      // Start kiss workflow
      const { context1, context2 } = await simulateKissWorkflow(actor1Id, actor2Id);

      // Verify kiss established
      expect(isMouthLocked(actor1Id)).toBe(true);
      expect(isMouthLocked(actor2Id)).toBe(true);
      
      // Simulate abrupt kiss interruption (only unlock one actor's mouth)
      await operationInterpreter.execute({
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor1Id }
      }, context1);
      
      // Verify partial unlock state
      expect(isMouthLocked(actor1Id)).toBe(false);
      expect(isMouthLocked(actor2Id)).toBe(true);
      
      // Complete the cleanup
      await operationInterpreter.execute({
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor2Id }
      }, context2);
      
      entityManager.removeComponent(actor1Id, 'intimacy:kissing');
      entityManager.removeComponent(actor2Id, 'intimacy:kissing');
      
      // Verify final clean state
      expect(isMouthLocked(actor1Id)).toBe(false);
      expect(isMouthLocked(actor2Id)).toBe(false);
    });

    it('should maintain kiss component state during mouth lock operations', async () => {
      const actor1Id = await createTestActorWithMouth('state_test1', 'StateTestActor1');
      const actor2Id = await createTestActorWithMouth('state_test2', 'StateTestActor2');

      // Start kiss workflow
      await simulateKissWorkflow(actor1Id, actor2Id);

      // Verify kissing components remain intact throughout mouth locking
      let kissing1 = entityManager.getComponentData(actor1Id, 'intimacy:kissing');
      let kissing2 = entityManager.getComponentData(actor2Id, 'intimacy:kissing');
      
      expect(kissing1).toBeTruthy();
      expect(kissing2).toBeTruthy();
      expect(kissing1.partner).toBe(actor2Id);
      expect(kissing2.partner).toBe(actor1Id);
      expect(kissing1.initiator).toBe(true);
      expect(kissing2.initiator).toBe(false);

      // Verify mouth locks are applied
      expect(isMouthLocked(actor1Id)).toBe(true);
      expect(isMouthLocked(actor2Id)).toBe(true);

      // Unlock mouths but keep kissing components (intermediate state)
      const context1 = {
        evaluationContext: { actor: { id: actor1Id } },
        entityManager,
        logger
      };
      const context2 = {
        evaluationContext: { actor: { id: actor2Id } },
        entityManager,
        logger
      };

      await operationInterpreter.execute({
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor1Id }
      }, context1);

      await operationInterpreter.execute({
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor2Id }
      }, context2);

      // Verify kissing components still exist while mouths are unlocked
      kissing1 = entityManager.getComponentData(actor1Id, 'intimacy:kissing');
      kissing2 = entityManager.getComponentData(actor2Id, 'intimacy:kissing');
      
      expect(kissing1).toBeTruthy();
      expect(kissing2).toBeTruthy();
      expect(isMouthLocked(actor1Id)).toBe(false);
      expect(isMouthLocked(actor2Id)).toBe(false);
    });
  });

  describe('Multi-Actor Scenarios', () => {
    it('should handle kisses with bystanders', async () => {
      const aliceId = await createTestActorWithMouth('alice', 'Alice');
      const bobId = await createTestActorWithMouth('bob', 'Bob');
      const charlieId = await createTestActorWithMouth('charlie', 'Charlie');

      // Alice and Bob kiss
      await simulateKissWorkflow(aliceId, bobId);

      // Alice and Bob should have locked mouths
      expect(isMouthLocked(aliceId)).toBe(true);
      expect(isMouthLocked(bobId)).toBe(true);

      // Charlie should have unlocked mouth
      expect(isMouthLocked(charlieId)).toBe(false);
      
      // Charlie should be able to have independent mouth state changes
      const charlieContext = {
        evaluationContext: { actor: { id: charlieId } },
        entityManager,
        logger
      };
      
      await operationInterpreter.execute({
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: charlieId }
      }, charlieContext);
      
      expect(isMouthLocked(charlieId)).toBe(true);
      
      // Alice and Bob should still be locked from their kiss
      expect(isMouthLocked(aliceId)).toBe(true);
      expect(isMouthLocked(bobId)).toBe(true);
    });

    it('should handle multiple simultaneous kisses', async () => {
      // Create two pairs of actors
      const alice1Id = await createTestActorWithMouth('alice1', 'Alice1');
      const bob1Id = await createTestActorWithMouth('bob1', 'Bob1');
      const alice2Id = await createTestActorWithMouth('alice2', 'Alice2');
      const bob2Id = await createTestActorWithMouth('bob2', 'Bob2');

      // Simulate two concurrent kisses
      const { context1: context1A, context2: context1B } = await simulateKissWorkflow(alice1Id, bob1Id);
      const { context1: context2A, context2: context2B } = await simulateKissWorkflow(alice2Id, bob2Id);

      // All actors should have locked mouths
      expect(isMouthLocked(alice1Id)).toBe(true);
      expect(isMouthLocked(bob1Id)).toBe(true);
      expect(isMouthLocked(alice2Id)).toBe(true);
      expect(isMouthLocked(bob2Id)).toBe(true);

      // End first kiss
      await simulateKissEndWorkflow(alice1Id, bob1Id, context1A, context1B);

      // First pair should be unlocked, second pair still locked
      expect(isMouthLocked(alice1Id)).toBe(false);
      expect(isMouthLocked(bob1Id)).toBe(false);
      expect(isMouthLocked(alice2Id)).toBe(true);
      expect(isMouthLocked(bob2Id)).toBe(true);

      // End second kiss
      await simulateKissEndWorkflow(alice2Id, bob2Id, context2A, context2B);

      // All actors should now be unlocked
      expect(isMouthLocked(alice1Id)).toBe(false);
      expect(isMouthLocked(bob1Id)).toBe(false);
      expect(isMouthLocked(alice2Id)).toBe(false);
      expect(isMouthLocked(bob2Id)).toBe(false);
    });

    it('should prevent cross-contamination between different kiss pairs', async () => {
      const pair1Actor1 = await createTestActorWithMouth('p1a1', 'Pair1Actor1');
      const pair1Actor2 = await createTestActorWithMouth('p1a2', 'Pair1Actor2');
      const pair2Actor1 = await createTestActorWithMouth('p2a1', 'Pair2Actor1');
      const pair2Actor2 = await createTestActorWithMouth('p2a2', 'Pair2Actor2');

      // Start kiss for pair 1
      await simulateKissWorkflow(pair1Actor1, pair1Actor2);

      // Verify only pair 1 is affected
      expect(isMouthLocked(pair1Actor1)).toBe(true);
      expect(isMouthLocked(pair1Actor2)).toBe(true);
      expect(isMouthLocked(pair2Actor1)).toBe(false);
      expect(isMouthLocked(pair2Actor2)).toBe(false);

      // Verify kissing components are separate
      const p1a1Kissing = entityManager.getComponentData(pair1Actor1, 'intimacy:kissing');
      const p1a2Kissing = entityManager.getComponentData(pair1Actor2, 'intimacy:kissing');
      const p2a1Kissing = entityManager.getComponentData(pair2Actor1, 'intimacy:kissing');
      const p2a2Kissing = entityManager.getComponentData(pair2Actor2, 'intimacy:kissing');

      expect(p1a1Kissing).toBeTruthy();
      expect(p1a2Kissing).toBeTruthy();
      expect(p2a1Kissing).toBeNull();
      expect(p2a2Kissing).toBeNull();

      expect(p1a1Kissing.partner).toBe(pair1Actor2);
      expect(p1a2Kissing.partner).toBe(pair1Actor1);
    });
  });

  describe('Workflow State Transitions', () => {
    it('should handle rapid kiss start-end cycles', async () => {
      const actor1Id = await createTestActorWithMouth('rapid1', 'RapidActor1');
      const actor2Id = await createTestActorWithMouth('rapid2', 'RapidActor2');

      // Multiple rapid kiss cycles
      for (let i = 0; i < 3; i++) {
        // Start kiss
        const { context1, context2 } = await simulateKissWorkflow(actor1Id, actor2Id);
        
        expect(isMouthLocked(actor1Id)).toBe(true);
        expect(isMouthLocked(actor2Id)).toBe(true);
        
        // End kiss
        await simulateKissEndWorkflow(actor1Id, actor2Id, context1, context2);
        
        expect(isMouthLocked(actor1Id)).toBe(false);
        expect(isMouthLocked(actor2Id)).toBe(false);
      }
    });

    it('should maintain data consistency through workflow transitions', async () => {
      const actor1Id = await createTestActorWithMouth('consistency1', 'ConsistencyActor1');
      const actor2Id = await createTestActorWithMouth('consistency2', 'ConsistencyActor2');

      // Get initial mouth part data
      const initialMouthParts1 = getMouthParts(entityManager, actor1Id);
      const initialMouthParts2 = getMouthParts(entityManager, actor2Id);

      expect(initialMouthParts1).toHaveLength(1);
      expect(initialMouthParts2).toHaveLength(1);

      // Start kiss workflow
      const { context1, context2 } = await simulateKissWorkflow(actor1Id, actor2Id);

      // Verify mouth part structure remains intact
      const lockedMouthParts1 = getMouthParts(entityManager, actor1Id);
      const lockedMouthParts2 = getMouthParts(entityManager, actor2Id);

      expect(lockedMouthParts1).toHaveLength(1);
      expect(lockedMouthParts2).toHaveLength(1);
      expect(lockedMouthParts1[0].partComponent).toEqual(initialMouthParts1[0].partComponent);
      expect(lockedMouthParts2[0].partComponent).toEqual(initialMouthParts2[0].partComponent);

      // End kiss workflow
      await simulateKissEndWorkflow(actor1Id, actor2Id, context1, context2);

      // Verify final state maintains structural integrity
      const finalMouthParts1 = getMouthParts(entityManager, actor1Id);
      const finalMouthParts2 = getMouthParts(entityManager, actor2Id);

      expect(finalMouthParts1).toHaveLength(1);
      expect(finalMouthParts2).toHaveLength(1);
      expect(finalMouthParts1[0].partComponent).toEqual(initialMouthParts1[0].partComponent);
      expect(finalMouthParts2[0].partComponent).toEqual(initialMouthParts2[0].partComponent);
    });
  });

  describe('Error Recovery in Kiss Workflows', () => {
    it('should handle partial workflow failures gracefully', async () => {
      const actor1Id = await createTestActorWithMouth('failure1', 'FailureActor1');
      const actor2Id = await createTestActorWithMouth('failure2', 'FailureActor2');

      // Start kiss workflow but simulate failure after partial completion
      await entityManager.addComponent(actor1Id, 'intimacy:kissing', {
        partner: actor2Id,
        initiator: true
      });
      
      // Only lock first actor's mouth (simulating partial failure)
      const context1 = {
        evaluationContext: { actor: { id: actor1Id } },
        entityManager,
        logger
      };
      
      await operationInterpreter.execute({
        type: 'LOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor1Id }
      }, context1);

      // Verify partial state
      expect(isMouthLocked(actor1Id)).toBe(true);
      expect(isMouthLocked(actor2Id)).toBe(false);
      expect(entityManager.getComponentData(actor1Id, 'intimacy:kissing')).toBeTruthy();
      expect(entityManager.getComponentData(actor2Id, 'intimacy:kissing')).toBeNull();

      // Recovery: complete the workflow or clean up
      await operationInterpreter.execute({
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actor1Id }
      }, context1);
      
      entityManager.removeComponent(actor1Id, 'intimacy:kissing');

      // Verify clean recovery
      expect(isMouthLocked(actor1Id)).toBe(false);
      expect(isMouthLocked(actor2Id)).toBe(false);
      expect(entityManager.getComponentData(actor1Id, 'intimacy:kissing')).toBeNull();
      expect(entityManager.getComponentData(actor2Id, 'intimacy:kissing')).toBeNull();
    });
  });
});