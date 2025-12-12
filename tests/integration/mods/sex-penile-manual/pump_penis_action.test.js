/**
 * @file Integration tests for the sex-penile-manual:pump_penis action and rule.
 * @description Tests the rule execution after the pump_penis action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see pumpPenisActionDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy setup for pump penis scenarios.
 *
 * @returns {object} Object with actor, target, and all anatomy entities
 */
function setupAnatomyComponents() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .asActor()
    .build();

  // Create target entity with body reference and anatomy
  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('groin1')
    .asActor()
    .build();

  // Create anatomy entities as separate entities
  const groin = new ModEntityBuilder('groin1')
    .asBodyPart({
      parent: null,
      children: ['penis1'],
      subType: 'groin',
    })
    .build();

  const penis = new ModEntityBuilder('penis1')
    .asBodyPart({
      parent: 'groin1',
      children: [],
      subType: 'penis',
    })
    .build();

  return {
    room,
    actor,
    target,
    groin,
    penis,
  };
}

describe('sex-penile-manual:pump_penis action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction(
      'sex-penile-manual',
      'sex-penile-manual:pump_penis'
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

  // eslint-disable-next-line jest/expect-expect
  it('performs pump penis action successfully', async () => {
    // Execute the pump_penis action
    await testFixture.executeAction('alice', 'bob');

    // Assert action executed successfully with proper events
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice pumps Bob's hard penis, intending to make Bob cum.",
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('does not fire rule for different action', async () => {
    // Setup minimal entities for this test
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

    // Rule should not trigger for a different action
    const newEventCount = testFixture.events.length;
    expect(newEventCount).toBe(initialEventCount + 1); // Only the dispatched event
  });

  it('handles missing target gracefully', async () => {
    // Setup minimal entities without a target
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

    // This test verifies the rule handles missing entities gracefully
    // The action prerequisites would normally prevent this, but we test rule robustness
    await expect(async () => {
      await testFixture.eventBus.dispatch('core:attempt_action', {
        actionId: 'sex-penile-manual:pump_penis',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('creates correct perceptible event with proper message format', async () => {
    // Execute the pump_penis action
    await testFixture.executeAction('alice', 'bob');

    // Find the perceptible event
    const perceptibleEvent = testFixture.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      "Alice pumps Bob's hard penis, intending to make Bob cum."
    );
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.actorId).toBe('alice');
    expect(perceptibleEvent.payload.targetId).toBe('bob');
    expect(perceptibleEvent.payload.perceptionType).toBe(
      'physical.target_action'
    );
  });

  it('creates correct success message', async () => {
    // Execute the pump_penis action
    await testFixture.executeAction('alice', 'bob');

    // Find the success message event
    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );

    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Alice pumps Bob's hard penis, intending to make Bob cum."
    );
  });
});
