/**
 * @file Integration tests for the positioning:stand_up action and rule.
 * @description Tests the rule execution after the stand_up action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized kneeling positioning scenario.
 * 
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {string} kneelTarget - Entity being knelt to
 * @returns {object} Object with actor and location entities
 */
function setupKneelingScenario(actorName = 'Alice', locationId = 'throne_room', kneelTarget = 'test:king') {
  const room = new ModEntityBuilder(locationId)
    .asRoom('Test Room')
    .build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .withComponent('positioning:kneeling_before', { entityId: kneelTarget })
    .asActor()
    .build();

  return { room, actor };
}

/**
 * Creates multi-actor scenario with witness.
 */
function setupMultiActorScenario() {
  const scenario = setupKneelingScenario('Knight', 'courtyard', 'test:lord');
  
  const witness = new ModEntityBuilder('test:witness1')
    .withName('Peasant')
    .atLocation('courtyard')
    .asActor()
    .build();

  return { ...scenario, witness };
}

describe('positioning:stand_up action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('positioning', 'positioning:stand_up');
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('successfully executes stand up action when kneeling', async () => {
    const entities = setupKneelingScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'none');

    // Verify component was removed
    ModAssertionHelpers.assertComponentRemoved(
      testFixture.entityManager,
      'test:actor1',
      'positioning:kneeling_before'
    );

    // Verify action success
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Alice stands up from their kneeling position.'
    );
  });

  it('creates correct perceptible event', async () => {
    const entities = setupKneelingScenario('Sir Galahad', 'castle_hall', 'test:queen');
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'none');

    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Sir Galahad stands up from their kneeling position.'
    );
    expect(perceptibleEvent.payload.locationId).toBe('castle_hall');
    expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
    expect(perceptibleEvent.payload.targetId).toBe(null);
    expect(perceptibleEvent.payload.perceptionType).toBe('action_self_general');
  });

  it('only fires for correct action ID', async () => {
    const entities = setupKneelingScenario('Alice', 'room1', 'test:target');
    testFixture.reset(Object.values(entities));

    // Try with a different action - this should not trigger the stand_up rule
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'core:wait',
      targetId: 'none',
      originalInput: 'wait'
    });

    // Should not have removed the kneeling component
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['positioning:kneeling_before']).toBeDefined();

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);
  });

  it('handles multiple actors in same location with witnesses', async () => {
    const entities = setupMultiActorScenario();
    testFixture.reset(Object.values(entities));

    await testFixture.executeAction('test:actor1', 'none');

    // Verify component was removed
    ModAssertionHelpers.assertComponentRemoved(
      testFixture.entityManager,
      'test:actor1',
      'positioning:kneeling_before'
    );

    // Perceptible event should be visible to all in location
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.locationId).toBe('courtyard');
  });

  it('works correctly after kneeling to namespaced entity', async () => {
    const room = new ModEntityBuilder('coffee_shop')
      .asRoom('Coffee Shop')
      .build();

    const actor = new ModEntityBuilder('p_erotica:iker_aguirre_instance')
      .withName('Iker')
      .atLocation('coffee_shop')
      .withComponent('positioning:kneeling_before', {
        entityId: 'p_erotica:amaia_castillo_instance',
      })
      .asActor()
      .build();

    testFixture.reset([room, actor]);

    await testFixture.executeAction('p_erotica:iker_aguirre_instance', 'none');

    // Verify component was removed
    ModAssertionHelpers.assertComponentRemoved(
      testFixture.entityManager,
      'p_erotica:iker_aguirre_instance',
      'positioning:kneeling_before'
    );

    // Verify action success
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Iker stands up from their kneeling position.'
    );
  });

  it('verifies action validation prevents standing when not kneeling', () => {
    // This test documents the expected behavior that the action system
    // would prevent the action from being available when the required
    // component is not present. The rule itself assumes validation
    // has already occurred when it receives the event.

    const standUpAction = {
      required_components: {
        actor: ['positioning:kneeling_before'],
      },
    };

    // Actor without kneeling component
    const actorComponents = {
      'core:name': { text: 'Alice' },
      'core:position': { locationId: 'room1' },
    };

    // Action should not be available (this would be handled by action discovery)
    const hasRequiredComponent = standUpAction.required_components.actor.every(
      (comp) => comp in actorComponents
    );
    expect(hasRequiredComponent).toBe(false);
  });
});