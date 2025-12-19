/**
 * @file Integration tests for RemoveLyingClosenessHandler
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import RemoveLyingClosenessHandler from '../../../../src/logic/operationHandlers/removeLyingClosenessHandler.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';
import EventBus from '../../../../src/events/eventBus.js';

describe('REMOVE_LYING_CLOSENESS Integration Tests', () => {
  let handler;
  let entityManager;
  let eventBus;
  let logger;
  let executionContext;

  beforeEach(async () => {
    logger = createMockLogger();

    // Create real services
    entityManager = new SimpleEntityManager();
    eventBus = new EventBus({ logger });

    // Create mock safeEventDispatcher that just calls eventBus
    const safeEventDispatcher = {
      dispatch: (event) => {
        eventBus.dispatch(event);
      },
    };

    // Create handler with dependencies
    handler = new RemoveLyingClosenessHandler({
      logger,
      entityManager,
      safeEventDispatcher,
      closenessCircleService,
    });

    // Setup execution context
    executionContext = {
      evaluationContext: {
        context: {},
      },
    };

    // Create test furniture
    entityManager.createEntity('furniture:test_bed');
    entityManager.addComponent(
      'furniture:test_bed',
      'lying:allows_lying_on',
      {}
    );

    // Create test actors
    entityManager.createEntity('game:alice');
    entityManager.createEntity('game:bob');
    entityManager.createEntity('game:charlie');
    entityManager.createEntity('game:david');

    // Set up lying down components (Alice, Bob, Charlie are lying on the same bed)
    entityManager.addComponent('game:alice', 'positioning:lying_down', {
      furniture_id: 'furniture:test_bed',
    });
    entityManager.addComponent('game:bob', 'positioning:lying_down', {
      furniture_id: 'furniture:test_bed',
    });
    entityManager.addComponent('game:charlie', 'positioning:lying_down', {
      furniture_id: 'furniture:test_bed',
    });

    // Set up initial closeness relationships (all actors lying together)
    entityManager.addComponent('game:alice', 'positioning:closeness', {
      partners: ['game:bob', 'game:charlie'],
    });
    entityManager.addComponent('game:bob', 'positioning:closeness', {
      partners: ['game:alice', 'game:charlie'],
    });
    entityManager.addComponent('game:charlie', 'positioning:closeness', {
      partners: ['game:alice', 'game:bob'],
    });

    // Set up movement locks for lying actors
    entityManager.addComponent('game:alice', 'core:movement', { locked: true });
    entityManager.addComponent('game:bob', 'core:movement', { locked: true });
    entityManager.addComponent('game:charlie', 'core:movement', {
      locked: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Workflow Integration', () => {
    it('should remove closeness and update movement locks when actor stands from lying', async () => {
      // Remove Alice's lying component to simulate her standing up
      entityManager.removeComponent('game:alice', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Verify Alice's closeness is removed
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'positioning:closeness'
      );
      expect(aliceCloseness).toBeNull();

      // Verify Bob's closeness to Alice is removed
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'positioning:closeness'
      );
      expect(bobCloseness?.partners).toEqual(['game:charlie']);

      // Verify Charlie's closeness to Alice is removed
      const charlieCloseness = entityManager.getComponentData(
        'game:charlie',
        'positioning:closeness'
      );
      expect(charlieCloseness?.partners).toEqual(['game:bob']);

      // Verify Alice's movement is unlocked
      const aliceMovement = entityManager.getComponentData(
        'game:alice',
        'core:movement'
      );
      expect(aliceMovement?.locked).toBe(false);

      // Verify Bob and Charlie still locked (still have closeness)
      const bobMovement = entityManager.getComponentData(
        'game:bob',
        'core:movement'
      );
      const charlieMovement = entityManager.getComponentData(
        'game:charlie',
        'core:movement'
      );
      expect(bobMovement?.locked).toBe(true);
      expect(charlieMovement?.locked).toBe(true);
    });

    it('should remove all closeness when all actors stand up', async () => {
      // Alice stands up first (Bob and Charlie still lying)
      entityManager.removeComponent('game:alice', 'positioning:lying_down');
      await handler.execute(
        {
          furniture_id: 'furniture:test_bed',
          actor_id: 'game:alice',
        },
        executionContext
      );

      // Bob stands up second (Charlie still lying)
      entityManager.removeComponent('game:bob', 'positioning:lying_down');
      await handler.execute(
        {
          furniture_id: 'furniture:test_bed',
          actor_id: 'game:bob',
        },
        executionContext
      );

      // All closeness should be removed
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'positioning:closeness'
      );
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'positioning:closeness'
      );
      const charlieCloseness = entityManager.getComponentData(
        'game:charlie',
        'positioning:closeness'
      );

      expect(aliceCloseness).toBeNull();
      expect(bobCloseness).toBeNull();
      expect(charlieCloseness).toBeNull();

      // All actors should have movement unlocked
      const aliceMovement = entityManager.getComponentData(
        'game:alice',
        'core:movement'
      );
      const bobMovement = entityManager.getComponentData(
        'game:bob',
        'core:movement'
      );
      const charlieMovement = entityManager.getComponentData(
        'game:charlie',
        'core:movement'
      );

      expect(aliceMovement?.locked).toBe(false);
      expect(bobMovement?.locked).toBe(false);
      expect(charlieMovement?.locked).toBe(false);
    });

    it('should handle no other lying actors gracefully', async () => {
      // Remove Bob and Charlie's lying components
      entityManager.removeComponent('game:bob', 'positioning:lying_down');
      entityManager.removeComponent('game:charlie', 'positioning:lying_down');

      // Alice is now alone
      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Should complete without error
      expect(logger.info).toHaveBeenCalledWith(
        'RemoveLyingClosenessHandler: No formerly lying actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });
  });

  describe('Mixed Relationship Handling', () => {
    it('should preserve manual relationships while removing lying-based ones', async () => {
      // Add David as a manual partner to Alice (not lying on same furniture)
      entityManager.addComponent('game:alice', 'positioning:closeness', {
        partners: ['game:bob', 'game:charlie', 'game:david'], // Bob/Charlie from lying, David manual
      });
      entityManager.addComponent('game:david', 'positioning:closeness', {
        partners: ['game:alice'],
      });

      // Remove Alice's lying component
      entityManager.removeComponent('game:alice', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Alice should keep David but lose Bob and Charlie
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'positioning:closeness'
      );
      expect(aliceCloseness?.partners).toEqual(['game:david']);

      // David should keep Alice
      const davidCloseness = entityManager.getComponentData(
        'game:david',
        'positioning:closeness'
      );
      expect(davidCloseness?.partners).toEqual(['game:alice']);

      // Bob should lose Alice but keep Charlie
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'positioning:closeness'
      );
      expect(bobCloseness?.partners).toEqual(['game:charlie']);

      // Charlie should lose Alice but keep Bob
      const charlieCloseness = entityManager.getComponentData(
        'game:charlie',
        'positioning:closeness'
      );
      expect(charlieCloseness?.partners).toEqual(['game:bob']);
    });

    it('should handle complex multi-actor closeness chains', async () => {
      // Complex setup: Alice-Bob-Charlie lying + Alice-David manual
      entityManager.addComponent('game:alice', 'positioning:closeness', {
        partners: ['game:bob', 'game:charlie', 'game:david'],
      });
      entityManager.addComponent('game:david', 'positioning:closeness', {
        partners: ['game:alice'],
      });

      // Remove Bob's lying component
      entityManager.removeComponent('game:bob', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:bob',
      };

      await handler.execute(parameters, executionContext);

      // Bob loses both Alice and Charlie (was lying with both)
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'positioning:closeness'
      );
      expect(bobCloseness).toBeNull();

      // Alice loses Bob but keeps Charlie and David
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'positioning:closeness'
      );
      expect(aliceCloseness?.partners).toContain('game:charlie');
      expect(aliceCloseness?.partners).toContain('game:david');
      expect(aliceCloseness?.partners).not.toContain('game:bob');

      // Charlie loses Bob but keeps Alice
      const charlieCloseness = entityManager.getComponentData(
        'game:charlie',
        'positioning:closeness'
      );
      expect(charlieCloseness?.partners).toEqual(['game:alice']);

      // David unaffected
      const davidCloseness = entityManager.getComponentData(
        'game:david',
        'positioning:closeness'
      );
      expect(davidCloseness?.partners).toEqual(['game:alice']);
    });
  });

  describe('Different Furniture Scenarios', () => {
    it('should only affect actors lying on the same furniture', async () => {
      // Create second bed with David lying on it
      entityManager.createEntity('furniture:test_bed2');
      entityManager.addComponent(
        'furniture:test_bed2',
        'lying:allows_lying_on',
        {}
      );
      entityManager.addComponent('game:david', 'positioning:lying_down', {
        furniture_id: 'furniture:test_bed2',
      });

      // Add David to Alice's partners (manual relationship, not furniture-based)
      entityManager.addComponent('game:alice', 'positioning:closeness', {
        partners: ['game:bob', 'game:charlie', 'game:david'],
      });
      entityManager.addComponent('game:david', 'positioning:closeness', {
        partners: ['game:alice'],
      });

      // Remove Alice's lying component from bed1
      entityManager.removeComponent('game:alice', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Alice should lose Bob and Charlie (from same furniture) but keep David (different furniture)
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'positioning:closeness'
      );
      expect(aliceCloseness?.partners).toEqual(['game:david']);

      // David should keep Alice (manual relationship)
      const davidCloseness = entityManager.getComponentData(
        'game:david',
        'positioning:closeness'
      );
      expect(davidCloseness?.partners).toEqual(['game:alice']);
    });

    it('should handle two actors lying together', async () => {
      // Setup: Only Alice and Bob lying together
      entityManager.removeComponent('game:charlie', 'positioning:lying_down');
      entityManager.addComponent('game:alice', 'positioning:closeness', {
        partners: ['game:bob'],
      });
      entityManager.addComponent('game:bob', 'positioning:closeness', {
        partners: ['game:alice'],
      });

      // Remove Alice's lying component
      entityManager.removeComponent('game:alice', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Both should lose all closeness
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'positioning:closeness'
      );
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'positioning:closeness'
      );

      expect(aliceCloseness).toBeNull();
      expect(bobCloseness).toBeNull();

      // Both should have movement unlocked
      const aliceMovement = entityManager.getComponentData(
        'game:alice',
        'core:movement'
      );
      const bobMovement = entityManager.getComponentData(
        'game:bob',
        'core:movement'
      );

      expect(aliceMovement?.locked).toBe(false);
      expect(bobMovement?.locked).toBe(false);
    });
  });

  describe('Result Variable Handling', () => {
    it('should store result variable when requested', async () => {
      entityManager.removeComponent('game:alice', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
        result_variable: 'closeness_removed',
      };

      await handler.execute(parameters, executionContext);

      // Verify result variable is set
      expect(executionContext.evaluationContext.context.closeness_removed).toBe(
        true
      );
    });

    it('should store false result on error', async () => {
      const parameters = {
        furniture_id: '', // Invalid parameter
        actor_id: 'game:alice',
        result_variable: 'closeness_removed',
      };

      await handler.execute(parameters, executionContext);

      // Verify result variable is set to false
      expect(executionContext.evaluationContext.context.closeness_removed).toBe(
        false
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle actor with no closeness component', async () => {
      // Remove Alice's closeness component
      entityManager.removeComponent('game:alice', 'positioning:closeness');
      entityManager.removeComponent('game:alice', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Should complete without error
      expect(logger.info).toHaveBeenCalledWith(
        'RemoveLyingClosenessHandler: No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should handle missing furniture component', async () => {
      const parameters = {
        furniture_id: 'furniture:nonexistent',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Should log error
      expect(logger.error).toHaveBeenCalledWith(
        'RemoveLyingClosenessHandler: Failed to remove lying closeness',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should handle empty partners array', async () => {
      entityManager.addComponent('game:alice', 'positioning:closeness', {
        partners: [],
      });
      entityManager.removeComponent('game:alice', 'positioning:lying_down');

      const parameters = {
        furniture_id: 'furniture:test_bed',
        actor_id: 'game:alice',
      };

      await handler.execute(parameters, executionContext);

      // Should complete without error
      expect(logger.info).toHaveBeenCalledWith(
        'RemoveLyingClosenessHandler: No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });
  });
});
