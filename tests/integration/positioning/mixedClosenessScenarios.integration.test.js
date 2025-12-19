/**
 * @file Integration tests for mixed manual and automatic closeness scenarios
 * Tests complex interactions between manual and automatic closeness relationships
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

describe('Mixed Closeness Scenarios Integration', () => {
  let establishHandler;
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
    establishHandler = new EstablishSittingClosenessHandler({
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
    establishHandler = null;
    removeHandler = null;
  });

  describe('Manual and Automatic Closeness Mixing', () => {
    it('should preserve manual closeness when automatic closeness is removed', async () => {
      const furnitureId = 'test:couch_mixed';
      const aliceId = 'test:alice_mixed';
      const bobId = 'test:bob_mixed';
      const charlieId = 'test:charlie_mixed';

      // Create entities
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null, null],
          },
        },
      });

      const aliceEntity = createEntityInstance({
        instanceId: aliceId,
        baseComponents: {
          'core:actor': {},
        },
      });

      const bobEntity = createEntityInstance({
        instanceId: bobId,
        baseComponents: {
          'core:actor': {},
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

      // Phase 1: Alice and Charlie establish manual closeness (get_close action)
      // This simulates the result of a get_close action
      entityManager.addComponent(aliceId, 'personal-space-states:closeness', {
        partners: [charlieId],
      });
      entityManager.addComponent(charlieId, 'personal-space-states:closeness', {
        partners: [aliceId],
      });

      // Verify manual closeness established
      let aliceCloseness = entityManager.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      let charlieCloseness = entityManager.getComponent(
        charlieId,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness.partners).toEqual([charlieId]);
      expect(charlieCloseness.partners).toEqual([aliceId]);

      // Phase 2: Alice and Bob sit adjacent (automatic closeness)
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [aliceId, bobId, null],
      });

      entityManager.addComponent(aliceId, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 0,
      });

      entityManager.addComponent(bobId, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      });

      // Establish automatic closeness
      await establishHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: bobId,
          spot_index: 1,
          result_variable: 'closenessEstablished',
        },
        executionContext
      );

      // Verify Alice now has both manual (Charlie) and automatic (Bob) closeness
      aliceCloseness = entityManager.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      const bobCloseness = entityManager.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness.partners).toContain(charlieId); // Manual
      expect(aliceCloseness.partners).toContain(bobId); // Automatic
      expect(aliceCloseness.partners.length).toBe(2);
      expect(bobCloseness.partners).toEqual([aliceId]);

      // Phase 3: Alice stands up (should remove automatic but preserve manual)
      // Update furniture to remove Alice
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [null, bobId, null],
      });

      // Remove Alice's sitting component
      entityManager.removeComponent(aliceId, 'sitting-states:sitting_on');

      // Use handler to remove automatic closeness
      await removeHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: aliceId,
          spot_index: 0,
          result_variable: 'closenessRemoved',
        },
        executionContext
      );

      // Verify Alice retains manual closeness with Charlie but loses automatic with Bob
      aliceCloseness = entityManager.getComponent(
        aliceId,
        'personal-space-states:closeness'
      );
      charlieCloseness = entityManager.getComponent(
        charlieId,
        'personal-space-states:closeness'
      );
      const bobClosenessAfter = entityManager.getComponent(
        bobId,
        'personal-space-states:closeness'
      );

      expect(aliceCloseness.partners).toEqual([charlieId]); // Only manual remains
      expect(charlieCloseness.partners).toEqual([aliceId]); // Manual preserved
      expect(bobClosenessAfter).toBeNull(); // Automatic removed
    });

    it('should handle complex closeness circles with mixed relationships', async () => {
      // Create a scenario with overlapping closeness circles
      const furnitureId = 'test:circle_bench';
      const actors = {
        alice: 'test:alice_circle',
        bob: 'test:bob_circle',
        charlie: 'test:charlie_circle',
        diana: 'test:diana_circle',
        eve: 'test:eve_circle',
      };

      // Create furniture
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null, null, null, null],
          },
        },
      });
      entityManager.addEntity(furnitureEntity);

      // Create all actors
      for (const [name, id] of Object.entries(actors)) {
        const actorEntity = createEntityInstance({
          instanceId: id,
          baseComponents: {
            'core:actor': {},
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // Phase 1: Create manual closeness circle (Alice-Bob-Charlie)
      entityManager.addComponent(actors.alice, 'personal-space-states:closeness', {
        partners: [actors.bob, actors.charlie],
      });
      entityManager.addComponent(actors.bob, 'personal-space-states:closeness', {
        partners: [actors.alice, actors.charlie],
      });
      entityManager.addComponent(actors.charlie, 'personal-space-states:closeness', {
        partners: [actors.alice, actors.bob],
      });

      // Phase 2: Diana and Eve sit adjacent
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [actors.diana, actors.eve, null, null, null],
      });

      entityManager.addComponent(actors.diana, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 0,
      });

      entityManager.addComponent(actors.eve, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      });

      await establishHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors.eve,
          spot_index: 1,
          result_variable: 'eveCloseness',
        },
        executionContext
      );

      // Phase 3: Charlie sits next to Eve (bridging circles)
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [actors.diana, actors.eve, actors.charlie, null, null],
      });

      entityManager.addComponent(actors.charlie, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 2,
      });

      // Charlie already has manual closeness with Alice and Bob
      // Now establish automatic closeness with Eve
      await establishHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors.charlie,
          spot_index: 2,
          result_variable: 'charlieAutoCloseness',
        },
        executionContext
      );

      // Verify Charlie has both manual and automatic relationships
      const charlieCloseness = entityManager.getComponent(
        actors.charlie,
        'personal-space-states:closeness'
      );
      expect(charlieCloseness.partners).toContain(actors.alice); // Manual
      expect(charlieCloseness.partners).toContain(actors.bob); // Manual
      expect(charlieCloseness.partners).toContain(actors.eve); // Automatic
      expect(charlieCloseness.partners.length).toBe(3);

      // Verify Eve only has automatic relationships
      const eveCloseness = entityManager.getComponent(
        actors.eve,
        'personal-space-states:closeness'
      );
      expect(eveCloseness.partners).toContain(actors.diana); // Automatic
      expect(eveCloseness.partners).toContain(actors.charlie); // Automatic
      expect(eveCloseness.partners.length).toBe(2);
    });
  });

  describe('Complex Standing and Sitting Sequences', () => {
    it('should handle alternating sit/stand patterns correctly', async () => {
      const furnitureId = 'test:alternating_bench';
      const actors = ['test:alt_1', 'test:alt_2', 'test:alt_3', 'test:alt_4'];

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

      // Pattern 1: All sit
      const spots = [...actors];
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots,
      });

      for (let i = 0; i < actors.length; i++) {
        entityManager.addComponent(actors[i], 'sitting-states:sitting_on', {
          furniture_id: furnitureId,
          spot_index: i,
        });

        await establishHandler.execute(
          {
            furniture_id: furnitureId,
            actor_id: actors[i],
            spot_index: i,
            result_variable: 'closenessResult',
          },
          executionContext
        );
      }

      // Verify initial closeness
      let actor2Closeness = entityManager.getComponent(
        actors[1],
        'personal-space-states:closeness'
      );
      expect(actor2Closeness.partners.length).toBe(2); // Adjacent to actors[0] and actors[2]

      // Pattern 2: Odd-indexed actors stand (1 and 3)
      const newSpots = [actors[0], null, actors[2], null];
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: newSpots,
      });

      for (let i = 1; i < actors.length; i += 2) {
        entityManager.removeComponent(actors[i], 'sitting-states:sitting_on');

        await removeHandler.execute(
          {
            furniture_id: furnitureId,
            actor_id: actors[i],
            spot_index: i,
            result_variable: 'closenessRemoved',
          },
          executionContext
        );
      }

      // Verify closeness after odd actors stand
      const actor0Closeness = entityManager.getComponent(
        actors[0],
        'personal-space-states:closeness'
      );
      actor2Closeness = entityManager.getComponent(
        actors[2],
        'personal-space-states:closeness'
      );

      expect(actor0Closeness).toBeNull(); // No adjacent actors
      expect(actor2Closeness).toBeNull(); // No adjacent actors

      // Pattern 3: Odd actors sit back in different spots
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [actors[0], actors[3], actors[2], actors[1]], // Rearranged
      });

      entityManager.addComponent(actors[3], 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      });

      entityManager.addComponent(actors[1], 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 3,
      });

      // Re-establish closeness for new arrangement
      await establishHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[3],
          spot_index: 1,
          result_variable: 'actor3Closeness',
        },
        executionContext
      );

      await establishHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[1],
          spot_index: 3,
          result_variable: 'actor1Closeness',
        },
        executionContext
      );

      // Verify new closeness relationships
      const newActor0Closeness = entityManager.getComponent(
        actors[0],
        'personal-space-states:closeness'
      );
      const newActor3Closeness = entityManager.getComponent(
        actors[3],
        'personal-space-states:closeness'
      );

      expect(newActor0Closeness.partners).toEqual([actors[3]]);
      expect(newActor3Closeness.partners).toContain(actors[0]);
      expect(newActor3Closeness.partners).toContain(actors[2]);
    });

    it('should handle cascading closeness removal', async () => {
      const furnitureId = 'test:cascade_bench';
      const actors = [
        'test:cas_1',
        'test:cas_2',
        'test:cas_3',
        'test:cas_4',
        'test:cas_5',
      ];

      // Create furniture
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: new Array(5).fill(null),
          },
        },
      });
      entityManager.addEntity(furnitureEntity);

      // Create actors all sitting in a row
      for (let i = 0; i < actors.length; i++) {
        const actorEntity = createEntityInstance({
          instanceId: actors[i],
          baseComponents: {
            'core:actor': {},
            'sitting-states:sitting_on': {
              furniture_id: furnitureId,
              spot_index: i,
            },
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // Set furniture spots
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [...actors],
      });

      // Establish closeness for all
      for (let i = 0; i < actors.length; i++) {
        await establishHandler.execute(
          {
            furniture_id: furnitureId,
            actor_id: actors[i],
            spot_index: i,
            result_variable: 'closenessResult',
          },
          executionContext
        );
      }

      // Remove middle actor (cas_3 at index 2) - should affect neighbors
      const middleIndex = 2;
      const newSpots = [...actors];
      newSpots[middleIndex] = null;

      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: newSpots,
      });

      entityManager.removeComponent(
        actors[middleIndex],
        'sitting-states:sitting_on'
      );

      await removeHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: actors[middleIndex],
          spot_index: middleIndex,
          result_variable: 'middleRemoved',
        },
        executionContext
      );

      // Verify closeness changes
      const leftNeighborCloseness = entityManager.getComponent(
        actors[1],
        'personal-space-states:closeness'
      );
      const rightNeighborCloseness = entityManager.getComponent(
        actors[3],
        'personal-space-states:closeness'
      );
      const removedActorCloseness = entityManager.getComponent(
        actors[2],
        'personal-space-states:closeness'
      );

      // Middle actor should have no closeness
      expect(removedActorCloseness).toBeNull();

      // Left neighbor should only be close to actor 0 now
      expect(leftNeighborCloseness.partners).toEqual([actors[0]]);

      // Right neighbor should only be close to actor 4 now
      expect(rightNeighborCloseness.partners).toEqual([actors[4]]);

      // Actors 1 and 3 should NOT be close (gap between them)
      expect(leftNeighborCloseness.partners).not.toContain(actors[3]);
      expect(rightNeighborCloseness.partners).not.toContain(actors[1]);
    });
  });

  describe('Cross-Furniture Relationship Management', () => {
    it('should maintain separate closeness for actors on different furniture', async () => {
      const couch1Id = 'test:couch1';
      const couch2Id = 'test:couch2';
      const actors = {
        alice: 'test:cross_alice',
        bob: 'test:cross_bob',
        charlie: 'test:cross_charlie',
        diana: 'test:cross_diana',
      };

      // Create two furniture items
      const couch1Entity = createEntityInstance({
        instanceId: couch1Id,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null],
          },
        },
      });

      const couch2Entity = createEntityInstance({
        instanceId: couch2Id,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null],
          },
        },
      });

      entityManager.addEntity(couch1Entity);
      entityManager.addEntity(couch2Entity);

      // Create actors
      for (const [name, id] of Object.entries(actors)) {
        const actorEntity = createEntityInstance({
          instanceId: id,
          baseComponents: {
            'core:actor': {},
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // Alice and Bob sit on couch1
      entityManager.addComponent(couch1Id, 'sitting:allows_sitting', {
        spots: [actors.alice, actors.bob],
      });

      entityManager.addComponent(actors.alice, 'sitting-states:sitting_on', {
        furniture_id: couch1Id,
        spot_index: 0,
      });

      entityManager.addComponent(actors.bob, 'sitting-states:sitting_on', {
        furniture_id: couch1Id,
        spot_index: 1,
      });

      // Charlie and Diana sit on couch2
      entityManager.addComponent(couch2Id, 'sitting:allows_sitting', {
        spots: [actors.charlie, actors.diana],
      });

      entityManager.addComponent(actors.charlie, 'sitting-states:sitting_on', {
        furniture_id: couch2Id,
        spot_index: 0,
      });

      entityManager.addComponent(actors.diana, 'sitting-states:sitting_on', {
        furniture_id: couch2Id,
        spot_index: 1,
      });

      // Establish closeness for both couches
      await establishHandler.execute(
        {
          furniture_id: couch1Id,
          actor_id: actors.bob,
          spot_index: 1,
          result_variable: 'couch1Closeness',
        },
        executionContext
      );

      await establishHandler.execute(
        {
          furniture_id: couch2Id,
          actor_id: actors.diana,
          spot_index: 1,
          result_variable: 'couch2Closeness',
        },
        executionContext
      );

      // Verify closeness is furniture-specific
      const aliceCloseness = entityManager.getComponent(
        actors.alice,
        'personal-space-states:closeness'
      );
      const bobCloseness = entityManager.getComponent(
        actors.bob,
        'personal-space-states:closeness'
      );
      const charlieCloseness = entityManager.getComponent(
        actors.charlie,
        'personal-space-states:closeness'
      );
      const dianaCloseness = entityManager.getComponent(
        actors.diana,
        'personal-space-states:closeness'
      );

      // Couch1 actors should only be close to each other
      expect(aliceCloseness.partners).toEqual([actors.bob]);
      expect(bobCloseness.partners).toEqual([actors.alice]);

      // Couch2 actors should only be close to each other
      expect(charlieCloseness.partners).toEqual([actors.diana]);
      expect(dianaCloseness.partners).toEqual([actors.charlie]);

      // No cross-furniture closeness
      expect(aliceCloseness.partners).not.toContain(actors.charlie);
      expect(aliceCloseness.partners).not.toContain(actors.diana);
    });

    it('should handle actors moving between furniture items', async () => {
      const bench1Id = 'test:moving_bench1';
      const bench2Id = 'test:moving_bench2';
      const actorId = 'test:moving_actor';
      const buddy1Id = 'test:buddy1';
      const buddy2Id = 'test:buddy2';

      // Create two benches
      const bench1Entity = createEntityInstance({
        instanceId: bench1Id,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null],
          },
        },
      });

      const bench2Entity = createEntityInstance({
        instanceId: bench2Id,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null],
          },
        },
      });

      entityManager.addEntity(bench1Entity);
      entityManager.addEntity(bench2Entity);

      // Create actors
      const movingActor = createEntityInstance({
        instanceId: actorId,
        baseComponents: {
          'core:actor': {},
        },
      });

      const buddy1 = createEntityInstance({
        instanceId: buddy1Id,
        baseComponents: {
          'core:actor': {},
        },
      });

      const buddy2 = createEntityInstance({
        instanceId: buddy2Id,
        baseComponents: {
          'core:actor': {},
        },
      });

      entityManager.addEntity(movingActor);
      entityManager.addEntity(buddy1);
      entityManager.addEntity(buddy2);

      // Phase 1: Actor and buddy1 sit on bench1
      entityManager.addComponent(bench1Id, 'sitting:allows_sitting', {
        spots: [actorId, buddy1Id],
      });

      entityManager.addComponent(actorId, 'sitting-states:sitting_on', {
        furniture_id: bench1Id,
        spot_index: 0,
      });

      entityManager.addComponent(buddy1Id, 'sitting-states:sitting_on', {
        furniture_id: bench1Id,
        spot_index: 1,
      });

      await establishHandler.execute(
        {
          furniture_id: bench1Id,
          actor_id: buddy1Id,
          spot_index: 1,
          result_variable: 'bench1Closeness',
        },
        executionContext
      );

      // Verify initial closeness
      let actorCloseness = entityManager.getComponent(
        actorId,
        'personal-space-states:closeness'
      );
      expect(actorCloseness.partners).toEqual([buddy1Id]);

      // Phase 2: Actor stands up from bench1
      entityManager.addComponent(bench1Id, 'sitting:allows_sitting', {
        spots: [null, buddy1Id],
      });

      entityManager.removeComponent(actorId, 'sitting-states:sitting_on');

      await removeHandler.execute(
        {
          furniture_id: bench1Id,
          actor_id: actorId,
          spot_index: 0,
          result_variable: 'removedFromBench1',
        },
        executionContext
      );

      // Verify closeness removed
      actorCloseness = entityManager.getComponent(
        actorId,
        'personal-space-states:closeness'
      );
      expect(actorCloseness).toBeNull();

      // Phase 3: Actor sits on bench2 with buddy2
      entityManager.addComponent(buddy2Id, 'sitting-states:sitting_on', {
        furniture_id: bench2Id,
        spot_index: 0,
      });

      entityManager.addComponent(actorId, 'sitting-states:sitting_on', {
        furniture_id: bench2Id,
        spot_index: 1,
      });

      entityManager.addComponent(bench2Id, 'sitting:allows_sitting', {
        spots: [buddy2Id, actorId],
      });

      await establishHandler.execute(
        {
          furniture_id: bench2Id,
          actor_id: actorId,
          spot_index: 1,
          result_variable: 'bench2Closeness',
        },
        executionContext
      );

      // Verify new closeness on bench2
      actorCloseness = entityManager.getComponent(
        actorId,
        'personal-space-states:closeness'
      );
      const buddy2Closeness = entityManager.getComponent(
        buddy2Id,
        'personal-space-states:closeness'
      );

      expect(actorCloseness.partners).toEqual([buddy2Id]);
      expect(buddy2Closeness.partners).toEqual([actorId]);

      // Verify buddy1 still has no closeness (alone on bench1)
      const buddy1Closeness = entityManager.getComponent(
        buddy1Id,
        'personal-space-states:closeness'
      );
      expect(buddy1Closeness).toBeNull();
    });
  });

  describe('Closeness Circle Preservation and Merging', () => {
    it('should preserve closeness circles when adding automatic relationships', async () => {
      const furnitureId = 'test:preserve_bench';
      const circleActors = ['test:circ_1', 'test:circ_2', 'test:circ_3'];
      const outsiderActor = 'test:outsider';

      // Create furniture
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
      for (const actorId of [...circleActors, outsiderActor]) {
        const actorEntity = createEntityInstance({
          instanceId: actorId,
          baseComponents: {
            'core:actor': {},
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // Create manual closeness circle
      for (let i = 0; i < circleActors.length; i++) {
        const partners = circleActors.filter((_, idx) => idx !== i);
        entityManager.addComponent(circleActors[i], 'personal-space-states:closeness', {
          partners: partners,
        });
      }

      // Verify circle established
      const initialCirc1Closeness = entityManager.getComponent(
        circleActors[0],
        'personal-space-states:closeness'
      );
      expect(initialCirc1Closeness.partners.length).toBe(2);
      expect(initialCirc1Closeness.partners).toContain(circleActors[1]);
      expect(initialCirc1Closeness.partners).toContain(circleActors[2]);

      // One circle member sits down
      entityManager.addComponent(circleActors[0], 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 0,
      });

      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [circleActors[0], null, null, null],
      });

      // Outsider sits adjacent
      entityManager.addComponent(outsiderActor, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      });

      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [circleActors[0], outsiderActor, null, null],
      });

      // Establish automatic closeness
      await establishHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: outsiderActor,
          spot_index: 1,
          result_variable: 'outsiderCloseness',
        },
        executionContext
      );

      // Verify circle member now has both manual and automatic relationships
      const circ1Closeness = entityManager.getComponent(
        circleActors[0],
        'personal-space-states:closeness'
      );
      expect(circ1Closeness.partners.length).toBe(3);
      expect(circ1Closeness.partners).toContain(circleActors[1]); // Manual
      expect(circ1Closeness.partners).toContain(circleActors[2]); // Manual
      expect(circ1Closeness.partners).toContain(outsiderActor); // Automatic

      // Verify outsider only has automatic relationship
      const outsiderCloseness = entityManager.getComponent(
        outsiderActor,
        'personal-space-states:closeness'
      );
      expect(outsiderCloseness.partners).toEqual([circleActors[0]]);

      // Verify other circle members unchanged
      const circ2Closeness = entityManager.getComponent(
        circleActors[1],
        'personal-space-states:closeness'
      );
      expect(circ2Closeness.partners.length).toBe(2);
      expect(circ2Closeness.partners).not.toContain(outsiderActor);
    });

    it('should handle complex merging of multiple closeness circles', async () => {
      // Create scenario with two separate closeness circles that merge
      const furnitureId = 'test:merge_bench';
      const circle1 = ['test:c1_a', 'test:c1_b'];
      const circle2 = ['test:c2_a', 'test:c2_b'];
      const bridge = 'test:bridge';

      // Create furniture
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'sitting:allows_sitting': {
            spots: [null, null, null, null, null],
          },
        },
      });
      entityManager.addEntity(furnitureEntity);

      // Create all actors
      for (const actorId of [...circle1, ...circle2, bridge]) {
        const actorEntity = createEntityInstance({
          instanceId: actorId,
          baseComponents: {
            'core:actor': {},
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // Create two separate manual closeness circles
      // Circle 1
      entityManager.addComponent(circle1[0], 'personal-space-states:closeness', {
        partners: [circle1[1]],
      });
      entityManager.addComponent(circle1[1], 'personal-space-states:closeness', {
        partners: [circle1[0]],
      });

      // Circle 2
      entityManager.addComponent(circle2[0], 'personal-space-states:closeness', {
        partners: [circle2[1]],
      });
      entityManager.addComponent(circle2[1], 'personal-space-states:closeness', {
        partners: [circle2[0]],
      });

      // Members from each circle sit with gap between
      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [circle1[0], null, circle2[0], null, null],
      });

      entityManager.addComponent(circle1[0], 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 0,
      });

      entityManager.addComponent(circle2[0], 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 2,
      });

      // Bridge actor sits between them
      entityManager.addComponent(bridge, 'sitting-states:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      });

      entityManager.addComponent(furnitureId, 'sitting:allows_sitting', {
        spots: [circle1[0], bridge, circle2[0], null, null],
      });

      // Establish automatic closeness for bridge
      await establishHandler.execute(
        {
          furniture_id: furnitureId,
          actor_id: bridge,
          spot_index: 1,
          result_variable: 'bridgeCloseness',
        },
        executionContext
      );

      // Verify bridge connects both circles
      const bridgeCloseness = entityManager.getComponent(
        bridge,
        'personal-space-states:closeness'
      );
      expect(bridgeCloseness.partners).toContain(circle1[0]);
      expect(bridgeCloseness.partners).toContain(circle2[0]);
      expect(bridgeCloseness.partners.length).toBe(2);

      // Verify circles remain separate (only connected via bridge)
      const c1aCloseness = entityManager.getComponent(
        circle1[0],
        'personal-space-states:closeness'
      );
      const c2aCloseness = entityManager.getComponent(
        circle2[0],
        'personal-space-states:closeness'
      );

      expect(c1aCloseness.partners).toContain(circle1[1]); // Manual within circle
      expect(c1aCloseness.partners).toContain(bridge); // Automatic to bridge
      expect(c1aCloseness.partners).not.toContain(circle2[0]); // Not directly connected

      expect(c2aCloseness.partners).toContain(circle2[1]); // Manual within circle
      expect(c2aCloseness.partners).toContain(bridge); // Automatic to bridge
      expect(c2aCloseness.partners).not.toContain(circle1[0]); // Not directly connected
    });
  });
});
