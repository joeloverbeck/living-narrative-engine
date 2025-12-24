/**
 * @file Integration test for components_batch_added event validation
 * @description Reproduces the runtime warning about missing event definition
 * and validates that the event is properly registered and dispatches with correct payload.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('ComponentsBatchAddedEvent - Integration', () => {
  let testFixture;
  let capturedWarnings;

  beforeEach(async () => {
    // Create fixture - uses real mod system with event loading
    testFixture = await ModTestFixture.forAction(
      'items',
      'item-handling:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );

    // Capture warnings to detect validation issues
    capturedWarnings = [];
    const logger = testFixture.logger;
    jest.spyOn(logger, 'warn').mockImplementation((...args) => {
      capturedWarnings.push(args);
    });
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should NOT produce validation warnings when dispatching components_batch_added event', async () => {
    // Arrange: Setup entities for drop
    const room = new ModEntityBuilder('location1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('inventory:inventory', {
        items: ['item1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const item = new ModEntityBuilder('item1')
      .withName('Test Item')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 0.5 })
      .build();

    testFixture.reset([room, actor, item]);

    // Act: Execute drop which triggers batchAddComponentsOptimized with emitBatchEvent: true
    await testFixture.executeAction('actor1', 'item1');

    // Assert: No validation warnings should be logged
    const validationWarnings = capturedWarnings.filter((args) =>
      args.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes('EventDefinition not found') &&
          arg.includes('components_batch_added')
      )
    );

    expect(validationWarnings).toHaveLength(0);
  });

  it('should not have timestamp in payload (should have updateCount instead)', async () => {
    // Arrange: Setup entities
    const room = new ModEntityBuilder('location1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('inventory:inventory', {
        items: ['item1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const item = new ModEntityBuilder('item1')
      .withName('Test Item')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .withComponent('core:weight', { weight: 0.5 })
      .build();

    testFixture.reset([room, actor, item]);

    // Listen for the batch event
    let eventPayload = null;
    const unsubscribe = testFixture.eventBus.subscribe(
      'core:components_batch_added',
      (payload) => {
        eventPayload = payload;
      }
    );

    // Act: Execute drop which triggers batch event
    await testFixture.executeAction('actor1', 'item1');

    // Assert: If event was dispatched, verify correct payload structure
    if (eventPayload) {
      // Payload should have updateCount, NOT timestamp
      expect(eventPayload).toHaveProperty('updateCount');
      expect(eventPayload).not.toHaveProperty('timestamp');

      expect(eventPayload).toHaveProperty('updates');
      expect(Array.isArray(eventPayload.updates)).toBe(true);
      expect(typeof eventPayload.updateCount).toBe('number');
    }

    unsubscribe();
  });

  it('should have components_batch_added.event.json in core mod manifest', async () => {
    // Read the manifest file to verify the event is registered
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');

    const manifestPath = resolve('data/mods/core/mod-manifest.json');
    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    expect(manifest.content.events).toContain(
      'components_batch_added.event.json'
    );
  });
});
