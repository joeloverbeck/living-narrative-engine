/**
 * @file Integration tests for the sex-breastplay:fondle_breasts action and rule.
 * @description Tests the rule execution after the fondle_breasts action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see fondle_breasts_action_discovery.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy setup for fondle breasts scenarios.
 *
 * @returns {object} Object with actor, target, and all anatomy entities
 */
function setupAnatomyComponents() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity with body reference
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('beth')
    .asActor()
    .build();

  // Create target entity with body reference and anatomy
  const target = new ModEntityBuilder('beth')
    .withName('Beth')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('torso1')
    .asActor()
    .build();

  // Create anatomy entities as separate entities
  const torso = new ModEntityBuilder('torso1')
    .asBodyPart({
      parent: null,
      children: ['breast1', 'breast2'],
      subType: 'torso',
    })
    .build();

  const breast1 = new ModEntityBuilder('breast1')
    .asBodyPart({
      parent: 'torso1',
      children: [],
      subType: 'breast',
    })
    .build();

  const breast2 = new ModEntityBuilder('breast2')
    .asBodyPart({
      parent: 'torso1',
      children: [],
      subType: 'breast',
    })
    .build();

  return {
    room,
    actor,
    target,
    torso,
    breast1,
    breast2,
  };
}

describe('sex-breastplay:fondle_breasts action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction(
      'sex-breastplay',
      'sex-breastplay:fondle_breasts'
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

  it('performs fondle breasts action successfully', async () => {
    // Execute the fondle_breasts action
    await testFixture.executeAction('alice', 'beth');

    // Assert action executed successfully with proper events
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice eagerly fondles Beth's breasts.",
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
        actionId: 'sex-breastplay:fondle_breasts',
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
