/**
 * @file Integration tests for the furniture:put_on_nearby_surface action and rule.
 * @description Tests the rule execution after the put_on_nearby_surface action is performed.
 * This action allows a seated actor to put items from their inventory onto containers on nearby furniture.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import putOnNearbySurfaceRule from '../../../../data/mods/furniture/rules/handle_put_on_nearby_surface.rule.json' assert { type: 'json' };
import eventIsActionPutOnNearbySurface from '../../../../data/mods/furniture/conditions/event-is-action-put-on-nearby-surface.condition.json' assert { type: 'json' };

/**
 * Creates a standardized seated container interaction scenario for putting items.
 *
 * @param {object} options - Scenario configuration options
 * @param {string} [options.actorName='Alice'] - Name for the actor
 * @param {string} [options.locationId='tavern'] - Location for the scenario
 * @param {string} [options.furnitureId='stool-1'] - ID for the furniture actor sits on
 * @param {string} [options.nearbyFurnitureId='table-1'] - ID for nearby furniture with container
 * @param {string} [options.containerId='bowl-1'] - ID for the container on nearby furniture
 * @param {Array<string>} [options.containerContents=[]] - Items already inside the container
 * @param {boolean} [options.isOpen=true] - Whether container is open
 * @param {Array<string>} [options.actorInventory=['apple-1']] - Items actor has in inventory
 * @param {number} [options.containerMaxItems=10] - Max items container can hold
 * @param {number} [options.containerMaxWeight=50] - Max weight container can hold
 * @returns {object} Object with room, actor, furniture, nearbyFurniture, container, and item entities
 */
function setupPutOnSurfaceScenario({
  actorName = 'Alice',
  locationId = 'tavern',
  furnitureId = 'stool-1',
  nearbyFurnitureId = 'table-1',
  containerId = 'bowl-1',
  containerContents = [],
  isOpen = true,
  actorInventory = ['apple-1'],
  containerMaxItems = 10,
  containerMaxWeight = 50,
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

  // Create actual item entities for actor's inventory
  const inventoryItemEntities = actorInventory.map((itemId) =>
    new ModEntityBuilder(itemId)
      .withName(itemId.replace('-1', '').replace('-', ' '))
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.5 })
      .build()
  );

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: actorInventory,
      capacity: { maxWeight: 100, maxItems: 20 },
    })
    .withComponent('positioning:sitting_on', { furniture_id: furnitureId })
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
    .withComponent('items:container', {
      contents: containerContents,
      capacity: { maxWeight: containerMaxWeight, maxItems: containerMaxItems },
      isOpen,
    })
    .withComponent('items:openable', {})
    .withComponent('furniture:on_furniture', { furnitureId: nearbyFurnitureId })
    .build();

  // Create container's existing items if any
  const containerItemEntities = containerContents.map((itemId) =>
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
    inventoryItems: inventoryItemEntities,
    containerItems: containerItemEntities,
  };
}

describe('furniture:put_on_nearby_surface action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'furniture',
      'furniture:put_on_nearby_surface',
      putOnNearbySurfaceRule,
      eventIsActionPutOnNearbySurface
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful put operations', () => {
    it('successfully executes put on nearby surface action', async () => {
      // Arrange: Setup scenario with seated actor having inventory items
      const scenario = setupPutOnSurfaceScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      // Act: Put item on container on nearby surface
      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });

      // Assert: Verify item added to container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).toContain(
        'apple-1'
      );

      // Assert: Verify item removed from actor inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain(
        'apple-1'
      );

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

    it('dispatches item_put_on_nearby_surface event', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Bob',
        containerId: 'tray-1',
        actorInventory: ['goblet-1', 'bread-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'tray-1', {
        additionalPayload: {
          secondaryId: 'goblet-1',
        },
      });

      // Find the item_put_on_nearby_surface perceptible event
      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );
      const putEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_put_on_nearby_surface'
      );
      expect(putEvent).toBeDefined();
      expect(putEvent.payload.actorId).toBe('test:actor1');
      expect(putEvent.payload.targetId).toBe('tray-1');
    });

    it('successfully puts last item from inventory', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Charlie',
        actorInventory: ['coin-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'coin-1',
        },
      });

      // Verify inventory now empty
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toEqual([]);

      // Verify item in container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).toContain(
        'coin-1'
      );
    });

    it('successfully puts multiple items sequentially', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Dave',
        actorInventory: ['diamond-1', 'ruby-1', 'emerald-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      // Put first item
      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'diamond-1',
        },
      });
      let container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).toContain(
        'diamond-1'
      );

      // Put second item
      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'ruby-1',
        },
      });
      container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).toContain(
        'ruby-1'
      );

      // Verify inventory has only one item left
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toEqual(['emerald-1']);
    });

    it('adds item to container with existing contents', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Eve',
        actorInventory: ['new-item-1'],
        containerContents: ['existing-1', 'existing-2'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'new-item-1',
        },
      });

      // Verify all items in container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).toContain(
        'existing-1'
      );
      expect(container.components['items:container'].contents).toContain(
        'existing-2'
      );
      expect(container.components['items:container'].contents).toContain(
        'new-item-1'
      );
    });
  });

  describe('container capacity validation', () => {
    it('prevents putting item when container is at max items capacity', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Frank',
        actorInventory: ['sword-1'],
        containerContents: ['item1', 'item2'],
        containerMaxItems: 2,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'sword-1',
        },
      });

      // Verify item NOT added to container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).not.toContain(
        'sword-1'
      );

      // Verify item still in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('sword-1');

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);
    });

    it('allows putting item when container has space', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Grace',
        actorInventory: ['potion-1'],
        containerContents: ['torch-1'],
        containerMaxItems: 5,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'potion-1',
        },
      });

      // Verify successful put
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).toContain(
        'potion-1'
      );
    });
  });

  describe('container state validation', () => {
    it('prevents putting in closed container', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Helen',
        actorInventory: ['book-1'],
        isOpen: false,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'book-1',
        },
      });

      // Verify item NOT added to container
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).not.toContain(
        'book-1'
      );

      // Verify item still in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('book-1');
    });

    it('prevents putting item not in inventory', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Ivan',
        actorInventory: ['diary-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'nonexistent-item',
        },
      });

      // Verify container unchanged
      const container = testFixture.entityManager.getEntityInstance('bowl-1');
      expect(container.components['items:container'].contents).toEqual([]);

      // Verify original item still in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('diary-1');
    });
  });

  describe('perception logging', () => {
    it('creates perception log for successful item put', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Jack',
        locationId: 'warehouse',
        actorInventory: ['hammer-1', 'wrench-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
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
      const putEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_put_on_nearby_surface'
      );
      expect(putEvent).toBeDefined();
      expect(putEvent.payload.locationId).toBe('warehouse');
      expect(putEvent.payload.actorId).toBe('test:actor1');
      expect(putEvent.payload.targetId).toBe('bowl-1');
    });

    it('creates perception log for failed put due to capacity', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Kate',
        locationId: 'cellar',
        actorInventory: ['wine-1'],
        containerContents: ['item1', 'item2', 'item3'],
        containerMaxItems: 3,
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
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
        (e) => e.payload.perceptionType === 'put_on_nearby_surface_failed'
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.payload.locationId).toBe('cellar');
      expect(failedEvent.payload.contextualData.reason).toBe(
        'max_items_exceeded'
      );
    });
  });

  describe('seated positioning', () => {
    it('maintains seated state after putting item', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Larry',
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });

      // Verify actor still seated
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['positioning:sitting_on']).toBeDefined();
      expect(actor.components['positioning:sitting_on'].furniture_id).toBe(
        'stool-1'
      );
    });

    it('preserves furniture relationships after putting item', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Mary',
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
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
    it('handles multiple actors putting on same nearby surface', async () => {
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

      const actor1 = new ModEntityBuilder('actor-1')
        .withName('Nancy')
        .atLocation('inn')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', { furniture_id: 'stool-1' })
        .withComponent('anatomy:appendages', {
          appendages: [
            { id: 'left_hand', type: 'hand', isGrabbing: false },
            { id: 'right_hand', type: 'hand', isGrabbing: false },
          ],
        })
        .build();

      const actor2 = new ModEntityBuilder('actor-2')
        .withName('Oscar')
        .atLocation('inn')
        .asActor()
        .withComponent('items:inventory', {
          items: ['bread-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('positioning:sitting_on', { furniture_id: 'stool-2' })
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
        .withComponent('items:container', {
          contents: [],
          capacity: { maxWeight: 20, maxItems: 10 },
          isOpen: true,
        })
        .withComponent('items:openable', {})
        .withComponent('furniture:on_furniture', { furnitureId: 'shared-table' })
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

      // Actor 1 puts apple
      await testFixture.executeAction('actor-1', 'shared-bowl', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });
      const actor1After =
        testFixture.entityManager.getEntityInstance('actor-1');
      expect(actor1After.components['items:inventory'].items).not.toContain(
        'apple-1'
      );

      // Actor 2 puts bread
      await testFixture.executeAction('actor-2', 'shared-bowl', {
        additionalPayload: {
          secondaryId: 'bread-1',
        },
      });
      const actor2After =
        testFixture.entityManager.getEntityInstance('actor-2');
      expect(actor2After.components['items:inventory'].items).not.toContain(
        'bread-1'
      );

      // Verify container has both items
      const containerAfter =
        testFixture.entityManager.getEntityInstance('shared-bowl');
      expect(containerAfter.components['items:container'].contents).toContain(
        'apple-1'
      );
      expect(containerAfter.components['items:container'].contents).toContain(
        'bread-1'
      );
    });

    it('preserves container components after putting item', async () => {
      const scenario = setupPutOnSurfaceScenario({
        actorName: 'Paul',
        actorInventory: ['silk-1'],
        containerContents: ['spice-1'],
      });
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.furniture,
        scenario.nearbyFurniture,
        scenario.container,
        ...scenario.inventoryItems,
        ...scenario.containerItems,
      ]);

      await testFixture.executeAction('test:actor1', 'bowl-1', {
        additionalPayload: {
          secondaryId: 'silk-1',
        },
      });

      const container = testFixture.entityManager.getEntityInstance('bowl-1');

      // Verify all components intact
      expect(container.components['items:openable']).toBeDefined();
      expect(container.components['items:container']).toBeDefined();
      expect(container.components['core:position']).toBeDefined();
      expect(container.components['furniture:on_furniture']).toBeDefined();

      // Verify open state preserved
      expect(container.components['items:container'].isOpen).toBe(true);
    });
  });
});
