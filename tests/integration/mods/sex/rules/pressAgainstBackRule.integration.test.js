/**
 * @file Integration tests for press against back rule behavior
 * @description Tests the detailed behavior of the handle_press_against_back rule,
 * focusing on variable setting, message formatting, and macro integration
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy setup for press against back rule testing.
 *
 * @returns {object} Object with actor, target, and all anatomy entities
 */
function setupAnatomyComponents() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity with anatomy
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .withBody('torso1')
    .asActor()
    .build();

  // Create target entity
  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('torso2')
    .asActor()
    .build();

  // Create anatomy entities for actor (Alice)
  const actorTorso = new ModEntityBuilder('torso1')
    .asBodyPart({
      parent: null,
      children: ['chest1'],
      subType: 'torso',
    })
    .build();

  const actorChest = new ModEntityBuilder('chest1')
    .asBodyPart({
      parent: 'torso1',
      children: [],
      subType: 'chest',
    })
    .build();

  // Create anatomy entities for target (Bob)
  const targetTorso = new ModEntityBuilder('torso2')
    .asBodyPart({
      parent: null,
      children: ['back1'],
      subType: 'torso',
    })
    .build();

  const targetBack = new ModEntityBuilder('back1')
    .asBodyPart({
      parent: 'torso2',
      children: [],
      subType: 'back',
    })
    .build();

  return {
    room,
    actor,
    target,
    actorTorso,
    actorChest,
    targetTorso,
    targetBack,
  };
}

describe('press against back rule integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files for the press_against_back action
    testFixture = await ModTestFixture.forAction(
      'sex-breastplay',
      'sex-breastplay:press_against_back'
    );

    // Setup anatomy entities
    const entities = setupAnatomyComponents();

    // Load all entities into the test environment
    testFixture.reset(Object.values(entities));
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('executes press against back rule with correct variable setting and message formatting', async () => {
    // Execute the press_against_back action
    await testFixture.executeAction('alice', 'bob');

    // Assert action executed successfully with proper events and variable setting
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice presses herself against Bob's back, her breasts getting squeezed against Bob's flesh.",
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    // Verify that rule executed and produced perceptible events (structural success verification)
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents.length).toBeGreaterThan(0);
    expect(perceptibleEvents[0].payload).toBeDefined();
  });

  it('handles rule execution with macro integration properly', async () => {
    // Execute the action to test macro integration
    await testFixture.executeAction('alice', 'bob');

    // Verify that the macro actions (logSuccessAndEndTurn) were executed
    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:attempt_action',
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify correct order of macro execution
    expect(eventTypes.indexOf('core:perceptible_event')).toBeLessThan(
      eventTypes.indexOf('core:display_successful_action_result')
    );
    expect(
      eventTypes.indexOf('core:display_successful_action_result')
    ).toBeLessThan(eventTypes.indexOf('core:turn_ended'));
  });

  it('does not fire rule for non-matching conditions', async () => {
    // Setup minimal entities for different action test
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

    // Dispatch a different action that shouldn't trigger this rule
    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'core:wait',
      actorId: 'alice',
    });

    // Rule should not trigger for a different action
    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1); // Only the dispatched event
  });

  it('handles rule robustness with missing entities', async () => {
    // Setup minimal entities without target
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

    // Test rule robustness with missing target entity
    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: 'sex-breastplay:press_against_back',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail gracefully
    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });
});
