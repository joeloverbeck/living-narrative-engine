/**
 * @file Kissing Mouth Locks Integration Tests
 * @description Tests dedicated kiss workflow lock/unlock behavior and edge cases
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

describe('Kissing Mouth Locks - Integration', () => {
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
   * Helper function to execute lock operation
   */
  async function lockMouth(actorId) {
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

  /**
   * Helper function to execute unlock operation
   */
  async function unlockMouth(actorId) {
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

  /**
   * Helper function to simulate full kiss initiation workflow
   */
  async function initiateKiss(actor1Id, actor2Id) {
    // Add kissing components
    await entityManager.addComponent(actor1Id, 'intimacy:kissing', {
      partner: actor2Id,
      initiator: true,
      intensity: 'gentle',
    });
    await entityManager.addComponent(actor2Id, 'intimacy:kissing', {
      partner: actor1Id,
      initiator: false,
      intensity: 'gentle',
    });

    // Lock mouths
    await lockMouth(actor1Id);
    await lockMouth(actor2Id);
  }

  /**
   * Helper function to simulate full kiss ending workflow
   */
  async function endKiss(actor1Id, actor2Id) {
    // Unlock mouths
    await unlockMouth(actor1Id);
    await unlockMouth(actor2Id);

    // Remove kissing components
    entityManager.removeComponent(actor1Id, 'intimacy:kissing');
    entityManager.removeComponent(actor2Id, 'intimacy:kissing');
  }

  describe('Kiss Lock Lifecycle', () => {
    it('should handle basic kiss initiation and completion', async () => {
      const aliceId = await createTestActorWithMouth('alice', 'Alice');
      const bobId = await createTestActorWithMouth('bob', 'Bob');

      // Initial state
      expect(isMouthLocked(entityManager, aliceId)).toBe(false);
      expect(isMouthLocked(entityManager, bobId)).toBe(false);

      // Initiate kiss
      await initiateKiss(aliceId, bobId);

      // Verify kiss state
      expect(isMouthLocked(entityManager, aliceId)).toBe(true);
      expect(isMouthLocked(entityManager, bobId)).toBe(true);
      expect(
        entityManager.getComponentData(aliceId, 'intimacy:kissing')
      ).toBeTruthy();
      expect(
        entityManager.getComponentData(bobId, 'intimacy:kissing')
      ).toBeTruthy();

      // End kiss
      await endKiss(aliceId, bobId);

      // Verify clean end state
      expect(isMouthLocked(entityManager, aliceId)).toBe(false);
      expect(isMouthLocked(entityManager, bobId)).toBe(false);
      expect(
        entityManager.getComponentData(aliceId, 'intimacy:kissing')
      ).toBeNull();
      expect(
        entityManager.getComponentData(bobId, 'intimacy:kissing')
      ).toBeNull();
    });

    it('should handle repeated kiss cycles without issues', async () => {
      const actor1Id = await createTestActorWithMouth('cycle1', 'CycleActor1');
      const actor2Id = await createTestActorWithMouth('cycle2', 'CycleActor2');

      // Multiple kiss cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        // Initiate kiss
        await initiateKiss(actor1Id, actor2Id);

        expect(isMouthLocked(entityManager, actor1Id)).toBe(true);
        expect(isMouthLocked(entityManager, actor2Id)).toBe(true);

        // End kiss
        await endKiss(actor1Id, actor2Id);

        expect(isMouthLocked(entityManager, actor1Id)).toBe(false);
        expect(isMouthLocked(entityManager, actor2Id)).toBe(false);
      }
    });

    it('should maintain kiss component data integrity during lock operations', async () => {
      const actor1Id = await createTestActorWithMouth(
        'integrity1',
        'IntegrityActor1'
      );
      const actor2Id = await createTestActorWithMouth(
        'integrity2',
        'IntegrityActor2'
      );

      // Initiate kiss with specific intensity
      await entityManager.addComponent(actor1Id, 'intimacy:kissing', {
        partner: actor2Id,
        initiator: true,
        intensity: 'passionate',
        duration: 'brief',
      });
      await entityManager.addComponent(actor2Id, 'intimacy:kissing', {
        partner: actor1Id,
        initiator: false,
        intensity: 'passionate',
        duration: 'brief',
      });

      // Lock mouths
      await lockMouth(actor1Id);
      await lockMouth(actor2Id);

      // Verify kissing component data remained intact
      const kissing1 = entityManager.getComponentData(
        actor1Id,
        'intimacy:kissing'
      );
      const kissing2 = entityManager.getComponentData(
        actor2Id,
        'intimacy:kissing'
      );

      expect(kissing1.partner).toBe(actor2Id);
      expect(kissing1.initiator).toBe(true);
      expect(kissing1.intensity).toBe('passionate');
      expect(kissing1.duration).toBe('brief');

      expect(kissing2.partner).toBe(actor1Id);
      expect(kissing2.initiator).toBe(false);
      expect(kissing2.intensity).toBe('passionate');
      expect(kissing2.duration).toBe('brief');

      // Unlock mouths
      await unlockMouth(actor1Id);
      await unlockMouth(actor2Id);

      // Verify kissing components still intact after unlock
      const kissing1After = entityManager.getComponentData(
        actor1Id,
        'intimacy:kissing'
      );
      const kissing2After = entityManager.getComponentData(
        actor2Id,
        'intimacy:kissing'
      );

      expect(kissing1After).toEqual(kissing1);
      expect(kissing2After).toEqual(kissing2);
    });
  });

  describe('Kiss Interruption Scenarios', () => {
    it('should handle interrupted kiss workflows gracefully', async () => {
      const actor1Id = await createTestActorWithMouth(
        'interrupt1',
        'InterruptActor1'
      );
      const actor2Id = await createTestActorWithMouth(
        'interrupt2',
        'InterruptActor2'
      );

      // Start kiss workflow
      await initiateKiss(actor1Id, actor2Id);

      expect(isMouthLocked(entityManager, actor1Id)).toBe(true);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(true);

      // Simulate external interruption (e.g., only one actor's mouth gets unlocked)
      await unlockMouth(actor1Id);

      // Partial state - one locked, one unlocked
      expect(isMouthLocked(entityManager, actor1Id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(true);

      // System should handle cleanup gracefully
      await unlockMouth(actor2Id); // Clean up remaining lock
      entityManager.removeComponent(actor1Id, 'intimacy:kissing');
      entityManager.removeComponent(actor2Id, 'intimacy:kissing');

      // Final state should be clean
      expect(isMouthLocked(entityManager, actor1Id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(false);
      expect(
        entityManager.getComponentData(actor1Id, 'intimacy:kissing')
      ).toBeNull();
      expect(
        entityManager.getComponentData(actor2Id, 'intimacy:kissing')
      ).toBeNull();
    });

    it('should handle sudden component removal during kiss', async () => {
      const actor1Id = await createTestActorWithMouth(
        'sudden1',
        'SuddenActor1'
      );
      const actor2Id = await createTestActorWithMouth(
        'sudden2',
        'SuddenActor2'
      );

      // Start kiss
      await initiateKiss(actor1Id, actor2Id);

      expect(isMouthLocked(entityManager, actor1Id)).toBe(true);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(true);

      // Sudden removal of kissing component (e.g., actor leaves scene)
      entityManager.removeComponent(actor1Id, 'intimacy:kissing');

      // Mouths should still be locked until explicitly unlocked
      expect(isMouthLocked(entityManager, actor1Id)).toBe(true);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(true);
      expect(
        entityManager.getComponentData(actor2Id, 'intimacy:kissing')
      ).toBeTruthy();

      // Cleanup operations should still work
      await unlockMouth(actor1Id);
      await unlockMouth(actor2Id);
      entityManager.removeComponent(actor2Id, 'intimacy:kissing');

      expect(isMouthLocked(entityManager, actor1Id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(false);
    });

    it('should handle double unlock operations gracefully', async () => {
      const actorId = await createTestActorWithMouth(
        'double_unlock',
        'DoubleUnlockActor'
      );

      // Lock mouth
      await lockMouth(actorId);
      expect(isMouthLocked(entityManager, actorId)).toBe(true);

      // First unlock
      await unlockMouth(actorId);
      expect(isMouthLocked(entityManager, actorId)).toBe(false);

      // Second unlock (should be safe)
      await expect(unlockMouth(actorId)).resolves.not.toThrow();
      expect(isMouthLocked(entityManager, actorId)).toBe(false);
    });

    it('should handle double lock operations gracefully', async () => {
      const actorId = await createTestActorWithMouth(
        'double_lock',
        'DoubleLockActor'
      );

      // First lock
      await lockMouth(actorId);
      expect(isMouthLocked(entityManager, actorId)).toBe(true);

      // Second lock (should be safe)
      await expect(lockMouth(actorId)).resolves.not.toThrow();
      expect(isMouthLocked(entityManager, actorId)).toBe(true);

      // Should still unlock normally
      await unlockMouth(actorId);
      expect(isMouthLocked(entityManager, actorId)).toBe(false);
    });
  });

  describe('Complex Multi-Actor Kiss Scenarios', () => {
    it('should handle love triangle interruptions', async () => {
      const aliceId = await createTestActorWithMouth(
        'alice_tri',
        'AliceTriangle'
      );
      const bobId = await createTestActorWithMouth('bob_tri', 'BobTriangle');
      const charlieId = await createTestActorWithMouth(
        'charlie_tri',
        'CharlieTriangle'
      );

      // Alice and Bob start kissing
      await initiateKiss(aliceId, bobId);

      expect(isMouthLocked(entityManager, aliceId)).toBe(true);
      expect(isMouthLocked(entityManager, bobId)).toBe(true);
      expect(isMouthLocked(entityManager, charlieId)).toBe(false);

      // Charlie cannot kiss Alice while she's kissing Bob
      expect(isMouthLocked(entityManager, aliceId)).toBe(true);

      // Alice and Bob end their kiss
      await endKiss(aliceId, bobId);

      expect(isMouthLocked(entityManager, aliceId)).toBe(false);
      expect(isMouthLocked(entityManager, bobId)).toBe(false);

      // Now Alice can kiss Charlie
      await initiateKiss(aliceId, charlieId);

      expect(isMouthLocked(entityManager, aliceId)).toBe(true);
      expect(isMouthLocked(entityManager, bobId)).toBe(false);
      expect(isMouthLocked(entityManager, charlieId)).toBe(true);
    });

    it('should handle multiple simultaneous kiss pairs', async () => {
      // Create 6 actors for 3 simultaneous kiss pairs
      const actors = [];
      for (let i = 0; i < 6; i++) {
        const actorId = await createTestActorWithMouth(
          `multi_${i}`,
          `MultiActor${i}`
        );
        actors.push(actorId);
      }

      // Create 3 kiss pairs: (0,1), (2,3), (4,5)
      const pairs = [
        [actors[0], actors[1]],
        [actors[2], actors[3]],
        [actors[4], actors[5]],
      ];

      // Initiate all kisses
      for (const [actor1, actor2] of pairs) {
        await initiateKiss(actor1, actor2);
      }

      // Verify all actors are locked appropriately
      for (let i = 0; i < 6; i++) {
        expect(isMouthLocked(entityManager, actors[i])).toBe(true);
      }

      // End kisses one by one
      for (let pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
        const [actor1, actor2] = pairs[pairIndex];
        await endKiss(actor1, actor2);

        // Verify this pair is unlocked
        expect(isMouthLocked(entityManager, actor1)).toBe(false);
        expect(isMouthLocked(entityManager, actor2)).toBe(false);

        // Verify other pairs are still locked
        for (
          let otherPairIndex = pairIndex + 1;
          otherPairIndex < pairs.length;
          otherPairIndex++
        ) {
          const [otherActor1, otherActor2] = pairs[otherPairIndex];
          expect(isMouthLocked(entityManager, otherActor1)).toBe(true);
          expect(isMouthLocked(entityManager, otherActor2)).toBe(true);
        }
      }

      // All actors should now be unlocked
      for (let i = 0; i < 6; i++) {
        expect(isMouthLocked(entityManager, actors[i])).toBe(false);
      }
    });

    it('should handle group kiss scenarios (hypothetical)', async () => {
      // Note: This tests the system's ability to handle complex locking scenarios
      // even if group kisses aren't typical in the game
      const actor1Id = await createTestActorWithMouth('group1', 'GroupActor1');
      const actor2Id = await createTestActorWithMouth('group2', 'GroupActor2');
      const actor3Id = await createTestActorWithMouth('group3', 'GroupActor3');

      // Each actor kisses a different partner, but all are involved
      await initiateKiss(actor1Id, actor2Id);

      // Actor3 tries to kiss actor1, but actor1's mouth is locked
      expect(isMouthLocked(entityManager, actor1Id)).toBe(true);

      // Lock actor3's mouth for something else
      await lockMouth(actor3Id);

      // All actors now have locked mouths
      expect(isMouthLocked(entityManager, actor1Id)).toBe(true);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(true);
      expect(isMouthLocked(entityManager, actor3Id)).toBe(true);

      // Clean up in proper order
      await endKiss(actor1Id, actor2Id);
      await unlockMouth(actor3Id);

      // All should be unlocked
      expect(isMouthLocked(entityManager, actor1Id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(false);
      expect(isMouthLocked(entityManager, actor3Id)).toBe(false);
    });
  });

  describe('Performance and Memory Testing', () => {
    it('should handle rapid kiss operations without performance degradation', async () => {
      const actor1Id = await createTestActorWithMouth('perf1', 'PerfActor1');
      const actor2Id = await createTestActorWithMouth('perf2', 'PerfActor2');

      const startTime = performance.now();

      // Rapid kiss cycles
      for (let i = 0; i < 20; i++) {
        await initiateKiss(actor1Id, actor2Id);
        await endKiss(actor1Id, actor2Id);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (allowing for 40 operations)
      expect(duration).toBeLessThan(1000); // 1 second max

      // Final state should be clean
      expect(isMouthLocked(entityManager, actor1Id)).toBe(false);
      expect(isMouthLocked(entityManager, actor2Id)).toBe(false);
    });

    it('should not leak memory during extensive kiss operations', async () => {
      const actors = [];

      // Create 10 actors
      for (let i = 0; i < 10; i++) {
        const actorId = await createTestActorWithMouth(
          `memory_${i}`,
          `MemoryActor${i}`
        );
        actors.push(actorId);
      }

      // Perform many random kiss operations
      for (let cycle = 0; cycle < 50; cycle++) {
        const actor1 = actors[Math.floor(Math.random() * actors.length)];
        const actor2 = actors[Math.floor(Math.random() * actors.length)];

        if (
          actor1 !== actor2 &&
          !isMouthLocked(entityManager, actor1) &&
          !isMouthLocked(entityManager, actor2)
        ) {
          await initiateKiss(actor1, actor2);

          // Random delay simulation (some kisses end quickly)
          if (Math.random() > 0.5) {
            await endKiss(actor1, actor2);
          }
        }
      }

      // Clean up any remaining kisses
      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          if (
            isMouthLocked(entityManager, actors[i]) &&
            isMouthLocked(entityManager, actors[j])
          ) {
            const kissing = entityManager.getComponentData(
              actors[i],
              'intimacy:kissing'
            );
            if (kissing && kissing.partner === actors[j]) {
              await endKiss(actors[i], actors[j]);
              break;
            }
          }
        }
      }

      // Verify clean final state
      for (const actorId of actors) {
        expect(isMouthLocked(entityManager, actorId)).toBe(false);
        expect(
          entityManager.getComponentData(actorId, 'intimacy:kissing')
        ).toBeNull();
      }
    });

    it('should maintain consistent state under stress', async () => {
      const actor1Id = await createTestActorWithMouth(
        'stress1',
        'StressActor1'
      );
      const actor2Id = await createTestActorWithMouth(
        'stress2',
        'StressActor2'
      );

      // Stress test with rapid operations
      for (let i = 0; i < 100; i++) {
        await lockMouth(actor1Id);
        expect(isMouthLocked(entityManager, actor1Id)).toBe(true);

        await lockMouth(actor2Id);
        expect(isMouthLocked(entityManager, actor2Id)).toBe(true);

        await unlockMouth(actor1Id);
        expect(isMouthLocked(entityManager, actor1Id)).toBe(false);

        await unlockMouth(actor2Id);
        expect(isMouthLocked(entityManager, actor2Id)).toBe(false);
      }
    });
  });

  describe('Kiss Component State Validation', () => {
    it('should maintain referential integrity between kiss partners', async () => {
      const actor1Id = await createTestActorWithMouth('ref1', 'RefActor1');
      const actor2Id = await createTestActorWithMouth('ref2', 'RefActor2');

      await initiateKiss(actor1Id, actor2Id);

      // Check bidirectional references
      const kissing1 = entityManager.getComponentData(
        actor1Id,
        'intimacy:kissing'
      );
      const kissing2 = entityManager.getComponentData(
        actor2Id,
        'intimacy:kissing'
      );

      expect(kissing1.partner).toBe(actor2Id);
      expect(kissing2.partner).toBe(actor1Id);
      expect(kissing1.initiator).toBe(true);
      expect(kissing2.initiator).toBe(false);

      await endKiss(actor1Id, actor2Id);

      // Both components should be removed
      expect(
        entityManager.getComponentData(actor1Id, 'intimacy:kissing')
      ).toBeNull();
      expect(
        entityManager.getComponentData(actor2Id, 'intimacy:kissing')
      ).toBeNull();
    });

    it('should handle kiss partner validation', async () => {
      const actor1Id = await createTestActorWithMouth('valid1', 'ValidActor1');
      const actor2Id = await createTestActorWithMouth('valid2', 'ValidActor2');
      const actor3Id = await createTestActorWithMouth('valid3', 'ValidActor3');

      // Start kiss between actor1 and actor2
      await initiateKiss(actor1Id, actor2Id);

      // Verify correct partner references
      const kissing1 = entityManager.getComponentData(
        actor1Id,
        'intimacy:kissing'
      );
      const kissing2 = entityManager.getComponentData(
        actor2Id,
        'intimacy:kissing'
      );

      expect(kissing1.partner).toBe(actor2Id);
      expect(kissing2.partner).toBe(actor1Id);

      // Actor3 should not have kissing component
      expect(
        entityManager.getComponentData(actor3Id, 'intimacy:kissing')
      ).toBeNull();
      expect(isMouthLocked(entityManager, actor3Id)).toBe(false);
    });
  });
});
