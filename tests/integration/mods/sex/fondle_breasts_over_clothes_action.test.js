/**
 * @file Integration tests for the sex-breastplay:fondle_breasts_over_clothes action and rule.
 * @description Tests the rule execution after the fondle_breasts_over_clothes action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see fondle_breasts_over_clothes_action_discovery.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy and clothing setup for fondle breasts over clothes scenarios.
 *
 * @returns {object} Object with actor, target, anatomy, and clothing entities
 */
function setupBreastsClothingScenario() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('beth')
    .asActor()
    .build();

  // Create target entity with body reference, anatomy, and clothing
  const target = new ModEntityBuilder('beth')
    .withName('Beth')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('torso1')
    .asActor()
    .withComponent('clothing:equipment', {
      equipped: {
        torso_upper: {
          base: ['blouse1'],
        },
      },
    })
    .withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_upper: {
          coveredSockets: ['left_chest', 'right_chest'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    })
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

  // Create clothing entity as separate entity
  const blouse = new ModEntityBuilder('blouse1').withName('blouse').build();

  return {
    room,
    actor,
    target,
    torso,
    breast1,
    breast2,
    blouse,
  };
}

describe('sex-breastplay:fondle_breasts_over_clothes action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction(
      'sex-breastplay',
      'sex-breastplay:fondle_breasts_over_clothes'
    );

    // Setup anatomy and clothing entities
    const entities = setupBreastsClothingScenario();

    // Load all entities into the test environment
    testFixture.reset(Object.values(entities));
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('performs fondle breasts over clothes action successfully', async () => {
    // Execute the fondle_breasts_over_clothes action with sex-specific payload
    // Note: primaryId should be the one with the breasts, secondaryId should be the clothing item
    await testFixture.executeAction('alice', 'beth', {
      additionalPayload: {
        primaryId: 'beth', // The one with the breasts (target)
        secondaryId: 'blouse1', // The clothing item being fondled over
      },
    });

    // Assert action executed successfully with proper events
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice eagerly fondles Beth's breasts over her blouse.",
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
        actionId: 'sex-breastplay:fondle_breasts_over_clothes',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('rule structure matches expected pattern', () => {
    // This test verifies the rule follows expected patterns through auto-loaded configuration
    expect(testFixture.ruleFile.rule_id).toBe(
      'handle_fondle_breasts_over_clothes'
    );
    expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    expect(testFixture.conditionFile.id).toBe(
      'sex-breastplay:event-is-action-fondle-breasts-over-clothes'
    );

    // Verify the macro is present in the actions
    const actions = testFixture.ruleFile.actions;
    const lastAction = actions[actions.length - 1];
    expect(lastAction.macro).toBe('core:logSuccessAndEndTurn');
  });
});
