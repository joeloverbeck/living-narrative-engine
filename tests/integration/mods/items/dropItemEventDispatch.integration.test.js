/**
 * @file Integration test for dropItemAtLocationHandler event dispatch bug
 * @description Reproduces the issue where event is dispatched with wrong signature,
 * causing validation errors and event bus rejections.
 *
 * Bug: dropItemAtLocationHandler.js:129 calls:
 *   this.#dispatcher.dispatch({ type: eventName, payload: {...} })
 * Instead of:
 *   this.#dispatcher.dispatch(eventName, payload)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('dropItemAtLocationHandler - Event Dispatch Signature Bug', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'item-handling:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // Load additional condition required by the rule's "or" block
    await testFixture.loadDependencyConditions([
      'item-handling:event-is-action-drop-wielded-item',
    ]);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should dispatch items-core:item_dropped event with correct payload structure', async () => {
    // Arrange: Create scenario with actor holding an item (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('test-room').asRoom('Test Room').build();

    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('TestActor')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['test-item'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const item = new ModEntityBuilder('test-item')
      .withName('TestItem')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1.0 })
      .build();

    testFixture.reset([room, actor, ...handEntities, item]);

    // Act: Execute drop item action
    await testFixture.executeAction('test:actor1', 'test-item');

    // Assert: Verify items-core:item_dropped event was dispatched
    const itemDroppedEvent = testFixture.events.find(
      (e) => e.eventType === 'items-core:item_dropped'
    );

    // With the buggy code, this event would not exist because:
    // - EventBus would reject the object as an invalid event name
    // - ValidatedEventDispatcher would fail to find the event definition
    expect(itemDroppedEvent).toBeDefined();
    expect(itemDroppedEvent.payload).toEqual({
      actorEntity: 'test:actor1',
      itemEntity: 'test-item',
      locationId: 'test-room',
    });

    // Verify no errors were logged about invalid event IDs
    const consoleErrors = testFixture.logger.error.mock.calls;
    const invalidEventIdErrors = consoleErrors.filter((call) =>
      call[0]?.includes('getEventDefinition called with invalid ID')
    );
    expect(invalidEventIdErrors).toHaveLength(0);

    // Verify no warnings about event definition not found
    const consoleWarns = testFixture.logger.warn.mock.calls;
    const eventDefNotFoundWarnings = consoleWarns.filter((call) =>
      call[0]?.includes('EventDefinition not found')
    );
    expect(eventDefNotFoundWarnings).toHaveLength(0);
  });

  it('should not trigger EventBus invalid event name error', async () => {
    // Arrange (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('test-room').asRoom('Test Room').build();

    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('TestActor')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['test-item'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const item = new ModEntityBuilder('test-item')
      .withName('TestItem')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1.0 })
      .build();

    testFixture.reset([room, actor, ...handEntities, item]);

    // Act
    await testFixture.executeAction('test:actor1', 'test-item');

    // Assert: EventBus should not log "Invalid event name provided"
    const consoleErrors = testFixture.logger.error.mock.calls;
    const invalidEventNameErrors = consoleErrors.filter((call) =>
      call[0]?.includes('Invalid event name provided')
    );

    // With buggy code, this will FAIL because EventBus receives an object instead of string
    expect(invalidEventNameErrors).toHaveLength(0);
  });

  it('should successfully validate event payload against schema', async () => {
    // Arrange (with grabbing hands for prerequisite)
    const room = new ModEntityBuilder('test-room').asRoom('Test Room').build();

    const actorBuilder = new ModEntityBuilder('test:actor1')
      .withName('TestActor')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['test-item'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    const item = new ModEntityBuilder('test-item')
      .withName('TestItem')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 1.0 })
      .build();

    testFixture.reset([room, actor, ...handEntities, item]);

    // Act
    await testFixture.executeAction('test:actor1', 'test-item');

    // Assert: Verify the event was successfully dispatched and validated
    const itemDroppedEvent = testFixture.events.find(
      (e) => e.eventType === 'items-core:item_dropped'
    );

    expect(itemDroppedEvent).toBeDefined();
    expect(itemDroppedEvent.payload).toMatchObject({
      actorEntity: 'test:actor1',
      itemEntity: 'test-item',
      locationId: 'test-room',
    });

    // No schema validation errors should be logged
    const schemaErrors = testFixture.logger.error.mock.calls.filter((call) =>
      call[0]?.includes('Payload validation FAILED')
    );
    expect(schemaErrors).toHaveLength(0);
  });
});
