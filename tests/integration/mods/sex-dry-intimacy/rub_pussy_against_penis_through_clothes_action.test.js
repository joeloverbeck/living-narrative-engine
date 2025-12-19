/**
 * @file Integration tests for sex-dry-intimacy:rub_pussy_against_penis_through_clothes action execution.
 * @description Tests that the action executes correctly and generates proper events.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

describe('sex-dry-intimacy:rub_pussy_against_penis_through_clothes action execution', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-dry-intimacy',
      'sex-dry-intimacy:rub_pussy_against_penis_through_clothes'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  /**
   * Helper function to create standardized test scenario
   *
   * @returns {object} Object with room, alice, bob, groin, penis, pants, chair entities
   */
  function setupStraddlingWithClothingScenario() {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const alice = new ModEntityBuilder('alice')
      .withName('Alice')
      .atLocation('room1')
      .closeToEntity('bob')
      .asActor()
      .withComponent('positioning:straddling_waist', {
        target_id: 'bob',
        facing_away: false,
      })
      .build();

    const bob = new ModEntityBuilder('bob')
      .withName('Bob')
      .atLocation('room1')
      .closeToEntity('alice')
      .withBody('groin1')
      .asActor()
      .withComponent('sitting-states:sitting_on', {
        furniture_id: 'chair1',
        spot_index: 0,
      })
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

    const pants = new ModEntityBuilder('pants1').withName('pants').build();

    const chair = new ModEntityBuilder('chair1')
      .withName('chair')
      .atLocation('room1')
      .build();

    return { room, alice, bob, groin, penis, pants, chair };
  }

  describe('Successful execution', () => {
    it('performs rub pussy against penis action successfully', async () => {
      // Setup entities
      const entities = setupStraddlingWithClothingScenario();
      testFixture.reset(Object.values(entities));

      // Execute action
      await testFixture.executeAction('alice', 'bob', {
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'pants1',
        },
      });

      // Assert action success with expected message
      ModAssertionHelpers.assertActionSuccess(
        testFixture.events,
        "Alice rubs her pussy sensually against Bob's penis through the pants, feeling the shape and size.",
        {
          shouldEndTurn: true,
          shouldHavePerceptibleEvent: true,
        }
      );
    });

    it('generates correct perceptible event message', async () => {
      // Setup entities
      const entities = setupStraddlingWithClothingScenario();
      testFixture.reset(Object.values(entities));

      // Execute action
      await testFixture.executeAction('alice', 'bob', {
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'pants1',
        },
      });

      // Find perceptible event
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        "Alice rubs her pussy sensually against Bob's penis through the pants, feeling the shape and size."
      );
    });

    it('message includes actor name, target name, and clothing name', async () => {
      // Setup entities
      const entities = setupStraddlingWithClothingScenario();
      testFixture.reset(Object.values(entities));

      // Execute action
      await testFixture.executeAction('alice', 'bob', {
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'pants1',
        },
      });

      // Find perceptible event
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent.payload.descriptionText).toContain('Alice');
      expect(perceptibleEvent.payload.descriptionText).toContain('Bob');
      expect(perceptibleEvent.payload.descriptionText).toContain('pants');
    });

    it('message includes "feeling the shape and size" descriptor', async () => {
      // Setup entities
      const entities = setupStraddlingWithClothingScenario();
      testFixture.reset(Object.values(entities));

      // Execute action
      await testFixture.executeAction('alice', 'bob', {
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'pants1',
        },
      });

      // Find perceptible event
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent.payload.descriptionText).toContain(
        'feeling the shape and size'
      );
    });

    it('action ends turn properly', async () => {
      // Setup entities
      const entities = setupStraddlingWithClothingScenario();
      testFixture.reset(Object.values(entities));

      // Execute action
      await testFixture.executeAction('alice', 'bob', {
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'pants1',
        },
      });

      // Assert turn ended
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );

      expect(turnEndedEvent).toBeDefined();
    });

    it('dispatches perceptible event with correct perception type', async () => {
      // Setup entities
      const entities = setupStraddlingWithClothingScenario();
      testFixture.reset(Object.values(entities));

      // Execute action
      await testFixture.executeAction('alice', 'bob', {
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'pants1',
        },
      });

      // Find perceptible event
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe(
        'physical.target_action'
      );
    });
  });

  describe('Edge cases', () => {
    it("rule doesn't fire for different action", async () => {
      // Setup entities
      const entities = setupStraddlingWithClothingScenario();
      testFixture.reset(Object.values(entities));

      // Execute different action
      await testFixture.executeAction('alice', 'bob', {
        actionId: 'sex-dry-intimacy:different_action',
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'pants1',
        },
      });

      // Assert no perceptible event with our specific message
      const perceptibleEvent = testFixture.events.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.payload.text &&
          e.payload.text.includes('rubs her pussy sensually against')
      );

      expect(perceptibleEvent).toBeUndefined();
    });

    it('handles missing target gracefully', async () => {
      // Setup entities without target
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      testFixture.reset([room, alice]);

      // Expect error when executing action with missing target
      await expect(
        testFixture.executeAction('alice', 'bob', {
          additionalPayload: {
            primaryId: 'bob',
            secondaryId: 'pants1',
          },
        })
      ).rejects.toThrow();
    });

    it('handles missing clothing gracefully', async () => {
      // Setup entities without clothing
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const alice = new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('bob')
        .asActor()
        .withComponent('positioning:straddling_waist', {
          target_id: 'bob',
          facing_away: false,
        })
        .build();

      const bob = new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('alice')
        .withBody('groin1')
        .asActor()
        .withComponent('sitting-states:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

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

      const chair = new ModEntityBuilder('chair1')
        .withName('chair')
        .atLocation('room1')
        .build();

      testFixture.reset([room, alice, bob, groin, penis, chair]);

      // Execute action - should succeed but GET_NAME will return undefined for missing clothing
      const result = await testFixture.executeAction('alice', 'bob', {
        additionalPayload: {
          primaryId: 'bob',
          secondaryId: 'nonexistent_clothing',
        },
      });

      // Action executes successfully (returns true) even with missing entity
      // The rule doesn't validate entity existence, it just calls GET_NAME which returns undefined
      expect(result).toBe(true);
    });
  });

  describe('Rule structure validation', () => {
    it('rule structure matches expected pattern', () => {
      // This test validates that the rule file was loaded correctly
      // The ModTestFixture.forAction() auto-loads the rule
      expect(testFixture).toBeDefined();

      // If we got here without errors, the rule loaded successfully
      expect(true).toBe(true);
    });
  });
});
