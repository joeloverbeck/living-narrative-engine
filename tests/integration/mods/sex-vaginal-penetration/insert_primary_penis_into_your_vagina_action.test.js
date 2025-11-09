/**
 * @file Integration tests for the sex-vaginal-penetration:insert_primary_penis_into_your_vagina action and rule.
 * @description Validates rule execution, messaging, perceptible events, and applied state components.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

const EXPECTED_MESSAGE =
  "Alana introduces Dorian's penis into her vagina, that stretches to accomodate the girth.";

/**
 * @description Creates a standardized receptive penetration scenario.
 * @returns {Array<object>} Entities for the fixture.
 */
function setupPenetrationScenario() {
  const room = new ModEntityBuilder('room1').asRoom('Intimacy Suite').build();

  const actor = new ModEntityBuilder('alana')
    .withName('Alana')
    .atLocation('room1')
    .withBody('alanaPelvis1')
    .closeToEntity('dorian')
    .asActor()
    .build();

  const target = new ModEntityBuilder('dorian')
    .withName('Dorian')
    .atLocation('room1')
    .withBody('dorianGroin1')
    .closeToEntity('alana')
    .asActor()
    .build();

  const alanaPelvis = new ModEntityBuilder('alanaPelvis1')
    .asBodyPart({ parent: null, children: ['alanaVagina1'], subType: 'pelvis' })
    .build();

  const alanaVagina = new ModEntityBuilder('alanaVagina1')
    .asBodyPart({ parent: 'alanaPelvis1', children: [], subType: 'vagina' })
    .build();

  const dorianGroin = new ModEntityBuilder('dorianGroin1')
    .asBodyPart({ parent: null, children: ['dorianPenis1'], subType: 'groin' })
    .build();

  const dorianPenis = new ModEntityBuilder('dorianPenis1')
    .asBodyPart({ parent: 'dorianGroin1', children: [], subType: 'penis' })
    .build();

  return [
    room,
    actor,
    target,
    alanaPelvis,
    alanaVagina,
    dorianGroin,
    dorianPenis,
  ];
}

describe('sex-vaginal-penetration:insert_primary_penis_into_your_vagina action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      'sex-vaginal-penetration:insert_primary_penis_into_your_vagina'
    );

    testFixture.reset(setupPenetrationScenario());
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('performs the receptive penetration initiation action successfully', async () => {
    await testFixture.executeAction('alana', 'dorian', {
      additionalPayload: {
        primaryId: 'dorian',
      },
    });

    ModAssertionHelpers.assertActionSuccess(testFixture.events, EXPECTED_MESSAGE, {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    });

    const attemptEvent = testFixture.events.find(
      (event) => event.eventType === 'core:attempt_action'
    );
    expect(attemptEvent).toBeDefined();
    expect(attemptEvent.payload.primaryId).toBe('dorian');
  });

  it('emits a perceptible event with the correct context payload', async () => {
    await testFixture.executeAction('alana', 'dorian', {
      additionalPayload: {
        primaryId: 'dorian',
      },
    });

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: 'room1',
      actorId: 'alana',
      targetId: 'dorian',
      perceptionType: 'action_target_general',
    });
  });

  it('applies penetration state components to actor and target', async () => {
    await testFixture.executeAction('alana', 'dorian', {
      additionalPayload: {
        primaryId: 'dorian',
      },
    });

    const actorComponent = testFixture.entityManager.getComponentData(
      'alana',
      'positioning:being_fucked_vaginally'
    );
    expect(actorComponent).toBeDefined();
    expect(actorComponent).toEqual({ actorId: 'dorian' });

    const targetComponent = testFixture.entityManager.getComponentData(
      'dorian',
      'positioning:fucking_vaginally'
    );

    expect(targetComponent).toBeDefined();
    expect(targetComponent).toEqual({ targetId: 'alana' });
  });

  it('only produces expected events during execution', async () => {
    await testFixture.executeAction('alana', 'dorian', {
      additionalPayload: {
        primaryId: 'dorian',
      },
    });

    const eventTypes = testFixture.events.map((event) => event.eventType);
    const unexpectedEvents = eventTypes.filter((type) =>
      [
        'core:error',
        'core:action_failed',
        'core:action_invalid',
      ].includes(type)
    );

    expect(unexpectedEvents).toHaveLength(0);
    expect(eventTypes).toContain('core:turn_ended');
    expect(eventTypes).toContain('core:perceptible_event');
    expect(eventTypes).toContain('core:display_successful_action_result');
  });

  it('does not fire the rule when a different action is attempted', async () => {
    const minimalEntities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('alana')
        .withName('Alana')
        .atLocation('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(minimalEntities);

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: 'alana',
    });

    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1);
  });
});
