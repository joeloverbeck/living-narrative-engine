/**
 * @file Integration tests for the sex-vaginal-penetration:slide_penis_along_labia action and rule.
 * @description Verifies rule execution, narrative output, and safety checks for the slide penis along labia action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * @description Creates standardized entities for slide penis along labia scenarios.
 * @returns {object} Collection of entities keyed by their logical role.
 */
function setupAnatomyComponents() {
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('beth')
    .withBody('actorGroin1')
    .asActor()
    .build();

  const target = new ModEntityBuilder('beth')
    .withName('Beth')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('targetPelvis1')
    .asActor()
    .build();

  const actorGroin = new ModEntityBuilder('actorGroin1')
    .asBodyPart({
      parent: null,
      children: ['actorPenis1'],
      subType: 'groin',
    })
    .build();

  const actorPenis = new ModEntityBuilder('actorPenis1')
    .asBodyPart({
      parent: 'actorGroin1',
      children: [],
      subType: 'penis',
    })
    .build();

  const targetPelvis = new ModEntityBuilder('targetPelvis1')
    .asBodyPart({
      parent: null,
      children: ['vagina1'],
      subType: 'pelvis',
    })
    .build();

  const vagina = new ModEntityBuilder('vagina1')
    .asBodyPart({
      parent: 'targetPelvis1',
      children: [],
      subType: 'vagina',
    })
    .build();

  return {
    room,
    actor,
    target,
    actorGroin,
    actorPenis,
    targetPelvis,
    vagina,
  };
}

const EXPECTED_MESSAGE =
  "Alice slides their penis teasingly along Beth's bare labia.";

describe('sex-vaginal-penetration:slide_penis_along_labia action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      'sex-vaginal-penetration:slide_penis_along_labia'
    );

    const entities = setupAnatomyComponents();
    testFixture.reset(Object.values(entities));
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('performs slide penis along labia action successfully', async () => {
    await testFixture.executeAction('alice', 'beth');

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('creates correct perceptible event with proper message format', async () => {
    await testFixture.executeAction('alice', 'beth');

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: 'room1',
      actorId: 'alice',
      targetId: 'beth',
      perceptionType: 'physical.target_action',
    });
  });

  it('creates correct success message', async () => {
    await testFixture.executeAction('alice', 'beth');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(EXPECTED_MESSAGE);
  });

  it('does not fire rule for different action', async () => {
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

  it('handles missing target gracefully', async () => {
    const minimalEntities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity([])
        .asActor()
        .build(),
    ];

    testFixture.reset(minimalEntities);

    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: 'sex-vaginal-penetration:slide_penis_along_labia',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    const eventTypes = testFixture.events.map((event) => event.eventType);
    expect(eventTypes).toEqual(['core:attempt_action']);
  });
});
