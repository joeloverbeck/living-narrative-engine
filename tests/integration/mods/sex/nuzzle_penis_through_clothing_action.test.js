/**
 * @file Integration tests for the sex-penile-oral:nuzzle_penis_through_clothing action and rule.
 * @description Tests the rule execution after the nuzzle_penis_through_clothing action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see nuzzlePenisThroughClothingDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
// ModAssertionHelpers not needed for simplified tests

/**
 * Creates standardized anatomy and clothing setup for nuzzle penis through clothing scenarios.
 *
 * @returns {object} Object with actor, target, and all anatomy/clothing entities
 */
function setupPenisClothingScenario() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .kneelingBefore('bob')
    .asActor()
    .build();

  // Create target entity with body reference, anatomy, and clothing
  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('groin1')
    .asActor()
    .withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          base: ['pants1'],
        },
      },
    })
    .withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_lower: {
          coveredSockets: ['penis', 'left_hip', 'right_hip'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    })
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

  // Create clothing entity as separate entity
  const pants = new ModEntityBuilder('pants1').withName('pants').build();

  return {
    room,
    actor,
    target,
    groin,
    penis,
    pants,
  };
}

describe('sex-penile-oral:nuzzle_penis_through_clothing action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction(
      'sex-penile-oral',
      'sex-penile-oral:nuzzle_penis_through_clothing'
    );

    // Setup anatomy and clothing entities
    const entities = setupPenisClothingScenario();

    // Load all entities into the test environment
    testFixture.reset(Object.values(entities));
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('performs nuzzle penis through clothing action successfully', async () => {
    // Execute the nuzzle_penis_through_clothing action
    await testFixture.executeAction('alice', 'bob');

    // The action should execute and produce events
    const eventTypes = testFixture.events.map((e) => e.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'core:attempt_action',
        'core:perceptible_event',
        'core:display_successful_action_result',
        'core:turn_ended',
      ])
    );

    // Verify that perceptible events were generated (structural success verification)
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents.length).toBeGreaterThan(0);
    expect(perceptibleEvents[0].payload).toBeDefined();
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
        actionId: 'sex-penile-oral:nuzzle_penis_through_clothing',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });
});
