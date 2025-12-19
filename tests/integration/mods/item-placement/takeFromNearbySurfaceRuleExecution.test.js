/**
 * @file Integration tests for the item-placement:take_from_nearby_surface action and rule.
 * @description Tests the rule execution after the take_from_nearby_surface action is performed.
 * This action allows a seated actor to take items from containers on nearby furniture.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import takeFromNearbySurfaceRule from '../../../../data/mods/item-placement/rules/handle_take_from_nearby_surface.rule.json' assert { type: 'json' };
import eventIsActionTakeFromNearbySurface from '../../../../data/mods/item-placement/conditions/event-is-action-take-from-nearby-surface.condition.json' assert { type: 'json' };

/**
 * Creates a standardized seated container interaction scenario.
 *
 * @param {object} options - Scenario configuration options
 * @param {string} [options.actorName='Alice'] - Name for the actor
 * @param {string} [options.locationId='tavern'] - Location for the scenario
 * @param {string} [options.furnitureId='stool-1'] - ID for the furniture actor sits on
 * @param {string} [options.nearbyFurnitureId='table-1'] - ID for nearby furniture with container
 * @param {string} [options.containerId='bowl-1'] - ID for the container on nearby furniture
 * @param {Array<string>} [options.containerContents=['apple-1']] - Items inside the container
 * @param {boolean} [options.isOpen=true] - Whether container is open
 * @param {Array<string>} [options.actorInventory=[]] - Items actor already has
 * @param {number} [options.maxItems=10] - Max items in actor's inventory
 * @param {number} [options.maxWeight=50] - Max weight in actor's inventory
 * @returns {object} Object with room, actor, furniture, nearbyFurniture, container, and item entities
 */
function setupSeatedContainerScenario({
  actorName = 'Alice',
  locationId = 'tavern',
  furnitureId = 'stool-1',
  nearbyFurnitureId = 'table-1',
  containerId = 'bowl-1',
  containerContents = ['apple-1'],
  isOpen = true,
  actorInventory = [],
  maxItems = 10,
  maxWeight = 50,
} = {}) {
  const room = new ModEntityBuilder(locationId).asRoom('Tavern').build();

  const furniture = new ModEntityBuilder(furnitureId)
    .withName('Wooden Stool')
    .atLocation(locationId)
    .withComponent('furniture:seating', { capacity: 1 })
    .withComponent('furniture:near_furniture', {
      nearbyFurniture: [nearbyFurnitureId],
    })
    .build();

  const nearbyFurniture = new ModEntityBuilder(nearbyFurnitureId)
    .withName('Rustic Table')
    .atLocation(locationId)
    .withComponent('furniture:surface', { capacity: 10 })
    .build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: actorInventory,
      capacity: { maxWeight, maxItems },
    })
    .withComponent('sitting-states:sitting_on', { furniture_id: furnitureId })
    .withComponent('anatomy:appendages', {
      appendages: [
        { id: 'left_hand', type: 'hand', isGrabbing: false },
        { id: 'right_hand', type: 'hand', isGrabbing: false },
      ],
    })
    .build();

  const container = new ModEntityBuilder(containerId)
    .withName('Wooden Bowl')
    .atLocation(locationId)
    .withComponent('containers-core:container', {
      contents: containerContents,
      capacity: { maxWeight: 20, maxItems: 10 },
      isOpen,
    })
    .withComponent('items:openable', {})
    .withComponent('furniture:on_furniture', { furnitureId: nearbyFurnitureId })
    .build();

  // Create actual item entities for each item in the container
  const itemEntities = containerContents.map((itemId) =>
    new ModEntityBuilder(itemId)
      .withName(itemId.replace('-1', '').replace('-', ' '))
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.5 })
      .build()
  );

  return {
    room,
    actor,
    furniture,
    nearbyFurniture,
    container,
    items: itemEntities,
  };
}

describe('item-placement:take_from_nearby_surface action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'item-placement',
      'item-placement:take_from_nearby_surface',
      takeFromNearbySurfaceRule,
      eventIsActionTakeFromNearbySurface
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful take operations', () => {
    it('successfully executes take from nearby surface action', async () => {
      // Arrange: Setup scenario with seated actor near open container
      const scenario = setupSeatedContainerScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      // Act: Take item from container on nearby surface
      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });

      // Assert: Verify item removed from container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['containers-core:container'].contents).toEqual([]);

      // Assert: Verify item added to actor inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('apple-1');

      // Assert: Verify success event dispatched
      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toContain('Alice');
      expect(successEvent.payload.message).toContain('apple');

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('dispatches item_taken_from_nearby_surface event', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Bob',
        containerId: 'tray-1',
        containerContents: ['goblet-1', 'bread-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'tray-1', {
        additionalPayload: {
          secondaryId: 'goblet-1',
        },
      });

      // Find the item_taken_from_nearby_surface perceptible event
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      const takenEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'container.take'
      );
      expect(takenEvent).toBeDefined();
      expect(takenEvent.payload.actorId).toBe('test:actor1');
      expect(takenEvent.payload.targetId).toBe('tray-1');
    });

    it('successfully takes last item from container', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Charlie',
        containerContents: ['coin-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'coin-1',
        },
      });

      // Verify container now empty
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['containers-core:container'].contents).toEqual([]);

      // Verify item in actor inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toEqual(['coin-1']);
    });

    it('successfully takes multiple items sequentially', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Dave',
        containerContents: ['diamond-1', 'ruby-1', 'emerald-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      // Take first item
      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'diamond-1',
        },
      });
      let actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('diamond-1');

      // Take second item
      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'ruby-1',
        },
      });
      actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('ruby-1');

      // Verify container has only one item left
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['containers-core:container'].contents).toEqual([
        'emerald-1',
      ]);
    });
  });

  describe('inventory capacity validation', () => {
    it('prevents taking item when inventory is at max items capacity', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Eve',
        containerContents: ['sword-1'],
        actorInventory: ['item1', 'item2'],
        maxItems: 2,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'sword-1',
        },
      });

      // Verify item NOT removed from container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['containers-core:container'].contents).toContain(
        'sword-1'
      );

      // Verify item NOT added to inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain(
        'sword-1'
      );

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);
    });

    it('allows taking item when inventory has space', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Frank',
        containerContents: ['potion-1'],
        actorInventory: ['torch-1'],
        maxItems: 5,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'potion-1',
        },
      });

      // Verify successful take
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('potion-1');
    });
  });

  describe('container state validation', () => {
    it('prevents taking from closed container', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Grace',
        containerContents: ['book-1'],
        isOpen: false,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'book-1',
        },
      });

      // Verify item NOT removed from container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['containers-core:container'].contents).toContain(
        'book-1'
      );

      // Verify item NOT in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain('book-1');
    });

    it('prevents taking item not in container', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Helen',
        containerContents: ['diary-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'nonexistent-item',
        },
      });

      // Verify container unchanged
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['containers-core:container'].contents).toEqual([
        'diary-1',
      ]);

      // Verify item NOT in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain(
        'nonexistent-item'
      );
    });
  });

  describe('perception logging', () => {
    it('creates perception log for successful item taken', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Ivan',
        locationId: 'warehouse',
        containerContents: ['hammer-1', 'wrench-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'hammer-1',
        },
      });

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const takenEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'container.take'
      );
      expect(takenEvent).toBeDefined();
      expect(takenEvent.payload.locationId).toBe('warehouse');
      expect(takenEvent.payload.actorId).toBe('test:actor1');
      expect(takenEvent.payload.targetId).toBe('bowl-1');
    });

    it('creates perception log for failed take due to capacity', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Jack',
        locationId: 'cellar',
        containerContents: ['wine-1'],
        actorInventory: ['item1', 'item2', 'item3'],
        maxItems: 3,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'wine-1',
        },
      });

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const failedEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'error.action_failed'
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.payload.locationId).toBe('cellar');
      expect(failedEvent.payload.contextualData.reason).toBe(
        'max_items_exceeded'
      );
    });
  });

  describe('seated positioning', () => {
    it('maintains seated state after taking item', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Kate',
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });

      // Verify actor still seated
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['sitting-states:sitting_on']).toBeDefined();
      expect(actor.components['sitting-states:sitting_on'].furniture_id).toBe(
        'stool-1'
      );
    });

    it('preserves furniture relationships after taking item', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Larry',
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });

      // Verify furniture near_furniture relationship preserved
      const furniture =
        testFixture.entityManager.getEntityInstance('stool-1');
      expect(
        furniture.components['furniture:near_furniture'].nearbyFurniture
      ).toContain('table-1');

      // Verify container still on furniture
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(
        container.components['furniture:on_furniture'].furnitureId
      ).toBe('table-1');
    });
  });

  describe('edge cases', () => {
    it('handles multiple actors taking from same nearby surface', async () => {
      const room = new ModEntityBuilder('inn')
        .asRoom('The Golden Inn')
        .build();

      const stool1 = new ModEntityBuilder('stool-1')
        .withName('Wooden Stool')
        .atLocation('inn')
        .withComponent('furniture:seating', { capacity: 1 })
        .withComponent('furniture:near_furniture', {
          nearbyFurniture: ['shared-table'],
        })
        .build();

      const stool2 = new ModEntityBuilder('stool-2')
        .withName('Wooden Stool')
        .atLocation('inn')
        .withComponent('furniture:seating', { capacity: 1 })
        .withComponent('furniture:near_furniture', {
          nearbyFurniture: ['shared-table'],
        })
        .build();

      const sharedTable = new ModEntityBuilder('shared-table')
        .withName('Shared Table')
        .atLocation('inn')
        .withComponent('furniture:surface', { capacity: 10 })
        .build();

      const actor1 = new ModEntityBuilder('actor-1')
        .withName('Mary')
        .atLocation('inn')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('sitting-states:sitting_on', { furniture_id: 'stool-1' })
        .withComponent('anatomy:appendages', {
          appendages: [
            { id: 'left_hand', type: 'hand', isGrabbing: false },
            { id: 'right_hand', type: 'hand', isGrabbing: false },
          ],
        })
        .build();

      const actor2 = new ModEntityBuilder('actor-2')
        .withName('Nancy')
        .atLocation('inn')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('sitting-states:sitting_on', { furniture_id: 'stool-2' })
        .withComponent('anatomy:appendages', {
          appendages: [
            { id: 'left_hand', type: 'hand', isGrabbing: false },
            { id: 'right_hand', type: 'hand', isGrabbing: false },
          ],
        })
        .build();

      const sharedBowl = new ModEntityBuilder('shared-bowl')
        .withName('Shared Bowl')
        .atLocation('inn')
        .withComponent('containers-core:container', {
          contents: ['apple-1', 'bread-1'],
          capacity: { maxWeight: 20, maxItems: 10 },
          isOpen: true,
        })
        .withComponent('items:openable', {})
        .withComponent('furniture:on_furniture', { furnitureId: 'shared-table' })
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('Apple')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      const bread = new ModEntityBuilder('bread-1')
        .withName('Bread')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      testFixture.reset([
        room,
        stool1,
        stool2,
        sharedTable,
        actor1,
        actor2,
        sharedBowl,
        apple,
        bread,
      ]);

      // Actor 1 takes apple
      await testFixture.executeAction('actor-1', 'shared-bowl', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });
      const actor1After =
        testFixture.entityManager.getEntityInstance('actor-1');
      expect(actor1After.components['items:inventory'].items).toContain(
        'apple-1'
      );

      // Actor 2 takes bread
      await testFixture.executeAction('actor-2', 'shared-bowl', {
        additionalPayload: {
          secondaryId: 'bread-1',
        },
      });
      const actor2After =
        testFixture.entityManager.getEntityInstance('actor-2');
      expect(actor2After.components['items:inventory'].items).toContain(
        'bread-1'
      );

      // Verify container now empty
      const containerAfter =
        testFixture.entityManager.getEntityInstance('shared-bowl');
      expect(containerAfter.components['containers-core:container'].contents).toEqual([]);
    });

    it('preserves container components after taking item', async () => {
      const scenario = setupSeatedContainerScenario({
        actorName: 'Oscar',
        containerContents: ['silk-1', 'spice-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'silk-1',
        },
      });

      const container = testFixture.entityManager.getEntityInstance('bowl-1');

      // Verify all components intact
      expect(container.components['items:openable']).toBeDefined();
      expect(container.components['containers-core:container']).toBeDefined();
      expect(container.components['core:position']).toBeDefined();
      expect(container.components['furniture:on_furniture']).toBeDefined();

      // Verify open state preserved
      expect(container.components['containers-core:container'].isOpen).toBe(true);
    });
  });
});
