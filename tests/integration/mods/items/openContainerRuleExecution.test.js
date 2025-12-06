/**
 * @file Integration tests for the items:open_container action and rule.
 * @description Tests the rule execution after the open_container action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import openContainerRule from '../../../../data/mods/items/rules/handle_open_container.rule.json' assert { type: 'json' };
import eventIsActionOpenContainer from '../../../../data/mods/items/conditions/event-is-action-open-container.condition.json' assert { type: 'json' };

/**
 * Creates a standardized open container scenario with actor, location, and container.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {string} containerId - ID for the container
 * @param {Array<string>} containerContents - Items inside the container
 * @param {boolean} isOpen - Whether container is already open
 * @param {string|null} requiresKey - Key required to open (null if unlocked)
 * @param {Array<string>} actorInventory - Items actor already has
 * @returns {object} Object with room, actor, and container entities
 */
function setupOpenContainerScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  containerId = 'chest-1',
  containerContents = ['gold-bar-1', 'letter-1'],
  isOpen = false,
  requiresKey = null,
  actorInventory = []
) {
  const room = new ModEntityBuilder(locationId).asRoom('Saloon').build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName(actorName)
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: actorInventory,
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .build();

  const containerData = {
    contents: containerContents,
    capacity: { maxWeight: 100, maxItems: 20 },
    isOpen,
  };

  if (requiresKey) {
    containerData.requiresKey = true;
    containerData.keyItemId = requiresKey;
  }

  const container = new ModEntityBuilder(containerId)
    .withName('Treasure Chest')
    .atLocation(locationId)
    .withComponent('items:container', containerData)
    .withComponent('items:openable', {})
    .build();

  return { room, actor, container };
}

describe('items:open_container action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:open_container',
      openContainerRule,
      eventIsActionOpenContainer
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('successful open operations', () => {
    it('successfully executes open container action on unlocked container', async () => {
      // Arrange: Setup scenario with unlocked container
      const scenario = setupOpenContainerScenario();
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Act: Open the container
      await testFixture.executeAction('test:actor1', 'chest-1');

      // Assert: Verify container is now open
      const container = testFixture.entityManager.getEntityInstance('chest-1');
      expect(container.components['items:container'].isOpen).toBe(true);

      // Assert: Verify turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('dispatches container_opened event with contents', async () => {
      const scenario = setupOpenContainerScenario('Bob', 'vault', 'safe-1', [
        'revolver-1',
        'gold-bar-1',
        'letter-1',
      ]);
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'safe-1');

      // Find the container_opened event
      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvent).toBeDefined();
      expect(openedEvent.payload.actorEntity).toBe('test:actor1');
      expect(openedEvent.payload.containerEntity).toBe('safe-1');
      expect(openedEvent.payload.contents).toEqual([
        'revolver-1',
        'gold-bar-1',
        'letter-1',
      ]);
    });

    it('successfully opens empty container', async () => {
      const scenario = setupOpenContainerScenario(
        'Charlie',
        'cabin',
        'box-1',
        []
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'box-1');

      const container = testFixture.entityManager.getEntityInstance('box-1');
      expect(container.components['items:container'].isOpen).toBe(true);

      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvent.payload.contents).toEqual([]);
    });
  });

  describe('locked container with key validation', () => {
    it('successfully opens locked container when actor has the key', async () => {
      const scenario = setupOpenContainerScenario(
        'Dave',
        'treasure-room',
        'locked-chest',
        ['diamond-1', 'gold-bar-1'],
        false,
        'brass-key',
        ['brass-key', 'torch-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'locked-chest');

      // Verify container opened
      const container =
        testFixture.entityManager.getEntityInstance('locked-chest');
      expect(container.components['items:container'].isOpen).toBe(true);

      // Verify container_opened event dispatched
      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvent).toBeDefined();
      expect(openedEvent.payload.contents).toEqual(['diamond-1', 'gold-bar-1']);
    });

    it('prevents opening locked container when actor does not have key', async () => {
      const scenario = setupOpenContainerScenario(
        'Eve',
        'dungeon',
        'locked-box',
        ['treasure-1'],
        false,
        'iron-key',
        ['torch-1', 'rope-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'locked-box');

      // Verify container remains closed
      const container =
        testFixture.entityManager.getEntityInstance('locked-box');
      expect(container.components['items:container'].isOpen).toBe(false);

      // Verify no container_opened event
      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvent).toBeUndefined();

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);
    });

    it('prevents opening when actor has no inventory but key is required', async () => {
      const room = new ModEntityBuilder('cave').asRoom('Cave').build();

      const actorWithoutInventory = new ModEntityBuilder('test:actor1')
        .withName('Frank')
        .atLocation('cave')
        .asActor()
        .build();

      const lockedContainer = new ModEntityBuilder('locked-crate')
        .withName('Locked Crate')
        .atLocation('cave')
        .withComponent('items:container', {
          contents: ['item-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
          requiresKey: true,
          keyItemId: 'silver-key',
        })
        .withComponent('items:openable', {})
        .build();

      testFixture.reset([room, actorWithoutInventory, lockedContainer]);

      await testFixture.executeAction('test:actor1', 'locked-crate');

      // Verify container remains closed
      const container =
        testFixture.entityManager.getEntityInstance('locked-crate');
      expect(container.components['items:container'].isOpen).toBe(false);
    });
  });

  describe('already open container', () => {
    it('prevents opening a container that is already open', async () => {
      const scenario = setupOpenContainerScenario(
        'Grace',
        'study',
        'open-chest',
        ['book-1'],
        true
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'open-chest');

      // Verify container remains in open state (no change)
      const container =
        testFixture.entityManager.getEntityInstance('open-chest');
      expect(container.components['items:container'].isOpen).toBe(true);

      // Verify no container_opened event (since it was already open)
      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvent).toBeUndefined();

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);
    });
  });

  describe('perception logging', () => {
    it('creates perception log for successful container opening', async () => {
      const scenario = setupOpenContainerScenario('Helen', 'attic', 'trunk-1', [
        'diary-1',
        'coin-1',
      ]);
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'trunk-1');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const openEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'container_opened'
      );
      expect(openEvent).toBeDefined();
      expect(openEvent.payload.locationId).toBe('attic');
      expect(openEvent.payload.actorId).toBe('test:actor1');
      expect(openEvent.payload.targetId).toBe('trunk-1');
    });

    it('creates perception log for failed opening due to missing key', async () => {
      const scenario = setupOpenContainerScenario(
        'Ivan',
        'warehouse',
        'locked-safe',
        ['cash-1'],
        false,
        'combination-key',
        ['flashlight-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'locked-safe');

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const failedEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'container_open_failed'
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.payload.locationId).toBe('warehouse');
      expect(failedEvent.payload.contextualData.reason).toBe('missing_key');
    });
  });

  describe('edge cases', () => {
    it('handles container with single item', async () => {
      const scenario = setupOpenContainerScenario(
        'Jack',
        'cellar',
        'barrel-1',
        ['wine-bottle-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'barrel-1');

      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvent.payload.contents).toEqual(['wine-bottle-1']);
    });

    it('preserves requiresKey field in openable component after opening', async () => {
      const scenario = setupOpenContainerScenario(
        'Kate',
        'office',
        'drawer-1',
        ['document-1'],
        false,
        'desk-key',
        ['desk-key']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'drawer-1');

      const container = testFixture.entityManager.getEntityInstance('drawer-1');
      expect(container.components['items:container'].isOpen).toBe(true);
      expect(container.components['items:container'].requiresKey).toBe(true);
      expect(container.components['items:container'].keyItemId).toBe(
        'desk-key'
      );
    });

    it('handles multiple actors opening different containers', async () => {
      const room = new ModEntityBuilder('marketplace')
        .asRoom('Marketplace')
        .build();

      const actor1 = new ModEntityBuilder('actor-1')
        .withName('Larry')
        .atLocation('marketplace')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const actor2 = new ModEntityBuilder('actor-2')
        .withName('Mary')
        .atLocation('marketplace')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const container1 = new ModEntityBuilder('crate-1')
        .withName('Crate 1')
        .atLocation('marketplace')
        .withComponent('items:container', {
          contents: ['apple-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
        })
        .withComponent('items:openable', {})
        .build();

      const container2 = new ModEntityBuilder('crate-2')
        .withName('Crate 2')
        .atLocation('marketplace')
        .withComponent('items:container', {
          contents: ['bread-1'],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: false,
        })
        .withComponent('items:openable', {})
        .build();

      testFixture.reset([room, actor1, actor2, container1, container2]);

      // Actor 1 opens container 1
      await testFixture.executeAction('actor-1', 'crate-1');
      const container1After =
        testFixture.entityManager.getEntityInstance('crate-1');
      expect(container1After.components['items:container'].isOpen).toBe(true);

      // Actor 2 opens container 2
      await testFixture.executeAction('actor-2', 'crate-2');
      const container2After =
        testFixture.entityManager.getEntityInstance('crate-2');
      expect(container2After.components['items:container'].isOpen).toBe(true);

      // Verify both containers opened
      const openedEvents = testFixture.events.filter(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvents).toHaveLength(2);
    });
  });

  describe('interaction with existing items system', () => {
    it('opened container can be accessed for picking up items', async () => {
      const scenario = setupOpenContainerScenario(
        'Nancy',
        'storage',
        'toolbox-1',
        ['hammer-1', 'wrench-1']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      // Open the container
      await testFixture.executeAction('test:actor1', 'toolbox-1');

      // Verify container is open and contents are accessible
      const container =
        testFixture.entityManager.getEntityInstance('toolbox-1');
      expect(container.components['items:container'].isOpen).toBe(true);
      expect(container.components['items:container'].contents).toEqual([
        'hammer-1',
        'wrench-1',
      ]);

      // Verify the contents are still tracked
      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'items:container_opened'
      );
      expect(openedEvent.payload.contents).toContain('hammer-1');
      expect(openedEvent.payload.contents).toContain('wrench-1');
    });

    it('maintains container integrity after opening', async () => {
      const scenario = setupOpenContainerScenario(
        'Oscar',
        'museum',
        'display-case',
        ['artifact-1', 'artifact-2', 'artifact-3']
      );
      testFixture.reset([scenario.room, scenario.actor, scenario.container]);

      await testFixture.executeAction('test:actor1', 'display-case');

      const container =
        testFixture.entityManager.getEntityInstance('display-case');

      // Verify all components intact
      expect(container.components['items:openable']).toBeDefined();
      expect(container.components['items:container']).toBeDefined();
      expect(container.components['core:position']).toBeDefined();

      // Verify container data preserved
      expect(container.components['items:container'].contents).toHaveLength(3);
      expect(container.components['core:position'].locationId).toBe('museum');
    });
  });
});
