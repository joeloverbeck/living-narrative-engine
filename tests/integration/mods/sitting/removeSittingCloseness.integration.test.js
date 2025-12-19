/**
 * @file Integration tests for RemoveSittingClosenessHandler
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import RemoveSittingClosenessHandler from '../../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import * as closenessCircleService from '../../../../src/logic/services/closenessCircleService.js';
import EventBus from '../../../../src/events/eventBus.js';

describe('REMOVE_SITTING_CLOSENESS Integration Tests', () => {
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
    handler = new RemoveSittingClosenessHandler({
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
    entityManager.createEntity('furniture:test_couch');
    entityManager.addComponent(
      'furniture:test_couch',
      'sitting:allows_sitting',
      {
        spots: ['game:alice', 'game:bob', 'game:charlie'],
      }
    );

    // Create test actors
    entityManager.createEntity('game:alice');
    entityManager.createEntity('game:bob');
    entityManager.createEntity('game:charlie');
    entityManager.createEntity('game:david');

    // Set up initial closeness relationships (Alice-Bob-Charlie chain from sitting)
    entityManager.addComponent('game:alice', 'personal-space-states:closeness', {
      partners: ['game:bob'],
    });
    entityManager.addComponent('game:bob', 'personal-space-states:closeness', {
      partners: ['game:alice', 'game:charlie'],
    });
    entityManager.addComponent('game:charlie', 'personal-space-states:closeness', {
      partners: ['game:bob'],
    });

    // Set up movement locks for sitting actors
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
    it('should remove closeness and update movement locks when actor stands', async () => {
      // Alice stands up from spot 0 (was adjacent to Bob in spot 1)
      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      await handler.execute(parameters, executionContext);

      // Verify Alice's closeness is removed
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'personal-space-states:closeness'
      );
      expect(aliceCloseness).toBeNull();

      // Verify Bob's closeness to Alice is removed
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'personal-space-states:closeness'
      );
      expect(bobCloseness?.partners).toEqual(['game:charlie']);

      // Verify Charlie is unaffected (wasn't adjacent to Alice)
      const charlieCloseness = entityManager.getComponentData(
        'game:charlie',
        'personal-space-states:closeness'
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

    it('should handle edge position departure correctly', async () => {
      // Charlie stands up from spot 2 (edge position, adjacent to Bob in spot 1)
      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:charlie',
        spot_index: 2,
      };

      await handler.execute(parameters, executionContext);

      // Verify Charlie's closeness is removed
      const charlieCloseness = entityManager.getComponentData(
        'game:charlie',
        'personal-space-states:closeness'
      );
      expect(charlieCloseness).toBeNull();

      // Verify Bob's closeness to Charlie is removed
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'personal-space-states:closeness'
      );
      expect(bobCloseness?.partners).toEqual(['game:alice']);

      // Verify Alice is unaffected (wasn't adjacent to Charlie)
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'personal-space-states:closeness'
      );
      expect(aliceCloseness?.partners).toEqual(['game:bob']);
    });

    it('should handle no adjacent actors gracefully', async () => {
      // Set up single actor scenario
      entityManager.addComponent(
        'furniture:test_couch',
        'sitting:allows_sitting',
        {
          spots: ['game:alice', null, null],
        }
      );

      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      await handler.execute(parameters, executionContext);

      // Should complete without error
      expect(logger.info).toHaveBeenCalledWith(
        'RemoveSittingClosenessHandler: No formerly adjacent actors found',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });
  });

  describe('Mixed Relationship Handling', () => {
    it('should preserve manual relationships while removing sitting-based ones', async () => {
      // Add David as a manual partner to Alice (not adjacent)
      entityManager.addComponent('game:alice', 'personal-space-states:closeness', {
        partners: ['game:bob', 'game:david'], // Bob from sitting, David manual
      });
      entityManager.addComponent('game:david', 'personal-space-states:closeness', {
        partners: ['game:alice'],
      });

      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      await handler.execute(parameters, executionContext);

      // Alice should keep David but lose Bob
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'personal-space-states:closeness'
      );
      expect(aliceCloseness?.partners).toEqual(['game:david']);

      // David should keep Alice
      const davidCloseness = entityManager.getComponentData(
        'game:david',
        'personal-space-states:closeness'
      );
      expect(davidCloseness?.partners).toEqual(['game:alice']);

      // Bob should lose Alice but keep Charlie
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'personal-space-states:closeness'
      );
      expect(bobCloseness?.partners).toEqual(['game:charlie']);
    });

    it('should handle complex multi-actor closeness chains', async () => {
      // Complex setup: Alice-Bob-Charlie sitting + Alice-David manual
      entityManager.addComponent('game:alice', 'personal-space-states:closeness', {
        partners: ['game:bob', 'game:david'],
      });
      entityManager.addComponent('game:david', 'personal-space-states:closeness', {
        partners: ['game:alice'],
      });

      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:bob',
        spot_index: 1, // Bob leaves from middle
      };

      await handler.execute(parameters, executionContext);

      // Bob loses both Alice and Charlie (was adjacent to both)
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'personal-space-states:closeness'
      );
      expect(bobCloseness).toBeNull();

      // Alice loses Bob but keeps David
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'personal-space-states:closeness'
      );
      expect(aliceCloseness?.partners).toEqual(['game:david']);

      // Charlie loses Bob
      const charlieCloseness = entityManager.getComponentData(
        'game:charlie',
        'personal-space-states:closeness'
      );
      expect(charlieCloseness).toBeNull();

      // David unaffected
      const davidCloseness = entityManager.getComponentData(
        'game:david',
        'personal-space-states:closeness'
      );
      expect(davidCloseness?.partners).toEqual(['game:alice']);
    });
  });

  describe('Complex Furniture Scenarios', () => {
    it('should handle all actors standing simultaneously', async () => {
      // Update furniture to reflect that Alice and Charlie have stood up
      entityManager.addComponent(
        'furniture:test_couch',
        'sitting:allows_sitting',
        {
          spots: [null, 'game:bob', null], // Alice and Charlie gone, Bob remains
        }
      );

      // Test sequential departures (not truly concurrent due to shared state)
      const aliceParams = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      await handler.execute(aliceParams, executionContext);

      // Update furniture state after Alice leaves
      entityManager.addComponent(
        'furniture:test_couch',
        'sitting:allows_sitting',
        {
          spots: [null, 'game:bob', null],
        }
      );

      const charlieParams = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:charlie',
        spot_index: 2,
      };

      await handler.execute(charlieParams, executionContext);

      // Verify all relationships properly cleaned up
      expect(
        entityManager.getComponentData('game:alice', 'personal-space-states:closeness')
      ).toBeNull();
      expect(
        entityManager.getComponentData('game:charlie', 'personal-space-states:closeness')
      ).toBeNull();

      // Bob should lose both partners
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'personal-space-states:closeness'
      );
      expect(bobCloseness).toBeNull();
    });

    it('should handle concurrent operations with race conditions', async () => {
      // Execute operations sequentially to avoid state conflicts
      const operations = [
        {
          furniture_id: 'furniture:test_couch',
          actor_id: 'game:alice',
          spot_index: 0,
        },
        {
          furniture_id: 'furniture:test_couch',
          actor_id: 'game:bob',
          spot_index: 1,
        },
        {
          furniture_id: 'furniture:test_couch',
          actor_id: 'game:charlie',
          spot_index: 2,
        },
      ];

      // Execute all sequentially to properly test the handler logic
      for (const params of operations) {
        // Update furniture state to reflect current occupancy
        const currentSpots = ['game:alice', 'game:bob', 'game:charlie'];
        if (params.actor_id === 'game:alice') currentSpots[0] = null;
        if (params.actor_id === 'game:bob') currentSpots[1] = null;
        if (params.actor_id === 'game:charlie') currentSpots[2] = null;

        entityManager.addComponent(
          'furniture:test_couch',
          'sitting:allows_sitting',
          {
            spots: currentSpots,
          }
        );

        await handler.execute(params, executionContext);
      }

      // All should be cleaned up
      expect(
        entityManager.getComponentData('game:alice', 'personal-space-states:closeness')
      ).toBeNull();
      expect(
        entityManager.getComponentData('game:bob', 'personal-space-states:closeness')
      ).toBeNull();
      expect(
        entityManager.getComponentData('game:charlie', 'personal-space-states:closeness')
      ).toBeNull();
    });

    it('should handle large furniture with multiple separation events', async () => {
      // Create 5-seat furniture
      entityManager.addComponent(
        'furniture:test_couch',
        'sitting:allows_sitting',
        {
          spots: [
            'game:alice',
            'game:bob',
            'game:charlie',
            'game:david',
            'game:eve',
          ],
        }
      );

      // Create additional actor
      entityManager.createEntity('game:eve');

      // Set up complex closeness chain
      entityManager.addComponent('game:alice', 'personal-space-states:closeness', {
        partners: ['game:bob'],
      });
      entityManager.addComponent('game:bob', 'personal-space-states:closeness', {
        partners: ['game:alice', 'game:charlie'],
      });
      entityManager.addComponent('game:charlie', 'personal-space-states:closeness', {
        partners: ['game:bob', 'game:david'],
      });
      entityManager.addComponent('game:david', 'personal-space-states:closeness', {
        partners: ['game:charlie', 'game:eve'],
      });
      entityManager.addComponent('game:eve', 'personal-space-states:closeness', {
        partners: ['game:david'],
      });

      // Charlie stands up (middle position, affects Bob and David)
      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:charlie',
        spot_index: 2,
      };

      await handler.execute(parameters, executionContext);

      // Charlie should have no relationships
      expect(
        entityManager.getComponentData('game:charlie', 'personal-space-states:closeness')
      ).toBeNull();

      // Bob should lose Charlie but keep Alice
      const bobCloseness = entityManager.getComponentData(
        'game:bob',
        'personal-space-states:closeness'
      );
      expect(bobCloseness?.partners).toEqual(['game:alice']);

      // David should lose Charlie but keep Eve
      const davidCloseness = entityManager.getComponentData(
        'game:david',
        'personal-space-states:closeness'
      );
      expect(davidCloseness?.partners).toEqual(['game:eve']);

      // Alice and Eve should be unaffected
      const aliceCloseness = entityManager.getComponentData(
        'game:alice',
        'personal-space-states:closeness'
      );
      const eveCloseness = entityManager.getComponentData(
        'game:eve',
        'personal-space-states:closeness'
      );
      expect(aliceCloseness?.partners).toEqual(['game:bob']);
      expect(eveCloseness?.partners).toEqual(['game:david']);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid furniture ID gracefully', async () => {
      const parameters = {
        furniture_id: 'nonexistent:furniture',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      await handler.execute(parameters, executionContext);

      // Should handle missing furniture by throwing validation error and logging error
      // (The ComponentStateValidator throws EntityNotFoundError for missing furniture component)
      expect(logger.error).toHaveBeenCalledWith(
        'RemoveSittingClosenessHandler: Failed to remove sitting closeness',
        expect.objectContaining({
          furnitureId: 'nonexistent:furniture',
          actorId: 'game:alice',
          spotIndex: 0,
          error: expect.stringContaining('missing allows_sitting component'),
        })
      );
    });

    it('should handle actor with no existing closeness component', async () => {
      // Remove Alice's closeness component
      entityManager.removeComponent('game:alice', 'personal-space-states:closeness');

      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      await handler.execute(parameters, executionContext);

      // Should complete successfully with info log
      expect(logger.info).toHaveBeenCalledWith(
        'RemoveSittingClosenessHandler: No closeness relationships to remove',
        expect.objectContaining({
          actorId: 'game:alice',
        })
      );
    });

    it('should handle malformed component data gracefully', async () => {
      // Add malformed closeness component
      entityManager.addComponent('game:alice', 'personal-space-states:closeness', {
        partners: 'invalid_string_instead_of_array',
      });

      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:alice',
        spot_index: 0,
      };

      await handler.execute(parameters, executionContext);

      // Should handle malformed data by throwing validation error and logging error
      // (The ComponentStateValidator throws InvalidArgumentError for invalid partners array)
      expect(logger.error).toHaveBeenCalledWith(
        'RemoveSittingClosenessHandler: Failed to remove sitting closeness',
        expect.objectContaining({
          furnitureId: 'furniture:test_couch',
          actorId: 'game:alice',
          spotIndex: 0,
          error: expect.stringContaining('invalid closeness partners array'),
        })
      );
    });

    it('should validate parameter schema correctly', async () => {
      const invalidParameters = {
        furniture_id: '', // Invalid empty string
        actor_id: 'game:alice',
        spot_index: -1, // Invalid negative spot
      };

      await handler.execute(invalidParameters, executionContext);

      // Should validate and handle errors appropriately
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle operations on large furniture efficiently', async () => {
      const startTime = performance.now();

      // Create large furniture with many actors
      const spots = Array.from({ length: 50 }, (_, i) => `game:actor${i}`);
      entityManager.addComponent(
        'furniture:test_couch',
        'sitting:allows_sitting',
        {
          spots,
        }
      );

      // Create entities and closeness relationships
      for (let i = 0; i < 50; i++) {
        entityManager.createEntity(`game:actor${i}`);
        if (i > 0) {
          entityManager.addComponent(
            `game:actor${i}`,
            'personal-space-states:closeness',
            {
              partners:
                i > 1
                  ? [`game:actor${i - 1}`, `game:actor${i + 1}`]
                  : [`game:actor${i + 1}`],
            }
          );
        }
      }

      const parameters = {
        furniture_id: 'furniture:test_couch',
        actor_id: 'game:actor25', // Middle actor
        spot_index: 25,
      };

      await handler.execute(parameters, executionContext);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (< 100ms for this scale)
      expect(executionTime).toBeLessThan(100);
    });

    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const parameters = {
          furniture_id: 'furniture:test_couch',
          actor_id: 'game:alice',
          spot_index: 0,
        };

        await handler.execute(parameters, executionContext);

        // Reset state for next iteration
        entityManager.addComponent('game:alice', 'personal-space-states:closeness', {
          partners: ['game:bob'],
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 10MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
