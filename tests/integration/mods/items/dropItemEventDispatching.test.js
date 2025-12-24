/**
 * @file Integration tests for drop_item event dispatching behavior
 * @description Tests that verify correct event name format and payload structure
 * when dropping items. These tests expose bugs where non-namespaced event names
 * are used or event payloads don't match schemas.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('Drop Item - Event Dispatching', () => {
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

  describe('Event Name Validation', () => {
    it('should dispatch items-core:item_dropped event (not ITEM_DROPPED)', async () => {
      // Arrange: Create test scenario with actor and item (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('test-room')
        .asRoom('Test Room')
        .build();

      const actorBuilder = new ModEntityBuilder('test:actor1')
        .withName('Alice')
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
        .withName('Test Item')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Act: Execute drop action
      await testFixture.executeAction('test:actor1', 'test-item');

      // Assert: Verify namespaced event was dispatched (items-core:item_dropped)
      // This test will FAIL if handler dispatches 'ITEM_DROPPED' instead
      const itemDroppedEvent = testFixture.events.find(
        (e) => e.eventType === 'items-core:item_dropped'
      );

      expect(itemDroppedEvent).toBeDefined();
      expect(itemDroppedEvent).not.toBeNull();

      // Verify NO non-namespaced event was dispatched
      const wrongEventName = testFixture.events.find(
        (e) => e.eventType === 'ITEM_DROPPED'
      );
      expect(wrongEventName).toBeUndefined();
    });

    it('should include correct payload structure in items-core:item_dropped event', async () => {
      // Arrange (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('saloon').asRoom('Saloon').build();

      const actorBuilder = new ModEntityBuilder('actor-bob')
        .withName('Bob')
        .atLocation('saloon')
        .asActor()
        .withComponent('items:inventory', {
          items: ['golden-watch'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      const item = new ModEntityBuilder('golden-watch')
        .withName('Golden Watch')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.3 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Act
      await testFixture.executeAction('actor-bob', 'golden-watch');

      // Assert: Verify payload structure matches event schema
      const itemDroppedEvent = testFixture.events.find(
        (e) => e.eventType === 'items-core:item_dropped'
      );

      expect(itemDroppedEvent).toBeDefined();
      expect(itemDroppedEvent.payload).toBeDefined();

      // Verify required payload fields match schema definition
      expect(itemDroppedEvent.payload.actorEntity).toBe('actor-bob');
      expect(itemDroppedEvent.payload.itemEntity).toBe('golden-watch');
      expect(itemDroppedEvent.payload.locationId).toBe('saloon');

      // Verify payload has exactly the expected fields (no extras)
      const payloadKeys = Object.keys(itemDroppedEvent.payload).sort();
      expect(payloadKeys).toEqual(['actorEntity', 'itemEntity', 'locationId']);
    });

    it('should validate event payload against registered schema', async () => {
      // Arrange (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('tavern').asRoom('Tavern').build();

      const actorBuilder = new ModEntityBuilder('actor-charlie')
        .withName('Charlie')
        .atLocation('tavern')
        .asActor()
        .withComponent('items:inventory', {
          items: ['letter'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      const item = new ModEntityBuilder('letter')
        .withName('Letter')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Act
      await testFixture.executeAction('actor-charlie', 'letter');

      // Assert: Check that event was successfully dispatched without validation errors
      // If event name or payload is wrong, ValidatedEventDispatcher would log errors
      const itemDroppedEvent = testFixture.events.find(
        (e) => e.eventType === 'items-core:item_dropped'
      );

      expect(itemDroppedEvent).toBeDefined();

      // Verify no validation errors in captured events
      const validationErrors = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' &&
          e.payload?.message?.includes('items-core:item_dropped')
      );
      expect(validationErrors).toHaveLength(0);
    });
  });

  describe('Event Timing and Order', () => {
    it('should dispatch items-core:item_dropped before turn_ended', async () => {
      // Arrange (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('kitchen').asRoom('Kitchen').build();

      const actorBuilder = new ModEntityBuilder('actor-diana')
        .withName('Diana')
        .atLocation('kitchen')
        .asActor()
        .withComponent('items:inventory', {
          items: ['spoon'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      const item = new ModEntityBuilder('spoon')
        .withName('Spoon')
        .withComponent('items-core:item', {})
        .withComponent('items-core:portable', {})
        .withComponent('core:weight', { weight: 0.1 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Act
      await testFixture.executeAction('actor-diana', 'spoon');

      // Assert: Verify event order
      const itemDroppedIndex = testFixture.events.findIndex(
        (e) => e.eventType === 'items-core:item_dropped'
      );
      const turnEndedIndex = testFixture.events.findIndex(
        (e) => e.eventType === 'core:turn_ended'
      );

      expect(itemDroppedIndex).toBeGreaterThanOrEqual(0);
      expect(turnEndedIndex).toBeGreaterThan(0);
      expect(itemDroppedIndex).toBeLessThan(turnEndedIndex);
    });
  });
});
