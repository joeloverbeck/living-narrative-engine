/**
 * @file Integration test verifying that 'item.examine' perception type is properly validated.
 * @description Reproduces the validation error where DISPATCH_PERCEPTIBLE_EVENT operation
 * fails because 'item.examine' is missing from the operation schema enum.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import readItemRule from '../../../../data/mods/items/rules/handle_read_item.rule.json' assert { type: 'json' };
import eventIsActionReadItem from '../../../../data/mods/items/conditions/event-is-action-read-item.condition.json' assert { type: 'json' };

describe('items:read_item perception type validation', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:read_item',
      readItemRule,
      eventIsActionReadItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should dispatch perceptible event with item_read perception type without validation errors', async () => {
    // Arrange: Create a readable item scenario
    const room = new ModEntityBuilder('test_room').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('test:actor1')
      .withName('Test Actor')
      .atLocation('test_room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['test_letter'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const readableItem = new ModEntityBuilder('test_letter')
      .withName('Test Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:readable', {
        text: 'This is a test message.',
      })
      .build();

    testFixture.reset([room, actor, readableItem]);

    // Act: Execute the read_item action
    await testFixture.executeAction('test:actor1', 'test_letter');

    // Assert: Verify no validation errors occurred
    const errorEvents = testFixture.events.filter(
      (event) =>
        event.eventType === 'core:system_error' ||
        event.eventType === 'core:validation_error'
    );
    expect(errorEvents).toHaveLength(0);

    // Assert: Verify perceptible event was dispatched with correct perception type
    const perceptibleEvent = testFixture.events.find(
      (event) =>
        event.eventType === 'core:perceptible_event' &&
        event.payload.contextualData?.recipientIds?.includes('test:actor1')
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe('item.examine');

    // Assert: Verify event payload structure is correct
    expect(perceptibleEvent.payload).toMatchObject({
      eventName: 'core:perceptible_event',
      locationId: 'test_room',
      descriptionText: expect.stringContaining('reads Test Letter'),
      perceptionType: 'item.examine',
      actorId: 'test:actor1',
      targetId: 'test_letter',
      involvedEntities: expect.any(Array),
      contextualData: expect.objectContaining({
        recipientIds: ['test:actor1'],
      }),
    });

    // Assert: Verify the action completed successfully
    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('should log validation errors to console if schema mismatch exists', async () => {
    // Arrange: Capture console errors
    const consoleErrors = [];
    const originalConsoleError = console.error;
    console.error = (...args) => {
      consoleErrors.push(args.join(' '));
      originalConsoleError(...args);
    };

    // Arrange: Create scenario
    const room = new ModEntityBuilder('test_room').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('test:actor1')
      .withName('Test Actor')
      .atLocation('test_room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['test_note'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const readableItem = new ModEntityBuilder('test_note')
      .withName('Test Note')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:readable', {
        text: 'Important information.',
      })
      .build();

    testFixture.reset([room, actor, readableItem]);

    try {
      // Act: Execute action
      await testFixture.executeAction('test:actor1', 'test_note');

      // Assert: No validation errors should occur (after fix)
      const validationErrors = consoleErrors.filter(
        (msg) =>
          msg.includes('validation FAILED') ||
          msg.includes('must be equal to one of the allowed values')
      );
      expect(validationErrors).toHaveLength(0);
    } finally {
      // Cleanup: Restore console.error
      console.error = originalConsoleError;
    }
  });

  it('should include item_read in the list of valid perception types', async () => {
    // This test verifies that the operation schema has been updated
    // by attempting to dispatch the event and checking for validation success

    const room = new ModEntityBuilder('library').asRoom('Library').build();

    const actor = new ModEntityBuilder('test:actor1')
      .withName('Reader')
      .atLocation('library')
      .asActor()
      .withComponent('items:inventory', {
        items: ['book'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const book = new ModEntityBuilder('book')
      .withName('Ancient Book')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:readable', {
        text: 'In the beginning was the Word.',
      })
      .build();

    testFixture.reset([room, actor, book]);

    await testFixture.executeAction('test:actor1', 'book');

    // The mere fact that this executes without throwing means the validation passed
    const perceptibleEvent = testFixture.events.find(
      (event) =>
        event.eventType === 'core:perceptible_event' &&
        event.payload.perceptionType === 'item.examine'
    );

    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.perceptionType).toBe('item.examine');
  });
});
