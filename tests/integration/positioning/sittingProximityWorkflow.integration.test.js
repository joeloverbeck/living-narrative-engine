/**
 * @file Integration tests for sitting proximity workflows
 * Tests complete workflows from user actions through rule execution to final component states
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
import RemoveSittingClosenessHandler from '../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
import EventBus from '../../../src/events/eventBus.js';

describe('Sitting Proximity Workflow Integration', () => {
  describe('Using SimpleEntityManager for focused handler testing', () => {
    let handler;
    let removeHandler;
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

      // Create handlers
      handler = new EstablishSittingClosenessHandler({
        logger,
        entityManager,
        safeEventDispatcher: eventBus,
        closenessCircleService,
      });

      removeHandler = new RemoveSittingClosenessHandler({
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
      removeHandler = null;
    });

    it('should remove closeness when Alice stands up from adjacent position', async () => {
      // Setup: Alice and Bob sitting adjacent with established closeness
      const furnitureId = 'test:couch_standup';
      const aliceId = 'test:alice_standup';
      const bobId = 'test:bob_standup';

      // Create entities with initial state
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [aliceId, bobId, null],
          },
        },
      });

      const aliceEntity = createEntityInstance({
        instanceId: aliceId,
        baseComponents: {
          'core:actor': {},
          'positioning:sitting_on': {
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
          'positioning:sitting_on': {
            furniture_id: furnitureId,
            spot_index: 1,
          },
          'personal-space-states:closeness': {
            partners: [aliceId],
          },
        },
      });

      // Add entities to manager
      entityManager.addEntity(furnitureEntity);
      entityManager.addEntity(aliceEntity);
      entityManager.addEntity(bobEntity);

      // Action: Alice stands up using remove handler
      await removeHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: aliceId,
          spot_index: 0,
          result_variable: 'closenessRemoved',
        },
        executionContext
      );

      // Verify closeness removed from both actors
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
      expect(executionContext.evaluationContext.context.closenessRemoved).toBe(
        true
      );
    });

    it('should handle complex standing sequence with multiple relationships', async () => {
      // Setup: Alice-Bob-Charlie-Diana all sitting in a row
      const furnitureId = 'test:long_bench';

      const actors = [
        { id: 'test:alice_chain', spot: 0, partners: ['test:bob_chain'] },
        {
          id: 'test:bob_chain',
          spot: 1,
          partners: ['test:alice_chain', 'test:charlie_chain'],
        },
        {
          id: 'test:charlie_chain',
          spot: 2,
          partners: ['test:bob_chain', 'test:diana_chain'],
        },
        { id: 'test:diana_chain', spot: 3, partners: ['test:charlie_chain'] },
      ];

      // Create furniture with all actors
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [
              'test:alice_chain',
              'test:bob_chain',
              'test:charlie_chain',
              'test:diana_chain',
              null,
            ],
          },
        },
      });
      entityManager.addEntity(furnitureEntity);

      // Create all actors with initial closeness relationships
      for (const actor of actors) {
        const actorEntity = createEntityInstance({
          instanceId: actor.id,
          baseComponents: {
            'core:actor': {},
            'positioning:sitting_on': {
              furniture_id: furnitureId,
              spot_index: actor.spot,
            },
            'personal-space-states:closeness': {
              partners: actor.partners,
            },
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // Action: Bob stands up (affects Alice and Charlie)
      // First update furniture to remove Bob
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [
          'test:alice_chain',
          null,
          'test:charlie_chain',
          'test:diana_chain',
          null,
        ],
      });

      // Remove Bob's sitting component
      entityManager.removeComponent('test:bob_chain', 'positioning:sitting_on');

      // Use handler to remove closeness relationships
      await removeHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: 'test:bob_chain',
          spot_index: 1,
          result_variable: 'closenessRemoved',
        },
        executionContext
      );

      // Verify closeness relationships updated
      const aliceCloseness = entityManager.getComponent(
        'test:alice_chain',
        'personal-space-states:closeness'
      );
      const bobCloseness = entityManager.getComponent(
        'test:bob_chain',
        'personal-space-states:closeness'
      );
      const charlieCloseness = entityManager.getComponent(
        'test:charlie_chain',
        'personal-space-states:closeness'
      );
      const dianaCloseness = entityManager.getComponent(
        'test:diana_chain',
        'personal-space-states:closeness'
      );

      // Alice should no longer be close to Bob
      expect(aliceCloseness).toBeNull();

      // Bob should have no closeness relationships
      expect(bobCloseness).toBeNull();

      // Charlie should no longer be close to Bob, but still close to Diana
      expect(charlieCloseness.partners).toEqual(['test:diana_chain']);

      // Diana should still be close to Charlie
      expect(dianaCloseness.partners).toEqual(['test:charlie_chain']);
    });

    it('should handle wrapping adjacency on circular furniture', async () => {
      // Some furniture might conceptually wrap (like a round table)
      // This tests that we only consider linear adjacency
      const furnitureId = 'test:round_table';
      const actors = [
        'test:actor1',
        'test:actor2',
        'test:actor3',
        'test:actor4',
      ];

      // Create furniture with 4 spots
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null, null, null],
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

      // Simulate actors sitting down one by one
      // First actor sits (no adjacency yet)
      entityManager.addComponent(actors[0], 'positioning:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 0,
      });
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [actors[0], null, null, null],
      });

      // Second actor sits adjacent to first
      entityManager.addComponent(actors[1], 'positioning:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      });
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [actors[0], actors[1], null, null],
      });
      await handler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[1],
          spot_index: 1,
          result_variable: 'closenessEstablished',
        },
        executionContext
      );

      // Third actor sits adjacent to second
      entityManager.addComponent(actors[2], 'positioning:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 2,
      });
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [actors[0], actors[1], actors[2], null],
      });
      await handler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[2],
          spot_index: 2,
          result_variable: 'closenessEstablished',
        },
        executionContext
      );

      // Fourth actor sits adjacent to third
      entityManager.addComponent(actors[3], 'positioning:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 3,
      });
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [actors[0], actors[1], actors[2], actors[3]],
      });
      await handler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[3],
          spot_index: 3,
          result_variable: 'closenessEstablished',
        },
        executionContext
      );

      // Verify adjacency (no wrapping - first and last are NOT adjacent)
      const actor1Closeness = entityManager.getComponent(
        actors[0],
        'personal-space-states:closeness'
      );
      const actor4Closeness = entityManager.getComponent(
        actors[3],
        'personal-space-states:closeness'
      );

      // Actor 1 (spot 0) should only be close to Actor 2 (spot 1)
      expect(actor1Closeness.partners).toEqual([actors[1]]);

      // Actor 4 (spot 3) should only be close to Actor 3 (spot 2)
      expect(actor4Closeness.partners).toEqual([actors[2]]);

      // They should NOT be close to each other (no wrapping)
      expect(actor1Closeness.partners).not.toContain(actors[3]);
      expect(actor4Closeness.partners).not.toContain(actors[0]);
    });
  });
});
