/**
 * @file Integration tests for furniture capacity edge cases and proximity boundaries
 * Tests edge cases with furniture capacity limits, single-spot scenarios, and performance
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
import EventBus from '../../../src/events/eventBus.js';

describe('Furniture Capacity and Proximity Edge Cases', () => {
  let handler;
  let entityManager;
  let eventBus;
  let logger;
  let executionContext;

  beforeEach(() => {
    // Create mock logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create real services
    entityManager = new SimpleEntityManager();
    eventBus = new EventBus({ logger });

    // Create handler
    handler = new EstablishSittingClosenessHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
      closenessCircleService,
    });

    // Create execution context
    executionContext = {
      evaluationContext: {
        context: {},
      },
    };
  });

  afterEach(() => {
    entityManager = null;
    handler = null;
  });

  describe('Single-Spot Furniture', () => {
    it('should handle single-spot furniture with no adjacency possible', async () => {
      const furnitureId = 'test:chair';
      const aliceId = 'test:alice_single';

      // Create single-spot furniture
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null], // Only one spot
          },
        },
      });

      const aliceEntity = createEntityInstance({
        instanceId: aliceId,
        baseComponents: {
          'core:actor': {},
        },
      });

      entityManager.addEntity(furnitureEntity);
      entityManager.addEntity(aliceEntity);

      // Alice sits on single-spot furniture
      await entityManager.addComponent(
        furnitureId,
        'sitting:allows_sitting',
        {
          spots: [aliceId],
        }
      );

      await entityManager.addComponent(aliceId, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 0,
      });

      // Try to establish closeness
      await handler.execute(
        {
          furniture_id: furnitureId,
          actor_id: aliceId,
          spot_index: 0,
          result_variable: 'closenessEstablished',
        },
        executionContext
      );

      // Verify no closeness established (no adjacent spots possible)
      const aliceCloseness = entityManager.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      expect(aliceCloseness).toBeNull();

      // Result should be true since the operation succeeded (no adjacent actors is a valid scenario)
      expect(
        executionContext.evaluationContext.context.closenessEstablished
      ).toBe(true);
    });

    it('should handle multiple single-spot furniture items', async () => {
      const chair1Id = 'test:chair1';
      const chair2Id = 'test:chair2';
      const aliceId = 'test:alice_multi_single';
      const bobId = 'test:bob_multi_single';

      // Create two single-spot furniture items
      const chair1Entity = createEntityInstance({
        instanceId: chair1Id,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [aliceId],
          },
        },
      });

      const chair2Entity = createEntityInstance({
        instanceId: chair2Id,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [bobId],
          },
        },
      });

      const aliceEntity = createEntityInstance({
        instanceId: aliceId,
        baseComponents: {
          'core:actor': {},
          'sitting-states:sitting_on': {
            furniture_id: chair1Id,
            spot_index: 0,
          },
        },
      });

      const bobEntity = createEntityInstance({
        instanceId: bobId,
        baseComponents: {
          'core:actor': {},
          'sitting-states:sitting_on': {
            furniture_id: chair2Id,
            spot_index: 0,
          },
        },
      });

      entityManager.addEntity(chair1Entity);
      entityManager.addEntity(chair2Entity);
      entityManager.addEntity(aliceEntity);
      entityManager.addEntity(bobEntity);

      // Try to establish closeness for both
      await handler.execute(
        {
          furniture_id: chair1Id,
          actor_id: aliceId,
          spot_index: 0,
          result_variable: 'aliceCloseness',
        },
        executionContext
      );

      await handler.execute(
        {
          furniture_id: chair2Id,
          actor_id: bobId,
          spot_index: 0,
          result_variable: 'bobCloseness',
        },
        executionContext
      );

      // Verify neither has closeness (sitting on different furniture)
      const aliceCloseness = entityManager.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobCloseness = entityManager.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness).toBeNull();
      expect(bobCloseness).toBeNull();
      // Result should be true since the operations succeeded (no adjacent actors is valid)
      expect(executionContext.evaluationContext.context.aliceCloseness).toBe(
        true
      );
      expect(executionContext.evaluationContext.context.bobCloseness).toBe(
        true
      );
    });
  });

  describe('Full Furniture Scenarios', () => {
    it('should handle fully occupied furniture gracefully', async () => {
      const furnitureId = 'test:small_couch';
      const aliceId = 'test:alice_full';
      const bobId = 'test:bob_full';
      const charlieId = 'test:charlie_full';

      // Create furniture that's already full
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [aliceId, bobId], // Fully occupied 2-seat couch
          },
        },
      });

      const aliceEntity = createEntityInstance({
        instanceId: aliceId,
        baseComponents: {
          'core:actor': {},
          'sitting-states:sitting_on': {
            furniture_id: furnitureId,
            spot_index: 0,
          },
          'personal-space-states:closeness': {
            partners: [bobId],
          },
        },
      });

      const bobEntity = createEntityInstance({
        instanceId: bobId,
        baseComponents: {
          'core:actor': {},
          'sitting-states:sitting_on': {
            furniture_id: furnitureId,
            spot_index: 1,
          },
          'personal-space-states:closeness': {
            partners: [aliceId],
          },
        },
      });

      const charlieEntity = createEntityInstance({
        instanceId: charlieId,
        baseComponents: {
          'core:actor': {},
        },
      });

      entityManager.addEntity(furnitureEntity);
      entityManager.addEntity(aliceEntity);
      entityManager.addEntity(bobEntity);
      entityManager.addEntity(charlieEntity);

      // Verify Charlie cannot sit (no available spots)
      const furniture = entityManager.getComponent(
        furnitureId,
        'sitting:allows_sitting'
      );
      const availableSpot = furniture.spots.findIndex((spot) => spot === null);
      expect(availableSpot).toBe(-1);

      // Verify Charlie is not sitting
      const charlieSitting = entityManager.getComponent(
        charlieId,
        'sitting-states:sitting_on'
      );
      expect(charlieSitting).toBeNull();

      // Verify existing relationships unchanged
      const aliceCloseness = entityManager.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobCloseness = entityManager.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness.partners).toEqual([bobId]);
      expect(bobCloseness.partners).toEqual([aliceId]);
    });

    it('should handle partially filled furniture with gaps', async () => {
      const furnitureId = 'test:gapped_bench';
      const aliceId = 'test:alice_gap';
      const bobId = 'test:bob_gap';
      const charlieId = 'test:charlie_gap';

      // Create furniture with actors in non-adjacent spots
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [aliceId, null, charlieId, null, null], // Gap between Alice and Charlie
          },
        },
      });

      const aliceEntity = createEntityInstance({
        instanceId: aliceId,
        baseComponents: {
          'core:actor': {},
          'sitting-states:sitting_on': {
            furniture_id: furnitureId,
            spot_index: 0,
          },
        },
      });

      const charlieEntity = createEntityInstance({
        instanceId: charlieId,
        baseComponents: {
          'core:actor': {},
          'sitting-states:sitting_on': {
            furniture_id: furnitureId,
            spot_index: 2,
          },
        },
      });

      const bobEntity = createEntityInstance({
        instanceId: bobId,
        baseComponents: {
          'core:actor': {},
        },
      });

      entityManager.addEntity(furnitureEntity);
      entityManager.addEntity(aliceEntity);
      entityManager.addEntity(charlieEntity);
      entityManager.addEntity(bobEntity);

      // Initially, Alice and Charlie should not be close (gap between them)
      expect(
        entityManager.getComponent(aliceId, 'personal-space-states:closeness')
      ).toBeNull();
      expect(
        entityManager.getComponent(charlieId, 'personal-space-states:closeness')
      ).toBeNull();

      // Bob sits in the gap (spot 1)
      await entityManager.addComponent(
        furnitureId,
        'sitting:allows_sitting',
        {
          spots: [aliceId, bobId, charlieId, null, null],
        }
      );

      await entityManager.addComponent(bobId, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      });

      // Establish closeness for Bob
      await handler.execute(
        {
          furniture_id: furnitureId,
          actor_id: bobId,
          spot_index: 1,
          result_variable: 'closenessEstablished',
        },
        executionContext
      );

      // Now Bob should bridge Alice and Charlie
      const aliceCloseness = entityManager.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobCloseness = entityManager.getComponent(
        bobId,
        'personal-space-states:closeness'
      );
      const charlieCloseness = entityManager.getComponent(
        charlieId,
        'personal-space-states:closeness'
      );

      expect(bobCloseness.partners).toContain(aliceId);
      expect(bobCloseness.partners).toContain(charlieId);
      expect(aliceCloseness.partners).toEqual([bobId]);
      expect(charlieCloseness.partners).toEqual([bobId]);
    });
  });

  describe('Dynamic Furniture Configuration', () => {
    it('should handle furniture with dynamically changing capacity', async () => {
      const furnitureId = 'test:modular_couch';
      const actors = [
        'test:actor_dyn_1',
        'test:actor_dyn_2',
        'test:actor_dyn_3',
      ];

      // Start with 2-seat couch
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null],
          },
        },
      });
      entityManager.addEntity(furnitureEntity);

      // Create actors
      for (const actorId of actors) {
        const actorEntity = createEntityInstance({
          instanceId: actorId,
          baseComponents: {
            'core:actor': {},
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // First two actors sit
      for (let i = 0; i < 2; i++) {
        await entityManager.addComponent(actors[i], 'sitting-states:sitting_on', {
          furniture_id: furnitureId,
          spot_index: i,
        });
      }

      await entityManager.addComponent(
        furnitureId,
        'sitting:allows_sitting',
        {
          spots: [actors[0], actors[1]],
        }
      );

      // Establish closeness
      await handler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[1],
          spot_index: 1,
          result_variable: 'closenessEstablished',
        },
        executionContext
      );

      // Verify initial closeness
      let actor1Closeness = entityManager.getComponent(
        actors[0],
        'personal-space-states:closeness'
      );
      let actor2Closeness = entityManager.getComponent(
        actors[1],
        'personal-space-states:closeness'
      );

      expect(actor1Closeness.partners).toEqual([actors[1]]);
      expect(actor2Closeness.partners).toEqual([actors[0]]);

      // Simulate furniture expansion (add more spots)
      await entityManager.addComponent(
        furnitureId,
        'sitting:allows_sitting',
        {
          spots: [actors[0], actors[1], null], // Added third spot
        }
      );

      // Third actor sits
      await entityManager.addComponent(actors[2], 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 2,
      });

      await entityManager.addComponent(
        furnitureId,
        'sitting:allows_sitting',
        {
          spots: [actors[0], actors[1], actors[2]],
        }
      );

      // Establish closeness for third actor
      await handler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[2],
          spot_index: 2,
          result_variable: 'thirdActorCloseness',
        },
        executionContext
      );

      // Verify updated closeness relationships
      actor1Closeness = entityManager.getComponent(
        actors[0],
        'personal-space-states:closeness'
      );
      actor2Closeness = entityManager.getComponent(
        actors[1],
        'personal-space-states:closeness'
      );
      const actor3Closeness = entityManager.getComponent(
        actors[2],
        'personal-space-states:closeness'
      );

      expect(actor1Closeness.partners).toEqual([actors[1]]);
      expect(actor2Closeness.partners).toContain(actors[0]);
      expect(actor2Closeness.partners).toContain(actors[2]);
      expect(actor3Closeness.partners).toEqual([actors[1]]);
    });

    it('should handle furniture with null spots in various positions', async () => {
      const furnitureId = 'test:sparse_bench';

      // Test various null spot configurations
      const configurations = [
        { spots: [null, null, null], expectedCloseness: [] },
        { spots: ['test:a', null, null], expectedCloseness: [] },
        { spots: [null, 'test:b', null], expectedCloseness: [] },
        { spots: [null, null, 'test:c'], expectedCloseness: [] },
        {
          spots: ['test:a', 'test:b', null],
          expectedCloseness: [['test:a', 'test:b']],
        },
        {
          spots: [null, 'test:b', 'test:c'],
          expectedCloseness: [['test:b', 'test:c']],
        },
        { spots: ['test:a', null, 'test:c'], expectedCloseness: [] },
        {
          spots: ['test:a', 'test:b', 'test:c'],
          expectedCloseness: [
            ['test:a', 'test:b'],
            ['test:b', 'test:c'],
          ],
        },
      ];

      for (const config of configurations) {
        // Reset entity manager for each configuration
        entityManager = new SimpleEntityManager();

        // Recreate handler with new entity manager
        handler = new EstablishSittingClosenessHandler({
          logger,
          entityManager,
          safeEventDispatcher: eventBus,
          closenessCircleService,
        });

        // Create furniture with configuration
        const furnitureEntity = createEntityInstance({
          instanceId: furnitureId,
          baseComponents: {
            'sitting:allows_sitting': {
              spots: config.spots,
            },
          },
        });
        entityManager.addEntity(furnitureEntity);

        // Create actors for non-null spots
        const actors = config.spots.filter((spot) => spot !== null);
        for (let i = 0; i < actors.length; i++) {
          const actorId = actors[i];
          const spotIndex = config.spots.indexOf(actorId);

          const actorEntity = createEntityInstance({
            instanceId: actorId,
            baseComponents: {
              'core:actor': {},
              'sitting-states:sitting_on': {
                furniture_id: furnitureId,
                spot_index: spotIndex,
              },
            },
          });
          entityManager.addEntity(actorEntity);

          // Establish closeness for this actor
          await handler.execute(
            {
              furniture_id: furnitureId,
              actor_id: actorId,
              spot_index: spotIndex,
              result_variable: 'closenessResult',
            },
            executionContext
          );
        }

        // Verify expected closeness relationships
        for (const actorId of actors) {
          const closeness = entityManager.getComponent(
            actorId,
            'personal-space-states:closeness'
          );
          const expectedPartners = config.expectedCloseness
            .filter((pair) => pair.includes(actorId))
            .flatMap((pair) => pair.filter((id) => id !== actorId));

          if (expectedPartners.length > 0) {
            expect(closeness?.partners || []).toEqual(
              expect.arrayContaining(expectedPartners)
            );
          } else {
            expect(closeness).toBeNull();
          }
        }
      }
    });
  });
});
