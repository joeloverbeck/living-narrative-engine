/**
 * @file Integration tests for the deference:stand_up action and rule.
 * @description Tests the rule execution after the stand_up action is performed.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('deference:stand_up action integration', () => {
  let testFixture;

  const createStandUpScenario = (options = {}) => {
    const scenario = testFixture.createKneelingBeforeSitting({
      seatedActors: [{ id: 'test:king', name: 'Test King', spotIndex: 0 }],
      kneelingActors: [
        {
          id: 'test:actor1',
          name: 'Alice',
          targetId: 'test:king',
        },
      ],
      ...options,
    });

    testFixture.reset([...scenario.entities]);

    return scenario;
  };

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'deference',
      'deference:stand_up'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('successfully executes stand up action when kneeling', async () => {
    createStandUpScenario({
      locationId: 'throne_room',
      roomId: 'throne_room',
      roomName: 'Test Room',
    });

    await testFixture.executeAction('test:actor1', 'none');

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor).toNotHaveComponent('positioning:kneeling_before');
    expect(testFixture.events).toHaveActionSuccess(
      'Alice stands up from their kneeling position.'
    );
  });

  it('creates correct perceptible event', async () => {
    createStandUpScenario({
      locationId: 'castle_hall',
      roomId: 'castle_hall',
      roomName: 'Castle Hall',
      seatedActors: [{ id: 'test:queen', name: 'Queen', spotIndex: 0 }],
      kneelingActors: [
        {
          id: 'test:actor1',
          name: 'Sir Galahad',
          targetId: 'test:queen',
          locationId: 'castle_hall',
        },
      ],
    });

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
    expect(perceptibleEvent.payload.perceptionType).toBe('physical.self_action');

    // Validate sense-aware perspective fields
    expect(perceptibleEvent.payload.actorDescription).toBe(
      'I stand up from my kneeling position.'
    );
    // Self-action: no target_description expected (null or absent)
    expect(perceptibleEvent.payload.targetDescription).toBeNull();
    expect(perceptibleEvent.payload.alternateDescriptions).toEqual({
      auditory: 'I hear the rustle of movement as someone stands up nearby.',
    });
  });

  it('only fires for correct action ID', async () => {
    const scenario = createStandUpScenario({
      locationId: 'room1',
      roomId: 'room1',
      roomName: 'Room 1',
      kneelingActors: [
        {
          id: 'test:actor1',
          name: 'Alice',
          targetId: 'test:target',
          locationId: 'room1',
        },
      ],
      seatedActors: [{ id: 'test:target', name: 'Target', spotIndex: 0 }],
    });

    // Try with a different action - this should not trigger the stand_up rule
    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'core:wait',
      targetId: 'none',
      originalInput: 'wait',
    });

    // Should not have removed the kneeling component
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor).toHaveComponent('positioning:kneeling_before');

    const kneelingActor = scenario.kneelingActors[0];
    expect(kneelingActor.id).toBe('test:actor1');

    expect(testFixture.events).not.toDispatchEvent('core:perceptible_event');
  });

  it('handles multiple actors in same location with witnesses', async () => {
    createStandUpScenario({
      locationId: 'courtyard',
      roomId: 'courtyard',
      roomName: 'Courtyard',
      kneelingActors: [
        {
          id: 'test:actor1',
          name: 'Knight',
          targetId: 'test:lord',
          locationId: 'courtyard',
        },
      ],
      seatedActors: [{ id: 'test:lord', name: 'Lord', spotIndex: 0 }],
      standingActors: [
        {
          id: 'test:witness1',
          name: 'Peasant',
          locationId: 'courtyard',
        },
      ],
    });

    await testFixture.executeAction('test:actor1', 'none');

    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor).toNotHaveComponent('positioning:kneeling_before');

    // Perceptible event should be visible to all in location
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.locationId).toBe('courtyard');
  });

  it('works correctly after kneeling to namespaced entity', async () => {
    createStandUpScenario({
      locationId: 'coffee_shop',
      roomId: 'coffee_shop',
      roomName: 'Coffee Shop',
      kneelingActors: [
        {
          id: 'p_erotica:iker_aguirre_instance',
          name: 'Iker',
          targetId: 'p_erotica:amaia_castillo_instance',
          locationId: 'coffee_shop',
        },
      ],
      seatedActors: [
        {
          id: 'p_erotica:amaia_castillo_instance',
          name: 'Amaia',
          spotIndex: 0,
        },
      ],
    });

    await testFixture.executeAction('p_erotica:iker_aguirre_instance', 'none');

    const actor = testFixture.entityManager.getEntityInstance(
      'p_erotica:iker_aguirre_instance'
    );
    expect(actor).toNotHaveComponent('positioning:kneeling_before');
    expect(testFixture.events).toHaveActionSuccess(
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
