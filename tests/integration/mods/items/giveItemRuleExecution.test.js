/**
 * @file Integration tests for the item-transfer:give_item action and rule.
 * @description Tests the rule execution after the give_item action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import giveItemRule from '../../../../data/mods/item-transfer/rules/handle_give_item.rule.json' assert { type: 'json' };
import eventIsActionGiveItem from '../../../../data/mods/item-transfer/conditions/event-is-action-give-item.condition.json' assert { type: 'json' };

describe('item-transfer:give_item action integration', () => {
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

  describe('successful transfers', () => {
    it('successfully executes give item action between actors with capacity', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'saloon1',
        roomName: 'Saloon',
        giver: {
          id: 'test:actor1',
          name: 'Alice',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        receiver: {
          id: 'test:actor2',
          name: 'Bob',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        item: { id: 'letter-1', name: 'letter-1', weight: 0.05 },
      });

      testFixture.reset(scenario.entities);

      await testFixture.executeAction(scenario.giver.id, scenario.receiver.id, {
        additionalPayload: { secondaryId: scenario.transferItem.id },
      });

      const updatedGiver = testFixture.entityManager.getEntityInstance(
        scenario.giver.id
      );
      const updatedReceiver = testFixture.entityManager.getEntityInstance(
        scenario.receiver.id
      );

      expect(testFixture.events).toHaveActionSuccess(
        'Alice gives letter-1 to Bob.'
      );
      expect(updatedGiver.components['items:inventory'].items).toEqual(
        scenario.giverItems.map((item) => item.id)
      );
      expect(updatedReceiver.components['items:inventory'].items).toEqual([
        ...scenario.receiverItems.map((item) => item.id),
        scenario.transferItem.id,
      ]);

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('transfers item and preserves capacity settings', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'garden',
        roomName: 'Garden',
        giver: {
          id: 'test:actor1',
          name: 'Sarah',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        receiver: {
          id: 'test:actor2',
          name: 'James',
          capacity: { maxWeight: 30, maxItems: 5 },
        },
        item: { id: 'revolver-1', name: 'revolver-1', weight: 1.2 },
      });

      testFixture.reset(scenario.entities);

      await testFixture.executeAction(scenario.giver.id, scenario.receiver.id, {
        additionalPayload: { secondaryId: scenario.transferItem.id },
      });

      const updatedGiver = testFixture.entityManager.getEntityInstance(
        scenario.giver.id
      );
      const updatedReceiver = testFixture.entityManager.getEntityInstance(
        scenario.receiver.id
      );

      expect(testFixture.events).toHaveActionSuccess(
        'Sarah gives revolver-1 to James.'
      );
      expect(updatedGiver.components['items:inventory'].items).toEqual(
        scenario.giverItems.map((item) => item.id)
      );
      expect(updatedReceiver.components['items:inventory'].items).toEqual([
        ...scenario.receiverItems.map((item) => item.id),
        scenario.transferItem.id,
      ]);
      expect(updatedGiver.components['items:inventory'].capacity).toEqual({
        maxWeight: 50,
        maxItems: 10,
      });
      expect(updatedReceiver.components['items:inventory'].capacity).toEqual({
        maxWeight: 30,
        maxItems: 5,
      });
    });
  });

  describe('capacity failure scenarios', () => {
    it('fails when recipient inventory full (item count)', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'saloon1',
        roomName: 'Saloon',
        giver: {
          id: 'test:actor1',
          name: 'Alice',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        receiver: {
          id: 'test:actor2',
          name: 'Bob',
          capacity: { maxWeight: 50, maxItems: 2 },
        },
        item: { id: 'letter-1', name: 'letter-1', weight: 0.05 },
        receiverItems: [
          { id: 'item-1', name: 'item-1', weight: 0.1 },
          { id: 'item-2', name: 'item-2', weight: 0.1 },
        ],
      });

      testFixture.reset(scenario.entities);

      await testFixture.executeAction(scenario.giver.id, scenario.receiver.id, {
        additionalPayload: { secondaryId: scenario.transferItem.id },
      });

      expect(testFixture.events).toHaveActionFailure();

      const failureEvent = testFixture.events.find(
        (event) => event.eventType === 'core:display_failed_action_result'
      );

      expect(failureEvent).toBeDefined();
      expect(failureEvent.payload.message).toContain('max_items_exceeded');

      const updatedGiver = testFixture.entityManager.getEntityInstance(
        scenario.giver.id
      );
      const updatedReceiver = testFixture.entityManager.getEntityInstance(
        scenario.receiver.id
      );

      expect(updatedGiver.components['items:inventory'].items).toContain(
        scenario.transferItem.id
      );
      expect(updatedReceiver.components['items:inventory'].items).toEqual(
        scenario.receiverItems.map((item) => item.id)
      );
    });

    it('fails when item too heavy for recipient', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'saloon1',
        roomName: 'Saloon',
        giver: {
          id: 'test:actor1',
          name: 'Alice',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        receiver: {
          id: 'test:actor2',
          name: 'Bob',
          capacity: { maxWeight: 5, maxItems: 10 },
        },
        item: { id: 'gold-bar-1', name: 'gold-bar-1', weight: 12.4 },
      });

      testFixture.reset(scenario.entities);

      await testFixture.executeAction(scenario.giver.id, scenario.receiver.id, {
        additionalPayload: { secondaryId: scenario.transferItem.id },
      });

      expect(testFixture.events).toHaveActionFailure();

      const failureEvent = testFixture.events.find(
        (event) => event.eventType === 'core:display_failed_action_result'
      );

      expect(failureEvent).toBeDefined();
      expect(failureEvent.payload.message).toContain('max_weight_exceeded');

      const updatedGiver = testFixture.entityManager.getEntityInstance(
        scenario.giver.id
      );
      expect(updatedGiver.components['items:inventory'].items).toContain(
        scenario.transferItem.id
      );
    });
  });

  describe('perception logging', () => {
    it('dispatches perceptible event on successful transfer', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'bedroom',
        roomName: 'Bedroom',
        giver: { id: 'test:actor1', name: 'Elena' },
        receiver: { id: 'test:actor2', name: 'Marcus' },
        item: { id: 'letter-1', name: 'letter-1', weight: 0.05 },
      });

      testFixture.reset(scenario.entities);

      await testFixture.executeAction(scenario.giver.id, scenario.receiver.id, {
        additionalPayload: { secondaryId: scenario.transferItem.id },
      });

      expect(testFixture.events).toHaveActionSuccess(
        'Elena gives letter-1 to Marcus.'
      );
      expect(testFixture.events).toDispatchEvent('core:perceptible_event');

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe('item_transfer');
      expect(perceptibleEvent.payload.locationId).toBe(scenario.room.id);
      expect(perceptibleEvent.payload.descriptionText).toContain('gives');
      expect(perceptibleEvent.payload.descriptionText).toContain(
        scenario.transferItem.id
      );
    });

    it('validates perceptible event message matches action success message', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'library',
        roomName: 'Library',
        giver: { id: 'test:actor1', name: 'Diana' },
        receiver: { id: 'test:actor2', name: 'Victor' },
        item: { id: 'book-1', name: 'book-1', weight: 0.5 },
      });

      testFixture.reset(scenario.entities);

      await testFixture.executeAction(scenario.giver.id, scenario.receiver.id, {
        additionalPayload: { secondaryId: scenario.transferItem.id },
      });

      expect(testFixture.events).toHaveActionSuccess(
        'Diana gives book-1 to Victor.'
      );

      const successEvent = testFixture.events.find(
        (event) => event.eventType === 'core:display_successful_action_result'
      );
      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(successEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        successEvent.payload.message
      );
      expect(perceptibleEvent.payload.descriptionText).toContain(
        scenario.transferItem.id
      );
    });
  });

  describe('turn management', () => {
    it('ends turn after successful action execution', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'saloon1',
        roomName: 'Saloon',
        giver: { id: 'test:actor1', name: 'Alice' },
        receiver: { id: 'test:actor2', name: 'Bob' },
        item: { id: 'letter-1', name: 'letter-1', weight: 0.05 },
      });

      testFixture.reset(scenario.entities);

      await testFixture.executeAction(scenario.giver.id, scenario.receiver.id, {
        additionalPayload: { secondaryId: scenario.transferItem.id },
      });

      expect(testFixture.events).toHaveActionSuccess(
        'Alice gives letter-1 to Bob.'
      );
      expect(testFixture.events).toDispatchEvent('core:turn_ended');

      const endTurnEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );

      expect(endTurnEvent).toBeDefined();
      expect(endTurnEvent.payload.entityId).toBe(scenario.giver.id);
      expect(endTurnEvent.payload.success).toBe(true);
    });
  });

  describe('action only fires for correct action ID', () => {
    it('does not fire for different action IDs', async () => {
      const scenario = testFixture.createInventoryTransfer({
        roomId: 'saloon1',
        roomName: 'Saloon',
        giver: { id: 'test:actor1', name: 'Alice' },
        receiver: { id: 'test:actor2', name: 'Bob' },
        item: { id: 'letter-1', name: 'letter-1', weight: 0.05 },
      });

      testFixture.reset(scenario.entities);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.giver.id,
        actionId: 'kissing:kiss_cheek',
        targetId: scenario.receiver.id,
        originalInput: 'kiss_cheek target',
      });

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });
});
