import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Core system components
import EventBus from '../../../../src/events/eventBus.js';
import OperationInterpreter from '../../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../../src/logic/operationRegistry.js';
import UnlockMouthEngagementHandler from '../../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';

// Test utilities
import { SimpleEntityManager } from '../../../common/entities/index.js';
import { createMockLogger } from '../../../common/mockFactories.js';

describe('UnlockMouthEngagementHandler - Integration', () => {
  let eventBus;
  let entityManager;
  let operationInterpreter;
  let operationRegistry;
  let logger;

  beforeEach(() => {
    // Initialize core components
    logger = createMockLogger();
    eventBus = new EventBus({ logger });
    entityManager = new SimpleEntityManager([]);

    // Setup operation registry with handler
    operationRegistry = new OperationRegistry({ logger });
    const handler = new UnlockMouthEngagementHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
    });
    operationRegistry.register('UNLOCK_MOUTH_ENGAGEMENT', (...args) =>
      handler.execute(...args)
    );

    // Initialize operation interpreter
    operationInterpreter = new OperationInterpreter({
      logger,
      operationRegistry,
    });
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Operation Interpreter Integration', () => {
    test('should integrate with operation interpreter', async () => {
      // Create test entity
      const actorId = 'test-actor-1';
      await entityManager.createEntity(actorId);

      // Add anatomy with mouth
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: 'torso_1',
          parts: { mouth: 'mouth_1' },
        },
      });

      // Create mouth part entity
      await entityManager.createEntity('mouth_1');
      await entityManager.addComponent('mouth_1', 'anatomy:part', {
        subType: 'mouth',
      });

      // Pre-lock the mouth
      await entityManager.addComponent('mouth_1', 'core:mouth_engagement', {
        locked: true,
        forcedOverride: false,
      });

      // Execute unlock operation through interpreter
      const operation = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actorId },
      };

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      await operationInterpreter.execute(operation, context);

      // Verify mouth is unlocked
      const engagement = entityManager.getComponentData(
        'mouth_1',
        'core:mouth_engagement'
      );

      expect(engagement).toBeDefined();
      expect(engagement.locked).toBe(false);
    });

    test('should handle legacy entity through interpreter', async () => {
      // Create legacy entity without anatomy
      const actorId = 'legacy-actor';
      await entityManager.createEntity(actorId);

      // Pre-lock the mouth on entity directly
      await entityManager.addComponent(actorId, 'core:mouth_engagement', {
        locked: true,
        forcedOverride: false,
      });

      // Execute unlock operation
      const operation = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actorId },
      };

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      await operationInterpreter.execute(operation, context);

      // Verify mouth engagement is unlocked on entity directly
      const engagement = entityManager.getComponentData(
        actorId,
        'core:mouth_engagement'
      );

      expect(engagement).toBeDefined();
      expect(engagement.locked).toBe(false);
    });

    test('should handle multiple mouths', async () => {
      // Create entity with multiple mouths
      const actorId = 'multi-mouth-entity';
      await entityManager.createEntity(actorId);

      // Add anatomy with two mouths
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: 'torso_1',
          parts: {
            mouth: 'mouth_1',
            secondary_mouth: 'mouth_2',
          },
        },
      });

      // Create mouth part entities
      await entityManager.createEntity('mouth_1');
      await entityManager.addComponent('mouth_1', 'anatomy:part', {
        subType: 'mouth',
        name: 'primary_mouth',
      });

      await entityManager.createEntity('mouth_2');
      await entityManager.addComponent('mouth_2', 'anatomy:part', {
        subType: 'mouth',
        name: 'secondary_mouth',
      });

      // Pre-lock both mouths
      await entityManager.addComponent('mouth_1', 'core:mouth_engagement', {
        locked: true,
        forcedOverride: false,
      });
      await entityManager.addComponent('mouth_2', 'core:mouth_engagement', {
        locked: true,
        forcedOverride: false,
      });

      // Execute unlock operation
      const operation = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actorId },
      };

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      await operationInterpreter.execute(operation, context);

      // Verify both mouths are unlocked
      const engagement1 = entityManager.getComponentData(
        'mouth_1',
        'core:mouth_engagement'
      );
      const engagement2 = entityManager.getComponentData(
        'mouth_2',
        'core:mouth_engagement'
      );

      expect(engagement1).toBeDefined();
      expect(engagement1.locked).toBe(false);
      expect(engagement2).toBeDefined();
      expect(engagement2.locked).toBe(false);
    });

    test('should preserve existing forcedOverride', async () => {
      // Create test entity
      const actorId = 'test-actor-override';
      await entityManager.createEntity(actorId);

      // Add anatomy with mouth
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: 'torso_1',
          parts: { mouth: 'mouth_1' },
        },
      });

      // Create mouth part entity with forcedOverride
      await entityManager.createEntity('mouth_1');
      await entityManager.addComponent('mouth_1', 'anatomy:part', {
        subType: 'mouth',
      });

      // Set initial locked state with forcedOverride
      await entityManager.addComponent('mouth_1', 'core:mouth_engagement', {
        locked: true,
        forcedOverride: true,
      });

      // Execute unlock operation
      const operation = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actorId },
      };

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      await operationInterpreter.execute(operation, context);

      // Verify mouth is unlocked but forcedOverride is preserved
      const engagement = entityManager.getComponentData(
        'mouth_1',
        'core:mouth_engagement'
      );

      expect(engagement).toBeDefined();
      expect(engagement.locked).toBe(false);
      expect(engagement.forcedOverride).toBe(true);
    });

    test('should handle entity without mouth gracefully', async () => {
      // Create entity with anatomy but no mouth parts
      const actorId = 'no-mouth-entity';
      await entityManager.createEntity(actorId);

      // Add anatomy with non-mouth parts
      await entityManager.addComponent(actorId, 'anatomy:body', {
        body: {
          root: 'torso_1',
          parts: {
            head: 'head_1',
            hand: 'hand_1',
          },
        },
      });

      // Create non-mouth part entities
      await entityManager.createEntity('head_1');
      await entityManager.addComponent('head_1', 'anatomy:part', {
        subType: 'head',
      });

      await entityManager.createEntity('hand_1');
      await entityManager.addComponent('hand_1', 'anatomy:part', {
        subType: 'hand',
      });

      // Execute unlock operation
      const operation = {
        type: 'UNLOCK_MOUTH_ENGAGEMENT',
        parameters: { actor_id: actorId },
      };

      const context = {
        evaluationContext: { actor: { id: actorId } },
        entityManager,
        logger,
      };

      // Should not throw
      await expect(
        operationInterpreter.execute(operation, context)
      ).resolves.not.toThrow();

      // Verify no mouth engagement was created on non-mouth parts
      const headEngagement = entityManager.getComponentData(
        'head_1',
        'core:mouth_engagement'
      );
      const handEngagement = entityManager.getComponentData(
        'hand_1',
        'core:mouth_engagement'
      );

      expect(headEngagement).toBeNull();
      expect(handEngagement).toBeNull();
    });
  });
});
