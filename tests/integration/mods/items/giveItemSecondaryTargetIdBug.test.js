/**
 * @file Reproduction tests for give_item bugs
 * @description This test file reproduces and validates fixes for two bugs:
 * 1. secondaryTargetId placeholder bug (FIXED) - rule used wrong placeholder name
 * 2. Dispatch signature bug (FIXED) - transferItemHandler used wrong dispatch signature
 *
 * Bug symptoms:
 * - PlaceholderResolver warns: Placeholder "{event.payload.secondaryTargetId}" not found
 * - VALIDATE_INVENTORY_CAPACITY receives empty itemEntity parameter
 * - getEventDefinition warns: "called with invalid ID: [object Object]"
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import giveItemRule from '../../../../data/mods/item-transfer/rules/handle_give_item.rule.json' assert { type: 'json' };
import eventIsActionGiveItem from '../../../../data/mods/item-transfer/conditions/event-is-action-give-item.condition.json' assert { type: 'json' };

describe('give_item secondaryTargetId placeholder bug reproduction', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'item-transfer',
      'item-transfer:give_item',
      giveItemRule,
      eventIsActionGiveItem
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should correctly resolve secondaryId placeholder (not secondaryTargetId)', async () => {
    // Arrange: Setup scenario with actors and item
    const room = new ModEntityBuilder('test-room').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['test-letter'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const target = new ModEntityBuilder('test:actor2')
      .withName('Bob')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const letter = new ModEntityBuilder('test-letter')
      .withName('letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, target, letter]);

    // Act: Execute give_item action
    // According to the multi-target event spec, the payload should use secondaryId
    // not secondaryTargetId (which was causing the placeholder resolution failure)
    await testFixture.executeAction('test:actor1', 'test:actor2', {
      additionalPayload: {
        secondaryId: 'test-letter',
      },
    });

    // Assert: Verify the action succeeded (which means placeholders were resolved correctly)
    const turnEndedEvent = testFixture.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );

    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);

    // Verify the transfer actually happened
    const actorAfter =
      testFixture.entityManager.getEntityInstance('test:actor1');
    const targetAfter =
      testFixture.entityManager.getEntityInstance('test:actor2');

    expect(actorAfter.components['items:inventory'].items).not.toContain(
      'test-letter'
    );
    expect(targetAfter.components['items:inventory'].items).toContain(
      'test-letter'
    );
  });

  it('should NOT have placeholder warnings in logs', async () => {
    // Arrange
    const room = new ModEntityBuilder('test-room').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['test-item'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const target = new ModEntityBuilder('test:actor2')
      .withName('Bob')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const item = new ModEntityBuilder('test-item')
      .withName('test item')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.1 })
      .build();

    testFixture.reset([room, actor, target, item]);

    // Capture logger warnings
    const mockLogger = testFixture.logger;
    const warnSpy = jest.spyOn(mockLogger, 'warn');

    // Act
    await testFixture.executeAction('test:actor1', 'test:actor2', {
      additionalPayload: {
        secondaryId: 'test-item',
      },
    });

    // Assert: Should NOT have any placeholder warnings
    const placeholderWarnings = warnSpy.mock.calls.filter(
      (call) =>
        call[0]?.includes('Placeholder') || call[0]?.includes('not found')
    );

    expect(placeholderWarnings).toHaveLength(0);

    warnSpy.mockRestore();
  });

  it('should pass correct itemEntity to VALIDATE_INVENTORY_CAPACITY', async () => {
    // Arrange: Setup scenario where capacity check will fail
    const room = new ModEntityBuilder('test-room').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: ['heavy-item'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();

    const target = new ModEntityBuilder('test:actor2')
      .withName('Bob')
      .atLocation('test-room')
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 5, maxItems: 10 }, // Too small for heavy item
      })
      .build();

    const heavyItem = new ModEntityBuilder('heavy-item')
      .withName('heavy item')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 10.0 }) // Exceeds target capacity
      .build();

    testFixture.reset([room, actor, target, heavyItem]);

    // Act
    await testFixture.executeAction('test:actor1', 'test:actor2', {
      additionalPayload: {
        secondaryId: 'heavy-item',
      },
    });

    // Assert: Should have proper failure message with reason
    const failureEvent = testFixture.events.find(
      (e) => e.eventType === 'core:display_failed_action_result'
    );

    expect(failureEvent).toBeDefined();
    // The message includes the item name and the reason from capacityCheck
    expect(failureEvent.payload.message).toContain('heavy item');
    expect(failureEvent.payload.message).toContain('max_weight_exceeded');

    // Verify item didn't move
    const actorAfter =
      testFixture.entityManager.getEntityInstance('test:actor1');
    expect(actorAfter.components['items:inventory'].items).toContain(
      'heavy-item'
    );
  });

  describe('dispatch signature bug fix', () => {
    it('dispatches items:item_transferred event with correct signature', async () => {
      // Arrange: Create test entities
      const room = new ModEntityBuilder('test-room')
        .asRoom('Test Room')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('test-room')
        .asActor()
        .withComponent('items:inventory', {
          items: ['test-item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const target = new ModEntityBuilder('test:actor2')
        .withName('Bob')
        .atLocation('test-room')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('test-item')
        .withName('Test Item')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 1.0 })
        .build();

      testFixture.reset([room, actor, target, item]);

      // Act: Execute give_item action
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'test-item',
        },
      });

      // Assert: Verify items:item_transferred event was dispatched
      const itemTransferredEvent = testFixture.events.find(
        (e) => e.eventType === 'items:item_transferred'
      );

      expect(itemTransferredEvent).toBeDefined();
      expect(itemTransferredEvent.eventType).toBe('items:item_transferred');
      expect(itemTransferredEvent.payload).toMatchObject({
        fromEntity: 'test:actor1',
        toEntity: 'test:actor2',
        itemEntity: 'test-item',
      });
    });

    it('does NOT log getEventDefinition warnings during dispatch', async () => {
      // Arrange: Create test entities
      const room = new ModEntityBuilder('test-room')
        .asRoom('Test Room')
        .build();

      const actor = new ModEntityBuilder('test:actor1')
        .withName('Charlie')
        .atLocation('test-room')
        .asActor()
        .withComponent('items:inventory', {
          items: ['letter-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const target = new ModEntityBuilder('test:actor2')
        .withName('Diana')
        .atLocation('test-room')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const letter = new ModEntityBuilder('letter-1')
        .withName('Letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.1 })
        .build();

      testFixture.reset([room, actor, target, letter]);

      // Capture logger warnings
      const mockLogger = testFixture.logger;
      const warnSpy = jest.spyOn(mockLogger, 'warn');

      // Act: Execute give_item action
      await testFixture.executeAction('test:actor1', 'test:actor2', {
        additionalPayload: {
          secondaryId: 'letter-1',
        },
      });

      // Assert: No warnings should be logged about invalid event IDs
      const invalidEventWarnings = warnSpy.mock.calls.filter((call) => {
        const message = call.join(' ');
        return (
          message.includes('getEventDefinition') &&
          message.includes('invalid ID')
        );
      });

      expect(invalidEventWarnings).toHaveLength(0);

      // Cleanup
      warnSpy.mockRestore();
    });
  });
});
