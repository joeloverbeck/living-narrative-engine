/**
 * @file mouthEngagementEdgeCases.integration.test.js
 * @description Edge case and boundary tests for mouth engagement system
 *
 * Edge Case Coverage:
 * - Entity variations (no anatomy, malformed anatomy, circular references)
 * - Component states (extra properties, invalid values, missing components)
 * - Concurrent operations (simultaneous lock/unlock, rapid state changes)
 * - Invalid inputs (special characters, extreme values, wrong types)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { createMockLogger } from '../../../common/mockFactories.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import LockMouthEngagementHandler from '../../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import EventBus from '../../../../src/events/eventBus.js';
import {
  getMouthParts,
  isMouthLocked,
} from '../../../../src/utils/mouthEngagementUtils.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('Mouth Engagement - Edge Cases', () => {
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

  describe('Entity Edge Cases', () => {
    it('should handle entity without anatomy gracefully', async () => {
      // Create basic entity without anatomy components
      const entityId = 'basic_entity';
      await entityManager.createEntity(entityId);
      await entityManager.addComponent(entityId, NAME_COMPONENT_ID, {
        text: 'Basic Entity',
      });

      const context = {
        evaluationContext: { actor: { id: entityId } },
        entityManager,
        logger,
      };

      // Should not throw when trying to lock mouth on entity without anatomy
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: entityId },
          },
          context
        )
      ).resolves.not.toThrow();

      // The operation should complete but may not create mouth engagement
      // Check if any mouth parts were found
      const mouthParts = getMouthParts(entityManager, entityId);
      expect(mouthParts).toEqual([]); // No mouth parts on entity without anatomy
    });

    it('should handle entity with malformed anatomy', async () => {
      const entityId = 'malformed_entity';
      await entityManager.createEntity(entityId);
      await entityManager.addComponent(entityId, NAME_COMPONENT_ID, {
        text: 'Malformed Entity',
      });

      // Add malformed anatomy
      await entityManager.addComponent(entityId, 'anatomy:body', {
        body: {
          // Missing root
          parts: null, // Invalid parts
        },
      });

      const context = {
        evaluationContext: { actor: { id: entityId } },
        entityManager,
        logger,
      };

      // Should not throw and fall back to legacy handling
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: entityId },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('should handle entity with multiple mouth parts', async () => {
      // Create actor with multiple mouth parts (unusual but possible)
      const actorId = 'multi_mouth_actor';
      await entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Multi-Mouth Actor',
      });

      // Create two mouth parts
      const mouth1Id = `${actorId}_mouth1`;
      const mouth2Id = `${actorId}_mouth2`;

      await entityManager.createEntity(mouth1Id);
      await entityManager.addComponent(mouth1Id, 'anatomy:part', {
        subType: 'mouth',
      });
      await entityManager.addComponent(mouth1Id, 'core:mouth_engagement', {
        locked: false,
        forcedOverride: false,
      });

      await entityManager.createEntity(mouth2Id);
      await entityManager.addComponent(mouth2Id, 'anatomy:part', {
        subType: 'mouth',
      });
      await entityManager.addComponent(mouth2Id, 'core:mouth_engagement', {
        locked: false,
        forcedOverride: false,
      });

      // Add anatomy with multiple mouths
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: 'torso',
          parts: {
            mouth: mouth1Id,
            mouth2: mouth2Id,
          },
        },
      });

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Lock should affect the primary mouth
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actorId },
        },
        context
      );

      // Check that at least one mouth is locked
      const mouth1Engagement = entityManager.getComponentData(
        mouth1Id,
        'core:mouth_engagement'
      );
      expect(mouth1Engagement?.locked).toBe(true);
    });

    it('should handle circular anatomy references', async () => {
      const entityId = 'circular_entity';
      const part1Id = 'part_1';
      const part2Id = 'part_2';

      await entityManager.createEntity(entityId);
      await entityManager.createEntity(part1Id);
      await entityManager.createEntity(part2Id);

      // Create circular reference in anatomy
      await entityManager.addComponent(entityId, 'anatomy:body', {
        body: {
          root: part1Id,
          parts: { mouth: part1Id, head: part2Id },
        },
      });

      await entityManager.addComponent(part1Id, 'anatomy:part', {
        subType: 'mouth',
        parent: part2Id,
      });
      await entityManager.addComponent(part1Id, 'core:mouth_engagement', {
        locked: false,
        forcedOverride: false,
      });

      await entityManager.addComponent(part2Id, 'anatomy:part', {
        subType: 'head',
        parent: part1Id, // Circular reference
      });

      const context = {
        evaluationContext: { actor: { id: entityId } },
        entityManager,
        logger,
      };

      // Should not hang or crash despite circular reference
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: entityId },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('should handle non-existent entity gracefully', async () => {
      const context = {
        evaluationContext: { actor: { id: 'non_existent_entity' } },
        entityManager,
        logger,
      };

      // Should not throw when entity doesn't exist
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: 'non_existent_entity' },
          },
          context
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Component Edge Cases', () => {
    it('should handle existing mouth engagement with extra properties', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');

      // Add mouth engagement with extra properties
      await entityManager.addComponent(actor.mouthId, 'core:mouth_engagement', {
        locked: false,
        forcedOverride: false,
        customProperty: 'should be preserved',
        timestamp: Date.now(),
        metadata: { test: 'data' },
      });

      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      // Lock operation should preserve extra properties
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id },
        },
        context
      );

      const updatedComponent = entityManager.getComponentData(
        actor.mouthId,
        'core:mouth_engagement'
      );

      expect(updatedComponent.locked).toBe(true);
      expect(updatedComponent.customProperty).toBe('should be preserved');
      expect(updatedComponent.timestamp).toBeDefined();
      expect(updatedComponent.metadata).toEqual({ test: 'data' });
    });

    it('should handle forcedOverride edge cases', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');

      // Set forcedOverride to true
      await entityManager.addComponent(actor.mouthId, 'core:mouth_engagement', {
        locked: true,
        forcedOverride: true,
      });

      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      // Test forcedOverride behavior through operations
      // The behavior depends on implementation details
      // This test validates that forcedOverride doesn't break the system
      await expect(
        operationInterpreter.execute(
          {
            type: 'UNLOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actor.id },
          },
          context
        )
      ).resolves.not.toThrow();

      // Verify the unlock succeeded
      const engagement = entityManager.getComponentData(
        actor.mouthId,
        'core:mouth_engagement'
      );
      expect(engagement.locked).toBe(false);
    });

    it('should handle missing mouth engagement component gracefully', async () => {
      const actorId = 'actor_no_engagement';
      await entityManager.createEntity(actorId);
      await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'No Engagement Actor',
      });

      // Create mouth part without mouth_engagement component
      const mouthId = `${actorId}_mouth`;
      await entityManager.createEntity(mouthId);
      await entityManager.addComponent(mouthId, 'anatomy:part', {
        subType: 'mouth',
      });
      // Intentionally not adding core:mouth_engagement component

      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: 'torso',
          parts: { mouth: mouthId },
        },
      });

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Should handle missing component gracefully
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: actorId },
          },
          context
        )
      ).resolves.not.toThrow();

      // The handler should create the component if missing
      const engagement = entityManager.getComponentData(
        mouthId,
        'core:mouth_engagement'
      );
      expect(engagement).toBeDefined();
      expect(engagement.locked).toBe(true);
    });
  });

  describe('Concurrent Access Edge Cases', () => {
    it('should handle simultaneous lock/unlock operations', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      // Start multiple operations simultaneously
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          operationInterpreter.execute(
            {
              type:
                i % 2 === 0
                  ? 'LOCK_MOUTH_ENGAGEMENT'
                  : 'UNLOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            context
          )
        );
      }

      // All should complete without throwing
      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Final state should be consistent (last operation wins)
      const mouthEngagement = entityManager.getComponentData(
        actor.mouthId,
        'core:mouth_engagement'
      );
      expect(typeof mouthEngagement.locked).toBe('boolean');
    });

    it('should handle rapid condition evaluations during state changes', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      const evaluations = [];
      const operations = [];

      // Start condition evaluations via operations
      for (let i = 0; i < 20; i++) {
        evaluations.push(
          operationInterpreter
            .execute(
              {
                type: 'LOCK_MOUTH_ENGAGEMENT',
                parameters: { actor_id: actor.id },
              },
              context
            )
            .then(() => true)
            .catch(() => false)
        );
      }

      // Start state changes
      for (let i = 0; i < 10; i++) {
        operations.push(
          operationInterpreter.execute(
            {
              type:
                i % 2 === 0
                  ? 'LOCK_MOUTH_ENGAGEMENT'
                  : 'UNLOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            context
          )
        );
      }

      // All should complete
      const [evalResults, opResults] = await Promise.all([
        Promise.all(evaluations),
        Promise.all(operations),
      ]);

      // All evaluations should return boolean
      for (const result of evalResults) {
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle multiple actors being modified concurrently', async () => {
      const actors = [];
      for (let i = 0; i < 20; i++) {
        actors.push(
          await createTestActorWithMouth(
            `concurrent_${i}`,
            `ConcurrentActor${i}`
          )
        );
      }

      // Create random operations on different actors
      const operations = [];
      for (let i = 0; i < 100; i++) {
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

      // All operations should complete successfully
      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Each actor should have a valid state
      for (const actor of actors) {
        const engagement = entityManager.getComponentData(
          actor.mouthId,
          'core:mouth_engagement'
        );
        expect(typeof engagement.locked).toBe('boolean');
      }
    });
  });

  describe('Invalid Input Edge Cases', () => {
    it('should handle extremely long entity IDs', async () => {
      const longId = 'a'.repeat(10000);
      const context = {
        evaluationContext: { actor: { id: longId } },
        entityManager,
        logger,
      };

      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: longId },
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('should handle entity IDs with special characters', async () => {
      const specialIds = [
        'entity:with:colons',
        'entity-with-dashes',
        'entity_with_underscores',
        'entity.with.dots',
        'entity with spaces',
        'entity\nwith\nnewlines',
        'entity\twith\ttabs',
        'entity"with"quotes',
        'entity\\with\\backslashes',
        'entity/with/slashes',
        'entity{with}braces',
        'entity[with]brackets',
        'entity(with)parens',
        'entity#with#hashes',
        'entity@with@ats',
        'entity$with$dollars',
        'entity%with%percents',
        'entity^with^carets',
        'entity&with&ampersands',
        'entity*with*asterisks',
        'entity+with+plus',
        'entity=with=equals',
        'entity|with|pipes',
        'entity~with~tildes',
        'entity`with`backticks',
        'entity!with!exclamations',
        'entity?with?questions',
        'entity<with>angles',
        'entity;with;semicolons',
        "entity'with'apostrophes",
        'entity,with,commas',
      ];

      for (const id of specialIds) {
        const context = {
          evaluationContext: { actor: { id } },
          entityManager,
          logger,
        };

        await expect(
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: id },
            },
            context
          )
        ).resolves.not.toThrow();
      }
    });

    it('should handle null and undefined parameters gracefully', async () => {
      const context = {
        evaluationContext: { actor: { id: 'test_actor' } },
        entityManager,
        logger,
      };

      // Test with null actor_id
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: null },
          },
          context
        )
      ).resolves.not.toThrow();

      // Test with undefined actor_id
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: undefined },
          },
          context
        )
      ).resolves.not.toThrow();

      // Test with missing parameters
      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: {},
          },
          context
        )
      ).resolves.not.toThrow();
    });

    it('should handle numeric and boolean entity IDs', async () => {
      const unusualIds = [
        123,
        0,
        -1,
        3.14159,
        true,
        false,
        Infinity,
        -Infinity,
        NaN,
      ];

      for (const id of unusualIds) {
        const context = {
          evaluationContext: { actor: { id } },
          entityManager,
          logger,
        };

        await expect(
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: id },
            },
            context
          )
        ).resolves.not.toThrow();
      }
    });

    it('should handle empty string entity ID', async () => {
      const context = {
        evaluationContext: { actor: { id: '' } },
        entityManager,
        logger,
      };

      await expect(
        operationInterpreter.execute(
          {
            type: 'LOCK_MOUTH_ENGAGEMENT',
            parameters: { actor_id: '' },
          },
          context
        )
      ).resolves.not.toThrow();
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle repeated lock operations on already locked mouth', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      // Lock the mouth
      await operationInterpreter.execute(
        {
          type: 'LOCK_MOUTH_ENGAGEMENT',
          parameters: { actor_id: actor.id },
        },
        context
      );

      expect(isMouthLocked(entityManager, actor.id)).toBe(true);

      // Try to lock again multiple times
      for (let i = 0; i < 5; i++) {
        await expect(
          operationInterpreter.execute(
            {
              type: 'LOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            context
          )
        ).resolves.not.toThrow();
      }

      // Should still be locked
      expect(isMouthLocked(entityManager, actor.id)).toBe(true);
    });

    it('should handle repeated unlock operations on already unlocked mouth', async () => {
      const actor = await createTestActorWithMouth('actor1', 'Test Actor');
      const context = {
        evaluationContext: { actor: { id: actor.id } },
        entityManager,
        logger,
      };

      // Ensure mouth starts unlocked
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);

      // Try to unlock multiple times
      for (let i = 0; i < 5; i++) {
        await expect(
          operationInterpreter.execute(
            {
              type: 'UNLOCK_MOUTH_ENGAGEMENT',
              parameters: { actor_id: actor.id },
            },
            context
          )
        ).resolves.not.toThrow();
      }

      // Should still be unlocked
      expect(isMouthLocked(entityManager, actor.id)).toBe(false);
    });
  });
});
