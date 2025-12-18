/**
 * @file Integration tests for the sex-vaginal-penetration:insert_penis_into_vagina action and rule.
 * @description Validates rule execution, messaging, perceptible events, and applied state components.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

const EXPECTED_MESSAGE =
  "Alice inserts their penis into Beth's vagina, that stretches to accomodate the girth.";

/**
 * @description Creates a standardized penetration scenario.
 * @returns {Array<object>} Entities for the fixture.
 */
function setupPenetrationScenario() {
  const room = new ModEntityBuilder('room1').asRoom('Intimacy Suite').build();

  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .withBody('aliceGroin1')
    .closeToEntity('beth')
    .asActor()
    .build();

  const target = new ModEntityBuilder('beth')
    .withName('Beth')
    .atLocation('room1')
    .withBody('bethPelvis1')
    .closeToEntity('alice')
    .asActor()
    .build();

  const aliceGroin = new ModEntityBuilder('aliceGroin1')
    .asBodyPart({ parent: null, children: ['alicePenis1'], subType: 'groin' })
    .build();

  const alicePenis = new ModEntityBuilder('alicePenis1')
    .asBodyPart({ parent: 'aliceGroin1', children: [], subType: 'penis' })
    .build();

  const bethPelvis = new ModEntityBuilder('bethPelvis1')
    .asBodyPart({ parent: null, children: ['bethVagina1'], subType: 'pelvis' })
    .build();

  const bethVagina = new ModEntityBuilder('bethVagina1')
    .asBodyPart({ parent: 'bethPelvis1', children: [], subType: 'vagina' })
    .build();

  return [room, actor, target, aliceGroin, alicePenis, bethPelvis, bethVagina];
}

describe('sex-vaginal-penetration:insert_penis_into_vagina action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      'sex-vaginal-penetration:insert_penis_into_vagina'
    );

    testFixture.reset(setupPenetrationScenario());
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('performs the penetration initiation action successfully', async () => {
    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: {
        primaryId: 'beth',
      },
    });

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    const attemptEvent = testFixture.events.find(
      (event) => event.eventType === 'core:attempt_action'
    );
    expect(attemptEvent).toBeDefined();
    expect(attemptEvent.payload.primaryId).toBe('beth');
  });

  it('emits a perceptible event with the correct context payload', async () => {
    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: {
        primaryId: 'beth',
      },
    });

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: 'room1',
      actorId: 'alice',
      targetId: 'beth',
      perceptionType: 'physical.target_action',
    });
  });

  it('applies penetration state components to actor and target', async () => {
    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: {
        primaryId: 'beth',
      },
    });

    const actorComponent = testFixture.entityManager.getComponentData(
      'alice',
      'sex-states:fucking_vaginally'
    );
    expect(actorComponent).toBeDefined();
    expect(actorComponent).toEqual({ targetId: 'beth' });

    const targetComponent = testFixture.entityManager.getComponentData(
      'beth',
      'sex-states:being_fucked_vaginally'
    );

    expect(targetComponent).toBeDefined();
    expect(targetComponent).toEqual({ actorId: 'alice' });
  });

  it('only produces expected events during execution', async () => {
    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: {
        primaryId: 'beth',
      },
    });

    const eventTypes = testFixture.events.map((event) => event.eventType);
    const unexpectedEvents = eventTypes.filter((type) =>
      ['core:error', 'core:action_failed', 'core:action_invalid'].includes(type)
    );

    expect(unexpectedEvents).toHaveLength(0);
    expect(eventTypes).toContain('core:turn_ended');
    expect(eventTypes).toContain('core:perceptible_event');
    expect(eventTypes).toContain('core:display_successful_action_result');
  });

  it('does not fire the rule when a different action is attempted', async () => {
    const minimalEntities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(minimalEntities);

    const initialEventCount = testFixture.events.length;

    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: 'alice',
    });

    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1);
  });
});
