/**
 * @file Integration tests for the deference:crawl_to action rule execution.
 * @description Tests rule execution, closeness establishment, and event dispatching.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized crawling scenario.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} targetName - Name for the target
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with room, actor, and target entities
 */
function setupCrawlingScenario(
  actorName = 'Alice',
  targetName = 'Bob',
  locationId = 'throne_room'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Throne Room').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .build();

  const target = new ModEntityBuilder('test:target1')
    .withName(targetName)
    .atLocation(locationId)
    .asActor()
    .build();

  // Actor is kneeling before target but not close
  actor.components['positioning:kneeling_before'] = {
    entityId: 'test:target1',
  };

  return { room, actor, target };
}

describe('deference:crawl_to - Rule Execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'deference',
      'deference:crawl_to',
      'data/mods/deference/rules/handle_crawl_to.rule.json',
      'data/mods/deference/conditions/event-is-action-crawl-to.condition.json'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Successful Execution', () => {
    it('should successfully establish closeness while preserving kneeling state', async () => {
      const { room, actor, target } = setupCrawlingScenario();
      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      // Verify actor gained closeness
      const actorEntity =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorEntity.components['personal-space-states:closeness']).toBeDefined();
      expect(
        actorEntity.components['personal-space-states:closeness'].partners
      ).toContain('test:target1');

      // Verify target gained closeness
      const targetEntity =
        testFixture.entityManager.getEntityInstance('test:target1');
      expect(targetEntity.components['personal-space-states:closeness']).toBeDefined();
      expect(
        targetEntity.components['personal-space-states:closeness'].partners
      ).toContain('test:actor1');

      // Verify kneeling state preserved
      expect(
        actorEntity.components['positioning:kneeling_before']
      ).toBeDefined();
      expect(
        actorEntity.components['positioning:kneeling_before'].entityId
      ).toBe('test:target1');
    });

    it('should dispatch correct success message', async () => {
      const { room, actor, target } = setupCrawlingScenario('Knight', 'Lord');

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      ModAssertionHelpers.assertActionSuccess(
        testFixture.events,
        "Knight crawls submissively to Lord until they're close."
      );
    });
  });

  describe('Closeness Circle Semantics', () => {
    it('should merge closeness circles when target is already close to others', async () => {
      const room = new ModEntityBuilder('throne_room')
        .asRoom('Throne Room')
        .build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('throne_room')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('throne_room')
        .closeToEntity('test:carol')
        .asActor()
        .build();

      const carol = new ModEntityBuilder('test:carol')
        .withName('Carol')
        .atLocation('throne_room')
        .closeToEntity('test:bob')
        .asActor()
        .build();

      // Alice is kneeling before Bob
      alice.components['positioning:kneeling_before'] = {
        entityId: 'test:bob',
      };

      testFixture.reset([room, alice, bob, carol]);

      await testFixture.executeAction('test:alice', 'test:bob');

      // Verify all three actors are in the same closeness circle
      const aliceEntity =
        testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');
      const carolEntity =
        testFixture.entityManager.getEntityInstance('test:carol');

      expect(aliceEntity.components['personal-space-states:closeness'].partners).toEqual(
        expect.arrayContaining(['test:bob', 'test:carol'])
      );
      expect(bobEntity.components['personal-space-states:closeness'].partners).toEqual(
        expect.arrayContaining(['test:alice', 'test:carol'])
      );
      expect(carolEntity.components['personal-space-states:closeness'].partners).toEqual(
        expect.arrayContaining(['test:alice', 'test:bob'])
      );
    });
  });

  describe('Perceptible Event Validation', () => {
    it('should dispatch perceptible event with correct properties', async () => {
      const { room, actor, target } = setupCrawlingScenario(
        'Knight',
        'King',
        'throne_room'
      );

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvents.length).toBeGreaterThan(0);

      const lastPerceptible = perceptibleEvents[perceptibleEvents.length - 1];
      expect(lastPerceptible.payload.descriptionText).toContain(
        'crawls submissively to'
      );
      expect(lastPerceptible.payload.descriptionText).toContain('Knight');
      expect(lastPerceptible.payload.descriptionText).toContain('King');
      expect(lastPerceptible.payload.locationId).toBe('throne_room');
      expect(lastPerceptible.payload.actorId).toBe('test:actor1');
      expect(lastPerceptible.payload.targetId).toBe('test:target1');
      expect(lastPerceptible.payload.perceptionType).toBe(
        'state.observable_change'
      );

      // Validate sense-aware perspective fields
      expect(lastPerceptible.payload.actorDescription).toBe(
        'I crawl submissively to King until we\'re close.'
      );
      expect(lastPerceptible.payload.targetDescription).toBe(
        'Knight crawls submissively toward me until we\'re close.'
      );
      expect(lastPerceptible.payload.alternateDescriptions).toEqual({
        auditory:
          'I hear the sounds of shuffling and fabric dragging as someone crawls nearby.',
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should maintain both kneeling and closeness components simultaneously', async () => {
      const { room, actor, target } = setupCrawlingScenario();
      testFixture.reset([room, actor, target]);

      // Verify initial state: kneeling but not close
      const actorBefore =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        actorBefore.components['positioning:kneeling_before']
      ).toBeDefined();
      expect(actorBefore.components['personal-space-states:closeness']).toBeUndefined();

      await testFixture.executeAction('test:actor1', 'test:target1');

      // Verify final state: both kneeling and close
      const actorAfter =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(
        actorAfter.components['positioning:kneeling_before']
      ).toBeDefined();
      expect(
        actorAfter.components['positioning:kneeling_before'].entityId
      ).toBe('test:target1');
      expect(actorAfter.components['personal-space-states:closeness']).toBeDefined();
      expect(actorAfter.components['personal-space-states:closeness'].partners).toContain(
        'test:target1'
      );
    });
  });

  describe('Rule Specificity', () => {
    it('should only fire for deference:crawl_to action', async () => {
      const { room, actor, target } = setupCrawlingScenario();
      testFixture.reset([room, actor, target]);

      // Execute a different action
      await testFixture.executeActionManual('test:actor1', 'core:wait', null);

      // Verify no closeness was added
      const actorEntity =
        testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actorEntity.components['personal-space-states:closeness']).toBeUndefined();

      // Verify no crawling-related perceptible events
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      const crawlEvents = perceptibleEvents.filter((e) =>
        e.payload.descriptionText?.includes('crawl')
      );
      expect(crawlEvents).toHaveLength(0);
    });
  });

  describe('Multi-Actor Scenarios', () => {
    it('should only affect actor and target, not other entities', async () => {
      const room = new ModEntityBuilder('courtyard')
        .asRoom('Courtyard')
        .build();

      const alice = new ModEntityBuilder('test:alice')
        .withName('Alice')
        .atLocation('courtyard')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('test:bob')
        .withName('Bob')
        .atLocation('courtyard')
        .asActor()
        .build();

      const carol = new ModEntityBuilder('test:carol')
        .withName('Carol')
        .atLocation('courtyard')
        .asActor()
        .build();

      const dave = new ModEntityBuilder('test:dave')
        .withName('Dave')
        .atLocation('courtyard')
        .asActor()
        .build();

      // Alice kneeling before Bob
      alice.components['positioning:kneeling_before'] = {
        entityId: 'test:bob',
      };

      // Carol kneeling before Dave
      carol.components['positioning:kneeling_before'] = {
        entityId: 'test:dave',
      };

      testFixture.reset([room, alice, bob, carol, dave]);

      // Alice crawls to Bob
      await testFixture.executeAction('test:alice', 'test:bob');

      // Verify Alice and Bob are close
      const aliceEntity =
        testFixture.entityManager.getEntityInstance('test:alice');
      const bobEntity = testFixture.entityManager.getEntityInstance('test:bob');
      expect(aliceEntity.components['personal-space-states:closeness']).toBeDefined();
      expect(bobEntity.components['personal-space-states:closeness']).toBeDefined();

      // Verify Carol and Dave are not affected
      const carolEntity =
        testFixture.entityManager.getEntityInstance('test:carol');
      const daveEntity =
        testFixture.entityManager.getEntityInstance('test:dave');
      expect(carolEntity.components['personal-space-states:closeness']).toBeUndefined();
      expect(daveEntity.components['personal-space-states:closeness']).toBeUndefined();
    });
  });

  describe('Realistic Entity IDs', () => {
    it('should work with production-like namespaced entity IDs', async () => {
      const room = new ModEntityBuilder('p_scenario:throne_room')
        .asRoom('Royal Throne Room')
        .build();

      const alice = new ModEntityBuilder('p_scenario:alice_smith')
        .withName('Alice Smith')
        .atLocation('p_scenario:throne_room')
        .asActor()
        .build();

      const bob = new ModEntityBuilder('p_scenario:bob_jones')
        .withName('Bob Jones')
        .atLocation('p_scenario:throne_room')
        .asActor()
        .build();

      alice.components['positioning:kneeling_before'] = {
        entityId: 'p_scenario:bob_jones',
      };

      testFixture.reset([room, alice, bob]);

      await testFixture.executeAction(
        'p_scenario:alice_smith',
        'p_scenario:bob_jones'
      );

      const aliceEntity = testFixture.entityManager.getEntityInstance(
        'p_scenario:alice_smith'
      );
      const bobEntity = testFixture.entityManager.getEntityInstance(
        'p_scenario:bob_jones'
      );

      expect(aliceEntity.components['personal-space-states:closeness']).toBeDefined();
      expect(
        aliceEntity.components['personal-space-states:closeness'].partners
      ).toContain('p_scenario:bob_jones');
      expect(bobEntity.components['personal-space-states:closeness']).toBeDefined();
      expect(bobEntity.components['personal-space-states:closeness'].partners).toContain(
        'p_scenario:alice_smith'
      );
    });
  });

  describe('Action Success Event', () => {
    it('should dispatch action success event with correct format', async () => {
      const { room, actor, target } = setupCrawlingScenario();
      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      const successEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:action_success'
      );
      expect(successEvents.length).toBeGreaterThan(0);

      const lastSuccess = successEvents[successEvents.length - 1];
      expect(lastSuccess.eventType).toBe('core:action_success');
      expect(lastSuccess.payload).toMatchObject({
        actionId: 'deference:crawl_to',
        actorId: 'test:actor1',
        targetId: 'test:target1',
        success: true,
      });
    });
  });
});
