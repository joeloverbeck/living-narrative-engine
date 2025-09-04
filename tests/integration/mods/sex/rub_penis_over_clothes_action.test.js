/**
 * @file Integration tests for the sex:rub_penis_over_clothes action and rule.
 * @description Tests the rule execution after the rub_penis_over_clothes action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see rubPenisOverClothesActionDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy and clothing setup for rub penis over clothes scenarios.
 * 
 * @returns {object} Object with actor, target, and all anatomy/clothing entities
 */
function setupPenisClothingScenario() {
  // Create main room
  const room = new ModEntityBuilder('room1')
    .asRoom('Test Room')
    .build();

  // Create actor entity
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
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
          coveredSockets: ['penis', 'vagina', 'left_hip', 'right_hip'],
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
  const pants = new ModEntityBuilder('pants1')
    .withName('pants')
    .build();

  return {
    room,
    actor,
    target,
    groin,
    penis,
    pants,
  };
}

describe('sex:rub_penis_over_clothes action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction('sex', 'sex:rub_penis_over_clothes');
    
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

  it('performs rub penis over clothes action successfully', async () => {
    // Execute the rub_penis_over_clothes action with sex-specific payload
    // Note: primaryId should be the one with the body part, secondaryId should be the clothing item
    await testFixture.executeAction('alice', 'bob', {
      additionalPayload: {
        primaryId: 'bob',    // The one with the penis (target) 
        secondaryId: 'pants1', // The clothing item being rubbed over
      }
    });

    // Assert action executed successfully with proper events  
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      'Alice rubs Bob\'s penis over the pants.',
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
        actionId: 'sex:rub_penis_over_clothes',
        actorId: 'alice',
        targetId: 'nonexistent',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toEqual(['core:attempt_action']);
  });

  it('rule structure matches expected pattern', async () => {
    // This test verifies the rule follows expected patterns through auto-loaded configuration
    expect(testFixture.ruleFile.rule_id).toBe('handle_rub_penis_over_clothes');
    expect(testFixture.ruleFile.event_type).toBe('core:attempt_action');
    expect(testFixture.conditionFile.id).toBe('sex:event-is-action-rub-penis-over-clothes');

    // Verify the macro is present in the actions
    const actions = testFixture.ruleFile.actions;
    const lastAction = actions[actions.length - 1];
    expect(lastAction.macro).toBe('core:logSuccessAndEndTurn');
  });
});
