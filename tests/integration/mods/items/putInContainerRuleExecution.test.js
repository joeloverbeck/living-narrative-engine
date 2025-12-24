/**
 * @file Integration tests for the containers:put_in_container action and rule.
 * @description Tests the rule execution after the put_in_container action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import putInContainerRule from '../../../../data/mods/containers/rules/handle_put_in_container.rule.json' assert { type: 'json' };
import eventIsActionPutInContainer from '../../../../data/mods/containers/conditions/event-is-action-put-in-container.condition.json' assert { type: 'json' };

/**
 * Creates a standardized put in container scenario with actor, location, container, and items.
 *
 * @param {string} actorName - Name for the actor
 * @param {string} locationId - Location for the scenario
 * @param {string} containerId - ID for the container
 * @param {Array<string>} containerContents - Items inside the container
 * @param {boolean} isOpen - Whether container is open
 * @param {Array<string>} actorInventory - Items actor already has
 * @param {number} maxItems - Max items in container capacity
 * @param {number} maxWeight - Max weight in container capacity
 * @returns {object} Object with room, actor, container, and item entities
 */
function setupPutInContainerScenario(
  actorName = 'Alice',
  locationId = 'saloon1',
  containerId = 'chest-1',
  containerContents = [],
  isOpen = true,
  actorInventory = ['item1'],
  maxItems = 5,
  maxWeight = 100
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
    .withComponent('core:perception_log', { maxEntries: 10, logEntries: [] })
    .build();

  const container = new ModEntityBuilder(containerId)
    .withName('Treasure Chest')
    .atLocation(locationId)
    .withComponent('containers-core:container', {
      contents: containerContents,
      capacity: { maxWeight, maxItems },
      isOpen,
    })
    .withComponent('items-core:openable', {})
    .build();

  // Create actual item entities for items in actor inventory
  const itemEntities = actorInventory.map((itemId) =>
    new ModEntityBuilder(itemId)
      .withName(itemId)
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1 })
      .build()
  );

  return { room, actor, container, items: itemEntities };
}

describe('containers:put_in_container action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'containers',
      'containers:put_in_container',
      putInContainerRule,
      eventIsActionPutInContainer
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should successfully execute put_in_container action', async () => {
    // Arrange: Setup scenario with open container
    const scenario = setupPutInContainerScenario();
    testFixture.reset([
      scenario.room,
      scenario.actor,
      scenario.container,
      ...scenario.items,
    ]);

    // Act: Put item in container
    await testFixture.executeAction('test:actor1', 'chest-1', {
      additionalPayload: {
        secondaryId: 'item1',
      },
    });

    // Assert: Verify item was moved from inventory to container
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['items:inventory'].items).not.toContain('item1');
    expect(actor.components['items:inventory'].items).toHaveLength(0);

    const container = testFixture.entityManager.getEntityInstance('chest-1');
    expect(container.components['containers-core:container'].contents).toContain('item1');
    expect(container.components['containers-core:container'].contents).toHaveLength(1);

    // Assert: Verify event was dispatched
    const putEvent = testFixture.events.find(
      (e) => e.eventType === 'containers:item_put_in_container'
    );
    expect(putEvent).toBeDefined();
    expect(putEvent.payload.actorEntity).toBe('test:actor1');
    expect(putEvent.payload.containerEntity).toBe('chest-1');
    expect(putEvent.payload.itemEntity).toBe('item1');

    const successEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Alice puts item1 in Treasure Chest.'
    );

    // Assert: Verify turn ended successfully
    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('should fail when container is at max items capacity', async () => {
    // Arrange: Setup scenario with container at max capacity
    const scenario = setupPutInContainerScenario(
      'Bob',
      'vault',
      'small-box',
      ['existing1', 'existing2', 'existing3'],
      true,
      ['new-item'],
      3, // maxItems = 3
      100
    );
    testFixture.reset([
      scenario.room,
      scenario.actor,
      scenario.container,
      ...scenario.items,
    ]);

    // Act: Attempt to put item in full container
    await testFixture.executeAction('test:actor1', 'small-box', {
      additionalPayload: {
        secondaryId: 'new-item',
      },
    });

    // Assert: Verify item was NOT moved
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['items:inventory'].items).toContain('new-item');

    const container = testFixture.entityManager.getEntityInstance('small-box');
    expect(container.components['containers-core:container'].contents).not.toContain(
      'new-item'
    );
    expect(container.components['containers-core:container'].contents).toHaveLength(3);

    // Assert: Verify failure event was dispatched
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    const failedEvent = perceptibleEvents.find(
      (e) => e.payload.perceptionType === 'error.action_failed'
    );
    expect(failedEvent).toBeDefined();

    // Assert: Verify turn ended with failure
    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(false);
  });

  it('should fail when container exceeds max weight capacity', async () => {
    // Arrange: Create scenario with weight limit
    const room = new ModEntityBuilder('location1').asRoom('Location').build();

    const actor = new ModEntityBuilder('test:actor1')
      .withName('Charlie')
      .atLocation('location1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['heavy-item'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const heavyItem = new ModEntityBuilder('heavy-item')
      .withName('Heavy Item')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 50 })
      .build();

    const existing1 = new ModEntityBuilder('existing1')
      .withName('Existing 1')
      .withComponent('items-core:item', {})
      .withComponent('core:weight', { weight: 40 })
      .build();

    const existing2 = new ModEntityBuilder('existing2')
      .withName('Existing 2')
      .withComponent('items-core:item', {})
      .withComponent('core:weight', { weight: 30 })
      .build();

    const container = new ModEntityBuilder('weak-chest')
      .withName('Weak Chest')
      .atLocation('location1')
      .withComponent('containers-core:container', {
        contents: ['existing1', 'existing2'],
        capacity: { maxItems: 10, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items-core:openable', {})
      .build();

    testFixture.reset([
      room,
      actor,
      container,
      heavyItem,
      existing1,
      existing2,
    ]);

    // Act: Attempt to put heavy item in container (would exceed 100 weight: 40 + 30 + 50 = 120)
    await testFixture.executeAction('test:actor1', 'weak-chest', {
      additionalPayload: {
        secondaryId: 'heavy-item',
      },
    });

    // Assert: Verify item was NOT moved
    const actorAfter =
      testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actorAfter.components['items:inventory'].items).toContain(
      'heavy-item'
    );

    const containerAfter =
      testFixture.entityManager.getEntityInstance('weak-chest');
    expect(containerAfter.components['containers-core:container'].contents).not.toContain(
      'heavy-item'
    );

    // Assert: Verify failure event was dispatched
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    const failedEvent = perceptibleEvents.find(
      (e) => e.payload.perceptionType === 'error.action_failed'
    );
    expect(failedEvent).toBeDefined();

    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(false);
  });

  it('should handle multiple sequential put_in_container actions', async () => {
    // Arrange: Setup scenario with multiple items
    const scenario = setupPutInContainerScenario(
      'Dave',
      'storage',
      'toolbox-1',
      [],
      true,
      ['item1', 'item2', 'item3'],
      10,
      100
    );
    testFixture.reset([
      scenario.room,
      scenario.actor,
      scenario.container,
      ...scenario.items,
    ]);

    // Act: Put all items in container sequentially
    const firstActionStart = testFixture.events.length;
    await testFixture.executeAction('test:actor1', 'toolbox-1', {
      additionalPayload: {
        secondaryId: 'item1',
      },
    });

    const firstActionEvents = testFixture.events.slice(firstActionStart);
    const firstTurnEnded = firstActionEvents.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(firstTurnEnded).toBeDefined();
    expect(firstTurnEnded.payload.success).toBe(true);
    const firstPutEvent = firstActionEvents.find(
      (event) => event.eventType === 'containers:item_put_in_container'
    );
    expect(firstPutEvent?.payload.itemEntity).toBe('item1');

    const secondActionStart = testFixture.events.length;
    await testFixture.executeAction('test:actor1', 'toolbox-1', {
      additionalPayload: {
        secondaryId: 'item2',
      },
    });

    const secondActionEvents = testFixture.events.slice(secondActionStart);
    const secondTurnEnded = secondActionEvents.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(secondTurnEnded).toBeDefined();
    expect(secondTurnEnded.payload.success).toBe(true);
    const secondPutEvent = secondActionEvents.find(
      (event) => event.eventType === 'containers:item_put_in_container'
    );
    expect(secondPutEvent?.payload.itemEntity).toBe('item2');

    const thirdActionStart = testFixture.events.length;
    await testFixture.executeAction('test:actor1', 'toolbox-1', {
      additionalPayload: {
        secondaryId: 'item3',
      },
    });

    const thirdActionEvents = testFixture.events.slice(thirdActionStart);
    const thirdTurnEnded = thirdActionEvents.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(thirdTurnEnded).toBeDefined();
    expect(thirdTurnEnded.payload.success).toBe(true);
    const thirdPutEvent = thirdActionEvents.find(
      (event) => event.eventType === 'containers:item_put_in_container'
    );
    expect(thirdPutEvent?.payload.itemEntity).toBe('item3');

    // Assert: Verify all items were moved
    const actor = testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['items:inventory'].items).toHaveLength(0);

    const container = testFixture.entityManager.getEntityInstance('toolbox-1');
    expect(container.components['containers-core:container'].contents).toHaveLength(3);
    expect(container.components['containers-core:container'].contents).toEqual(
      expect.arrayContaining(['item1', 'item2', 'item3'])
    );

    const perceptibleEvents = testFixture.events.filter(
      (event) => event.eventType === 'core:perceptible_event'
    );
    const successEvents = perceptibleEvents.filter(
      (event) => event.payload.perceptionType === 'container.put'
    );
    expect(successEvents).toHaveLength(3);
  });

  describe('perception logging', () => {
    it('creates perception log for successful put in container', async () => {
      const scenario = setupPutInContainerScenario(
        'Eve',
        'warehouse',
        'crate-1',
        [],
        true,
        ['package-1']
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'crate-1', {
        additionalPayload: {
          secondaryId: 'package-1',
        },
      });

      const perceptibleEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvents.length).toBeGreaterThan(0);
      const putEvent = perceptibleEvents.find(
        (e) => e.payload.perceptionType === 'container.put'
      );
      expect(putEvent).toBeDefined();
      expect(putEvent.payload.locationId).toBe('warehouse');
      expect(putEvent.payload.actorId).toBe('test:actor1');
      expect(putEvent.payload.targetId).toBe('crate-1');

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      const perceptionLogHandler = new AddPerceptionLogEntryHandler({
        entityManager: testFixture.entityManager,
        logger: testFixture.logger,
        safeEventDispatcher: { dispatch: () => {} },
        routingPolicyService: {
          validateAndHandle: jest.fn().mockReturnValue(true),
        },
      });

      await perceptionLogHandler.execute({
        location_id: putEvent.payload.locationId,
        entry: {
          descriptionText: putEvent.payload.descriptionText,
          timestamp: putEvent.payload.timestamp,
          perceptionType: putEvent.payload.perceptionType,
          actorId: putEvent.payload.actorId,
          targetId: putEvent.payload.targetId,
          involvedEntities: putEvent.payload.involvedEntities,
        },
        originating_actor_id: putEvent.payload.actorId,
        recipient_ids: putEvent.payload.contextualData?.recipientIds ?? [
          putEvent.payload.actorId,
        ],
      });

      const actorEntity =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const logEntries =
        actorEntity.components['core:perception_log'].logEntries;
      expect(logEntries).toHaveLength(1);
      expect(logEntries[0].descriptionText).toContain('puts package-1');
    });

    it('creates perception log for failed put due to capacity', async () => {
      const scenario = setupPutInContainerScenario(
        'Frank',
        'cellar',
        'barrel-1',
        ['existing-item'],
        true,
        ['wine-1'],
        1, // maxItems = 1
        100
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'barrel-1', {
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

      const turnEndedEvent = testFixture.events.find(
        (event) => event.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);

      const perceptionLogHandler = new AddPerceptionLogEntryHandler({
        entityManager: testFixture.entityManager,
        logger: testFixture.logger,
        safeEventDispatcher: { dispatch: () => {} },
        routingPolicyService: {
          validateAndHandle: jest.fn().mockReturnValue(true),
        },
      });

      await perceptionLogHandler.execute({
        location_id: failedEvent.payload.locationId,
        entry: {
          descriptionText: failedEvent.payload.descriptionText,
          timestamp: failedEvent.payload.timestamp,
          perceptionType: failedEvent.payload.perceptionType,
          actorId: failedEvent.payload.actorId,
          targetId: failedEvent.payload.targetId,
          involvedEntities: failedEvent.payload.involvedEntities,
        },
        originating_actor_id: failedEvent.payload.actorId,
        recipient_ids: failedEvent.payload.contextualData?.recipientIds ?? [
          failedEvent.payload.actorId,
        ],
      });

      const actorEntity =
        testFixture.entityManager.getEntityInstance('test:actor1');
      const logEntries =
        actorEntity.components['core:perception_log'].logEntries;
      expect(logEntries).toHaveLength(1);
      expect(logEntries[0].perceptionType).toBe('error.action_failed');
    });
  });

  describe('edge cases', () => {
    it('handles container at same location as actor', async () => {
      const scenario = setupPutInContainerScenario(
        'Grace',
        'office',
        'drawer-1',
        [],
        true,
        ['document-1']
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.container,
        ...scenario.items,
      ]);

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

    it('preserves container components after putting item', async () => {
      const scenario = setupPutInContainerScenario(
        'Helen',
        'marketplace',
        'merchant-chest',
        ['silk-1'],
        true,
        ['spice-1']
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'merchant-chest', {
        additionalPayload: {
          secondaryId: 'spice-1',
        },
      });

      const container =
        testFixture.entityManager.getEntityInstance('merchant-chest');

      // Verify all components intact
      expect(container.components['items-core:openable']).toBeDefined();
      expect(container.components['containers-core:container']).toBeDefined();
      expect(container.components['core:position']).toBeDefined();

      // Verify open state preserved
      expect(container.components['containers-core:container'].isOpen).toBe(true);
    });

    it('handles multiple actors putting in same container', async () => {
      const room = new ModEntityBuilder('town-square')
        .asRoom('Town Square')
        .build();

      const actor1 = new ModEntityBuilder('actor-1')
        .withName('Ivan')
        .atLocation('town-square')
        .asActor()
        .withComponent('items:inventory', {
          items: ['apple-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const actor2 = new ModEntityBuilder('actor-2')
        .withName('Jack')
        .atLocation('town-square')
        .asActor()
        .withComponent('items:inventory', {
          items: ['bread-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const sharedContainer = new ModEntityBuilder('supply-crate')
        .withName('Supply Crate')
        .atLocation('town-square')
        .withComponent('containers-core:container', {
          contents: [],
          capacity: { maxWeight: 100, maxItems: 20 },
          isOpen: true,
        })
        .withComponent('items-core:openable', {})
        .build();

      const apple = new ModEntityBuilder('apple-1')
        .withName('Apple')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      const bread = new ModEntityBuilder('bread-1')
        .withName('Bread')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      testFixture.reset([room, actor1, actor2, sharedContainer, apple, bread]);

      // Actor 1 puts apple
      await testFixture.executeAction('actor-1', 'supply-crate', {
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
      await testFixture.executeAction('actor-2', 'supply-crate', {
        additionalPayload: {
          secondaryId: 'bread-1',
        },
      });
      const actor2After =
        testFixture.entityManager.getEntityInstance('actor-2');
      expect(actor2After.components['items:inventory'].items).not.toContain(
        'bread-1'
      );

      // Verify container now has both items
      const containerAfter =
        testFixture.entityManager.getEntityInstance('supply-crate');
      expect(
        containerAfter.components['containers-core:container'].contents
      ).toHaveLength(2);
      expect(containerAfter.components['containers-core:container'].contents).toEqual(
        expect.arrayContaining(['apple-1', 'bread-1'])
      );
    });
  });

  describe('interaction with existing items system', () => {
    it('maintains item entity integrity after transfer', async () => {
      const scenario = setupPutInContainerScenario(
        'Kate',
        'museum',
        'display-case',
        [],
        true,
        ['artifact-1']
      );
      testFixture.reset([
        scenario.room,
        scenario.actor,
        scenario.container,
        ...scenario.items,
      ]);

      await testFixture.executeAction('test:actor1', 'display-case', {
        additionalPayload: {
          secondaryId: 'artifact-1',
        },
      });

      // Verify item still exists as entity (just changed location)
      const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(actor.components['items:inventory'].items).not.toContain(
        'artifact-1'
      );

      const container =
        testFixture.entityManager.getEntityInstance('display-case');
      expect(container.components['containers-core:container'].contents).toContain(
        'artifact-1'
      );
    });
  });
});
