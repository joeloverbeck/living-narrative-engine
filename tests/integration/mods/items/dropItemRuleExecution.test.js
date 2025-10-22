/**
 * @file Integration tests for the items:drop_item action and rule.
 * @description Tests the rule execution after the drop_item action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import '../../../common/mods/domainMatchers.js';
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('items:drop_item action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful drop operations', () => {
    it('successfully executes drop item action', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: {
          id: 'test:actor1',
          name: 'Alice',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        item: {
          id: 'letter-1',
          name: 'letter-1',
          weight: 0.05,
        },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });

      const item = testFixture.entityManager.getEntityInstance(
        scenario.item.id
      );
      expect(item).toHaveComponent('core:position');
      expect(item).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });

      expect(testFixture.events).toDispatchEvent('items:item_dropped');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');
      expect(testFixture.events).toHaveActionSuccess('Alice drops letter-1.');

      const itemDroppedEvent = testFixture.events.find(
        (event) => event.eventType === 'items:item_dropped'
      );
      expect(itemDroppedEvent?.payload.actorEntity).toBe(scenario.actor.id);
      expect(itemDroppedEvent?.payload.itemEntity).toBe(scenario.item.id);
      expect(itemDroppedEvent?.payload.locationId).toBe(scenario.room.id);
    });

    it('removes item from inventory and preserves capacity settings', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'garden',
        roomName: 'Garden',
        actor: {
          id: 'test:actor1',
          name: 'Sarah',
        },
        item: { id: 'revolver-1', name: 'revolver-1', weight: 1.2 },
        capacity: { maxWeight: 50, maxItems: 10 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      });
    });

    it('drops multiple items sequentially', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'tavern',
        roomName: 'Tavern',
        actor: {
          id: 'test:actor1',
          name: 'Bob',
        },
        item: { id: 'item1', name: 'item1', weight: 0.5 },
        additionalInventoryItems: [
          { id: 'item2', name: 'item2', weight: 0.3 },
          { id: 'item3', name: 'item3', weight: 0.2 },
        ],
        capacity: { maxWeight: 50, maxItems: 10 },
      });

      testFixture.reset([...scenario.entities]);

      const [secondItem, thirdItem] = scenario.additionalInventoryItems;

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);
      let actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('items:inventory', {
        items: [secondItem.id, thirdItem.id],
      });

      let dropped = testFixture.entityManager.getEntityInstance(
        scenario.item.id
      );
      expect(dropped).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });

      await testFixture.executeAction(scenario.actor.id, secondItem.id);
      actor = testFixture.entityManager.getEntityInstance(scenario.actor.id);
      expect(actor).toHaveComponentData('items:inventory', {
        items: [thirdItem.id],
      });

      dropped = testFixture.entityManager.getEntityInstance(secondItem.id);
      expect(dropped).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });

      await testFixture.executeAction(scenario.actor.id, thirdItem.id);
      actor = testFixture.entityManager.getEntityInstance(scenario.actor.id);
      expect(actor).toHaveComponentData('items:inventory', {
        items: [],
      });

      dropped = testFixture.entityManager.getEntityInstance(thirdItem.id);
      expect(dropped).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });
    });
  });

  describe('perception logging', () => {
    it('creates perception log entry when item dropped', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: { id: 'test:actor1', name: 'Alice' },
        item: { id: 'letter-1', name: 'letter-1', weight: 0.05 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      expect(testFixture.events).toDispatchEvent('core:perceptible_event');

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent?.payload.locationId).toBe(scenario.room.id);
      expect(perceptibleEvent?.payload.perceptionType).toBe('item_dropped');
      expect(perceptibleEvent?.payload.actorId).toBe(scenario.actor.id);
      expect(perceptibleEvent?.payload.targetId).toBe(scenario.item.id);
      expect(perceptibleEvent?.payload.involvedEntities).toEqual([]);
    });

    it('includes correct description in perception log', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'kitchen',
        roomName: 'Kitchen',
        actor: { id: 'test:actor1', name: 'Charlie' },
        item: { id: 'golden-watch', name: 'golden-watch', weight: 0.1 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const perceptibleEvent = testFixture.events.find(
        (event) => event.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent?.payload.descriptionText).toContain('Charlie');
      expect(perceptibleEvent?.payload.descriptionText).toContain('drops');
      expect(perceptibleEvent?.payload.descriptionText).toContain(
        'golden-watch'
      );
    });
  });

  describe('error scenarios', () => {
    it('handles error when item not in inventory', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: {
          id: 'test:actor1',
          name: 'Alice',
          inventoryOverrides: { items: [] },
        },
        item: { id: 'not-in-inventory', name: 'NotInInventory', weight: 0.5 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      expect(testFixture.events).toDispatchEvent('core:turn_ended');

      const actor = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actor).toHaveComponentData('items:inventory', { items: [] });
    });
  });

  describe('Drop Item - Additional Edge Cases', () => {
    it('should handle dropping last item from inventory', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'saloon1',
        roomName: 'Saloon',
        actor: {
          id: 'test:actor1',
          name: 'Alice',
          capacity: { maxWeight: 50, maxItems: 10 },
        },
        item: { id: 'item-1', name: 'item-1', weight: 0.5 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const actorAfter = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorAfter).toHaveComponentData('items:inventory', { items: [] });
    });

    it('should create position component with correct locationId', async () => {
      const scenario = testFixture.createDropItemScenario({
        roomId: 'tavern',
        roomName: 'Tavern',
        actor: { id: 'test:actor1', name: 'Bob' },
        item: { id: 'letter-1', name: 'Letter', weight: 0.05 },
      });

      testFixture.reset([...scenario.entities]);

      await testFixture.executeAction(scenario.actor.id, scenario.item.id);

      const itemAfter = testFixture.entityManager.getEntityInstance(
        scenario.item.id
      );
      expect(itemAfter).toHaveComponent('core:position');
      expect(itemAfter).toHaveComponentData('core:position', {
        locationId: scenario.room.id,
      });
    });
  });
});
