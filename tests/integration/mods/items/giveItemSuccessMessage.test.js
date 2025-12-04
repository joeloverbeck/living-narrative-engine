/**
 * @file Integration tests for give_item action success message display.
 * @description Verifies that the give_item action dispatches the correct
 * display_successful_action_result event and uses present tense "gives".
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import giveItemRule from '../../../../data/mods/item-transfer/rules/handle_give_item.rule.json' assert { type: 'json' };
import eventIsActionGiveItem from '../../../../data/mods/item-transfer/conditions/event-is-action-give-item.condition.json' assert { type: 'json' };

/**
 * Creates a standardized give item scenario.
 *
 * @param {string} actorName - Name for the giver
 * @param {string} targetName - Name for the recipient
 * @param {string} itemName - Name for the item
 * @param {string} locationId - Location for the scenario
 * @returns {object} Object with room, actor, target, and item entities
 */
function setupGiveItemScenario(
  actorName = 'Alice',
  targetName = 'Bob',
  itemName = 'letter',
  locationId = 'saloon1'
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: ['test-item'],
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const target = new ModEntityBuilder('test:actor2')
    .withName(targetName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: [],
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const item = new ModEntityBuilder('test-item')
    .withName(itemName)
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('core:weight', { weight: 0.05 })
    .build();

  return { room, actor, target, item };
}

describe('item-transfer:give_item success message display', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'item-transfer',
      'item-transfer:give_item',
      giveItemRule,
      eventIsActionGiveItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('success message display', () => {
    it('should dispatch core:display_successful_action_result event', async () => {
      // Arrange
      const scenario = setupGiveItemScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify the success message event was dispatched
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );

      expect(successEvent).toBeDefined();
      expect(successEvent.payload).toBeDefined();
      expect(successEvent.payload.message).toBeDefined();
    });

    it('should use present tense "gives" not past tense "gave"', async () => {
      // Arrange
      const scenario = setupGiveItemScenario('Jon Ureña', 'Alicia', 'yellowed goodbye letter');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify present tense usage
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );

      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toContain('gives');
      expect(successEvent.payload.message).not.toContain('gave');
    });

    it('should include actor, item, and target names in success message', async () => {
      // Arrange
      const scenario = setupGiveItemScenario('Sarah', 'James', 'mysterious note');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify message contains all relevant names
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );

      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toContain('Sarah');
      expect(successEvent.payload.message).toContain('James');
      expect(successEvent.payload.message).toContain('mysterious note');
    });
  });

  describe('consistency with other item actions', () => {
    it('should dispatch both perceptible_event and display_successful_action_result', async () => {
      // Arrange
      const scenario = setupGiveItemScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Both events should be present (like drop_item and pick_up_item)
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(successEvent).toBeDefined();
    });

    it('should match message format between perceptible_event and display_successful_action_result', async () => {
      // Arrange
      const scenario = setupGiveItemScenario('Diana', 'Victor', 'ancient scroll');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Both messages should be identical (consistent with macro behavior)
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(successEvent).toBeDefined();

      const perceptibleMessage = perceptibleEvent.payload.descriptionText;
      const successMessage = successEvent.payload.message;

      // Messages should match exactly (both come from the same logMessage variable)
      expect(successMessage).toBe(perceptibleMessage);
    });
  });

  describe('specific message format', () => {
    it('should format message as "ActorName gives ItemName to TargetName."', async () => {
      // Arrange
      const scenario = setupGiveItemScenario('Jon Ureña', 'Alicia Western', 'yellowed goodbye letter');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify exact message format
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );

      expect(successEvent).toBeDefined();
      // Expected format: "Jon Ureña gives yellowed goodbye letter to Alicia Western."
      expect(successEvent.payload.message).toMatch(
        /^Jon Ureña gives yellowed goodbye letter to Alicia Western\.$/
      );
    });
  });

  describe('item_transferred event dispatch', () => {
    it('should dispatch items:item_transferred event on successful transfer', async () => {
      // Arrange
      const scenario = setupGiveItemScenario('Alice', 'Bob', 'letter');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify items:item_transferred event was dispatched
      const itemTransferredEvent = testFixture.events.find(
        (e) => e.eventType === 'items:item_transferred'
      );

      expect(itemTransferredEvent).toBeDefined();
      expect(itemTransferredEvent.payload).toEqual({
        fromEntity: 'test:actor1',
        toEntity: 'test:actor2',
        itemEntity: 'test-item',
      });
    });

    it('should not dispatch unnamespaced ITEM_TRANSFERRED event', async () => {
      // Arrange
      const scenario = setupGiveItemScenario('Charlie', 'Dana', 'coin');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify no unnamespaced ITEM_TRANSFERRED event exists
      const unnamespacedEvent = testFixture.events.find(
        (e) => e.eventType === 'ITEM_TRANSFERRED'
      );

      expect(unnamespacedEvent).toBeUndefined();
    });

    it('should complete transfer without errors or warnings', async () => {
      // Arrange
      const scenario = setupGiveItemScenario('Eve', 'Frank', 'book');
      testFixture.reset([scenario.room, scenario.actor, scenario.target, scenario.item]);

      // Act
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify no error events
      const errorEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' ||
          e.eventType === 'core:display_error'
      );

      expect(errorEvents).toHaveLength(0);

      // Assert: Verify transfer succeeded
      const targetEntity = testFixture.entityManager.getEntityInstance('test:actor2');
      expect(targetEntity.components['items:inventory'].items).toContain('test-item');

      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });
  });
});
