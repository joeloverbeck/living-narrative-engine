/**
 * @file Integration tests for the items:take_from_container action and rule.
 * @description Tests the rule execution after the take_from_container action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import takeFromContainerRule from '../../../../data/mods/items/rules/handle_take_from_container.rule.json' assert { type: 'json' };
import eventIsActionTakeFromContainer from '../../../../data/mods/items/conditions/event-is-action-take-from-container.condition.json' assert { type: 'json' };

/**
 * Creates a standardized take from container scenario with actor, location, container, and items.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {string} containerId - ID for the container
 * @param {Array<string>} containerContents - Items inside the container
 * @param {boolean} isOpen - Whether container is open
 * @param {Array<string>} actorInventory - Items actor already has
 * @param {number} maxItems - Max items in actor's inventory
 * @param {number} maxWeight - Max weight in actor's inventory
 * @returns {object} Object with room, actor, and container entities
 */
function setupTakeFromContainerScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  containerId = 'chest-1',
  containerContents = ['gold-bar-1', 'letter-1'],
  isOpen = true,
  actorInventory = [],
  maxItems = 10,
  maxWeight = 50
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: actorInventory,
      capacity: { maxWeight, maxItems },
    })
    .build();

  const container = new ModEntityBuilder(containerId)
    .withName('Treasure Chest')
    .atLocation(locationId)
    .withComponent('items:container', {
      contents: containerContents,
      capacity: { maxWeight: 100, maxItems: 20 },
      isOpen,
    })
    .withComponent('items:openable', {})
    .build();

  // Create actual item entities for each item in the container
  const itemEntities = containerContents.map((itemId) =>
    new ModEntityBuilder(itemId)
      .withName(itemId)
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.5 })
      .build()
  );

  return { room, actor, container, items: itemEntities };
}

describe('items:take_from_container action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:take_from_container',
      takeFromContainerRule,
      eventIsActionTakeFromContainer
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful take operations', () => {
    it('successfully executes take from container action', async () => {
      // Arrange: Setup scenario with open container containing items
      const scenario = setupTakeFromContainerScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      // Act: Take item from container
      await testFixture.executeAction('test:actor1', 'chest-1', {
        additionalPayload: {
          secondaryId: 'gold-bar-1',
        },
      });

      // Debug: Check what events were dispatched and their payloads
      console.log('All events:', testFixture.events.map(e => ({ type: e.eventType, payload: e.payload })));
      console.log('Action ID in attempt_action:', testFixture.events[0]?.payload?.actionId);

      // Assert: Verify item removed from container
      const container = testFixture.entityManager.getEntityInstance('chest-1');
      expect(container.components['items:container'].contents).toEqual(['letter-1']);

      // Assert: Verify item added to actor inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('gold-bar-1');

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('dispatches item_taken_from_container event', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Bob',
        'vault',
        'safe-1',
        ['revolver-1', 'gold-bar-1', 'letter-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'safe-1', {
        additionalPayload: {
          secondaryId: 'revolver-1',
        },
      });

      // Find the item_taken_from_container event
      const takenEvent = testFixture.events.find(
        (e) => e.eventType === 'items:item_taken_from_container'
      );
      expect(takenEvent).toBeDefined();
      expect(takenEvent.payload.actorEntity).toBe('test:actor1');
      expect(takenEvent.payload.containerEntity).toBe('safe-1');
      expect(takenEvent.payload.itemEntity).toBe('revolver-1');
    });

    it('successfully takes last item from container', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Charlie',
        'cabin',
        'box-1',
        ['coin-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'box-1', {
        additionalPayload: {
          secondaryId: 'coin-1',
        },
      });

      // Verify container now empty
      const container = testFixture.entityManager.getEntityInstance('box-1');
      expect(container.components['items:container'].contents).toEqual([]);

      // Verify item in actor inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toEqual(['coin-1']);
    });

    it('successfully takes multiple items sequentially', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Dave',
        'treasure-room',
        'trunk-1',
        ['diamond-1', 'ruby-1', 'emerald-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      // Take first item
      await testFixture.executeAction('test:actor1', 'trunk-1', {
        additionalPayload: {
          secondaryId: 'diamond-1',
        },
      });
      let actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('diamond-1');

      // Take second item
      await testFixture.executeAction('test:actor1', 'trunk-1', {
        additionalPayload: {
          secondaryId: 'ruby-1',
        },
      });
      actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('ruby-1');

      // Verify container has only one item left
      const container = testFixture.entityManager.getEntityInstance('trunk-1');
      expect(container.components['items:container'].contents).toEqual(['emerald-1']);
    });
  });

  describe('inventory capacity validation', () => {
    it('prevents taking item when inventory is at max items capacity', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Eve',
        'dungeon',
        'chest-2',
        ['sword-1'],
        true,
        ['item1', 'item2'],
        2 // maxItems = 2
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'chest-2', {
        additionalPayload: {
          secondaryId: 'sword-1',
        },
      });

      // Verify item NOT removed from container
      const container = testFixture.entityManager.getEntityInstance('chest-2');
      expect(container.components['items:container'].contents).toContain('sword-1');

      // Verify item NOT added to inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain('sword-1');

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);
    });

    it('allows taking item when inventory has space', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Frank',
        'cave',
        'barrel-1',
        ['potion-1'],
        true,
        ['torch-1'],
        5 // maxItems = 5
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'barrel-1', {
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
      const scenario = setupTakeFromContainerScenario(
        'Grace',
        'study',
        'locked-chest',
        ['book-1'],
        false // isOpen = false
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'locked-chest', {
        additionalPayload: {
          secondaryId: 'book-1',
        },
      });

      // Verify item NOT removed from container
      const container =
        testFixture.entityManager.getEntityInstance('locked-chest');
      expect(container.components['items:container'].contents).toContain('book-1');

      // Verify item NOT in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain('book-1');
    });

    it('prevents taking item not in container', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Helen',
        'attic',
        'crate-1',
        ['diary-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'crate-1', {
        additionalPayload: {
          secondaryId: 'nonexistent-item',
        },
      });

      // Verify container unchanged
      const container = testFixture.entityManager.getEntityInstance('crate-1');
      expect(container.components['items:container'].contents).toEqual(['diary-1']);

      // Verify item NOT in inventory
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain(
        'nonexistent-item'
      );
    });
  });

  describe('perception logging', () => {
    it('creates perception log for successful item taken', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Ivan',
        'warehouse',
        'toolbox-1',
        ['hammer-1', 'wrench-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'toolbox-1', {
        additionalPayload: {
          secondaryId: 'hammer-1',
        },
      });

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const takenEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'item_taken_from_container'
      );
      expect(takenEvent).toBeDefined();
      expect(takenEvent.payload.locationId).toBe('warehouse');
      expect(takenEvent.payload.actorId).toBe('test:actor1');
      expect(takenEvent.payload.targetId).toBe('toolbox-1');
    });

    it('creates perception log for failed take due to capacity', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Jack',
        'cellar',
        'wine-rack',
        ['wine-1'],
        true,
        ['item1', 'item2', 'item3'],
        3 // maxItems = 3
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'wine-rack', {
        additionalPayload: {
          secondaryId: 'wine-1',
        },
      });

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const failedEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'take_from_container_failed'
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.payload.locationId).toBe('cellar');
      expect(failedEvent.payload.contextualData.reason).toBe('capacity_exceeded');
    });
  });

  describe('edge cases', () => {
    it('handles container at same location as actor', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Kate',
        'office',
        'drawer-1',
        ['document-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'drawer-1', {
        additionalPayload: {
          secondaryId: 'document-1',
        },
      });

      // Verify both actor and container still at same location
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      const container = testFixture.entityManager.getEntityInstance('drawer-1');
      expect(actor.components['core:position'].locationId).toBe('office');
      expect(container.components['core:position'].locationId).toBe('office');
    });

    it('preserves container components after taking item', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Larry',
        'marketplace',
        'merchant-chest',
        ['silk-1', 'spice-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'merchant-chest', {
        additionalPayload: {
          secondaryId: 'silk-1',
        },
      });

      const container =
        testFixture.entityManager.getEntityInstance('merchant-chest');

      // Verify all components intact
      expect(container.components['items:openable']).toBeDefined();
      expect(container.components['items:container']).toBeDefined();
      expect(container.components['core:position']).toBeDefined();

      // Verify open state preserved
      expect(container.components['items:container'].isOpen).toBe(true);
    });

    it('handles multiple actors taking from same container', async () => {
      const room = new ModEntityBuilder('town-square')
        .asRoom('Town Square')
        .build();

      const actor1 = new ModEntityBuilder('actor-1')
        .withName('Mary')
        .atLocation('town-square')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const actor2 = new ModEntityBuilder('actor-2')
        .withName('Nancy')
        .atLocation('town-square')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const sharedContainer = new ModEntityBuilder('supply-crate')
        .withName('Supply Crate')
        .atLocation('town-square')
        .withComponent('items:container', {
          contents: ['apple-1', 'bread-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
        })
        .withComponent('items:openable', {})
        .build();

      testFixture.reset([room, actor1, actor2, sharedContainer]);

      // Actor 1 takes apple
      await testFixture.executeAction('actor-1', 'supply-crate', {
        additionalPayload: {
          secondaryId: 'apple-1',
        },
      });
      const actor1After = testFixture.entityManager.getEntityInstance('actor-1');
      expect(actor1After.components['items:inventory'].items).toContain('apple-1');

      // Actor 2 takes bread
      await testFixture.executeAction('actor-2', 'supply-crate', {
        additionalPayload: {
          secondaryId: 'bread-1',
        },
      });
      const actor2After = testFixture.entityManager.getEntityInstance('actor-2');
      expect(actor2After.components['items:inventory'].items).toContain('bread-1');

      // Verify container now empty
      const containerAfter =
        testFixture.entityManager.getEntityInstance('supply-crate');
      expect(containerAfter.components['items:container'].contents).toEqual([]);
    });
  });

  describe('interaction with existing items system', () => {
    it('maintains item entity integrity after transfer', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Oscar',
        'museum',
        'display-case',
        ['artifact-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      await testFixture.executeAction('test:actor1', 'display-case', {
        additionalPayload: {
          secondaryId: 'artifact-1',
        },
      });

      // Verify item still exists as entity (just changed location)
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('artifact-1');

      const container =
        testFixture.entityManager.getEntityInstance('display-case');
      expect(container.components['items:container'].contents).not.toContain(
        'artifact-1'
      );
    });

    it('works correctly after container was just opened', async () => {
      const scenario = setupTakeFromContainerScenario(
        'Paul',
        'storage',
        'sealed-box',
        ['key-1'],
        false // Initially closed
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container, ...scenario.items]);

      // First open the container (manually set for this test)
      const container =
        testFixture.entityManager.getEntityInstance('sealed-box');
      testFixture.entityManager.addComponent('sealed-box', 'items:container', {
        ...container.components['items:container'],
        isOpen: true,
      });

      // Now take item
      await testFixture.executeAction('test:actor1', 'sealed-box', {
        additionalPayload: {
          secondaryId: 'key-1',
        },
      });

      // Verify successful take
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).toContain('key-1');
    });
  });
});
