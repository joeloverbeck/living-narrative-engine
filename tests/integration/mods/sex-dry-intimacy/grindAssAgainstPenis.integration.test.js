/**
 * @file Integration tests for the sex-dry-intimacy:grind_ass_against_penis action and rule.
 * @description Tests the rule execution after the grind_ass_against_penis action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see grindAssAgainstPenisActionDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy and clothing setup for grind ass against penis scenarios.
 *
 * @returns {object} Object with actor, target, and all anatomy/clothing entities
 */
function setupGrindingScenario() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity facing away from target
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .withComponent('facing-states:facing_away', {
      facing_away_from: ['bob'],
    })
    .asActor()
    .build();

  // Create target entity behind actor with body reference, anatomy, and clothing
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

describe('sex-dry-intimacy:grind_ass_against_penis action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction(
      'sex-dry-intimacy',
      'sex-dry-intimacy:grind_ass_against_penis'
    );

    // Setup anatomy and clothing entities
    const entities = setupGrindingScenario();

    // Load all entities into the test environment
    testFixture.reset(Object.values(entities));
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('should execute successfully with correct perceptible event', async () => {
    // Execute the action - the test fixture will dispatch it with the correct structure
    await testFixture.eventBus.dispatch('core:attempt_action', {
      actionId: 'sex-dry-intimacy:grind_ass_against_penis',
      actorId: 'alice',
      primaryId: 'bob',
      secondaryId: 'pants1',
    });

    // Assert action executed successfully with proper events
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice rubs their ass sensually against Bob's penis through the pants.",
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });

  it('should not fire rule for different action', async () => {
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

  it('should handle missing target gracefully', async () => {
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
        actionId: 'sex-dry-intimacy:grind_ass_against_penis',
        actorId: 'alice',
        primaryId: 'nonexistent',
        secondaryId: 'nonexistent_clothing',
      });
    }).not.toThrow();

    // With missing target, the rule should fail during GET_NAME operation
    // So only the initial attempt_action event should be present
    const types = testFixture.events.map((e) => e.eventType);
    expect(types).toContain('core:attempt_action');
    expect(types).not.toContain('core:dispatch_perceptible_event');
  });
});
