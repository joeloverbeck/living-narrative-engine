/**
 * @file Integration test for drop_item action handler instantiation and execution
 * @description Validates that DropItemAtLocationHandler can be instantiated without DI errors
 * and executes successfully. This test reproduces the original bug where the handler
 * failed to instantiate due to premature validation of batchAddComponentsOptimized method.
 *
 * Note: Timeout behavior is tested in unit tests (awaitingExternalTurnEndState.test.js)
 * with mock timers for faster execution. This integration test focuses on real-world
 * execution with the rule present.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/item-handling/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/item-handling/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

/**
 * Helper to create a basic drop scenario
 *
 * @returns {{room: object, actor: object, item: object, handEntities: object[]}} Test entities
 */
function createDropScenario() {
  const room = new ModEntityBuilder('location-1').asRoom('Test Room').build();

  const actorBuilder = new ModEntityBuilder('actor-1')
    .withName('TestActor')
    .atLocation('location-1')
    .asActor()
    .withComponent('items:inventory', {
      items: ['item-1'],
      capacity: { maxWeight: 50, maxItems: 10 },
    })
    .withGrabbingHands(2);
  const actor = actorBuilder.build();
  const handEntities = actorBuilder.getHandEntities();

  const item = new ModEntityBuilder('item-1')
    .withName('TestItem')
    .withComponent('items-core:item', {})
    .withComponent('items-core:portable', {})
    .withComponent('core:weight', { weight: 0.5 })
    .build();

  return { room, actor, item, handEntities };
}

describe('drop_item action handler instantiation and execution', () => {
  let testFixture;

  beforeEach(async () => {
    // Create fixture WITH the rule to test real-world execution
    // The original bug: handler failed to instantiate during DI container bootstrap
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
    testFixture?.cleanup();
  });

  describe('handler instantiation', () => {
    it('should successfully instantiate handler from DI container without errors', async () => {
      const scenario = createDropScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        ...scenario.handEntities,
        scenario.item,
      ]);

      // The act of executing the action triggers handler instantiation
      // If handler creation fails, this will throw an error
      await expect(
        testFixture.executeAction('actor-1', 'item-1')
      ).resolves.not.toThrow();
    });

    it('should not throw validation errors about missing methods', async () => {
      const scenario = createDropScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        ...scenario.handEntities,
        scenario.item,
      ]);

      // Execute - should not throw any errors
      await expect(
        testFixture.executeAction('actor-1', 'item-1')
      ).resolves.not.toThrow();

      // Specifically verify no DI validation errors were thrown
      // (If there were such errors, the above would have failed)
    });
  });

  describe('successful execution', () => {
    it('should complete drop operation successfully', async () => {
      const scenario = createDropScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        ...scenario.handEntities,
        scenario.item,
      ]);

      const startTime = Date.now();
      await testFixture.executeAction('actor-1', 'item-1');
      const elapsed = Date.now() - startTime;

      // Should complete quickly when rule is present
      expect(elapsed).toBeLessThan(1000);

      // Verify item was dropped from inventory
      const actor = testFixture.entityManager.getEntityInstance('actor-1');
      expect(actor.components['items:inventory'].items).not.toContain('item-1');

      // Verify item has position at location
      const item = testFixture.entityManager.getEntityInstance('item-1');
      expect(item.components['core:position']).toBeDefined();
      expect(item.components['core:position'].locationId).toBe('location-1');
    });

    it('should NOT dispatch system error events on successful execution', async () => {
      const scenario = createDropScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        ...scenario.handEntities,
        scenario.item,
      ]);

      await testFixture.executeAction('actor-1', 'item-1');

      // No system error should be dispatched for successful operation
      const systemError = testFixture.events.find(
        (e) => e.eventType === 'core:system_error_occurred'
      );
      expect(systemError).toBeUndefined();
    });

    it('should dispatch expected events in correct order', async () => {
      const scenario = createDropScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        ...scenario.handEntities,
        scenario.item,
      ]);

      await testFixture.executeAction('actor-1', 'item-1');

      // Expected event sequence
      const attemptAction = testFixture.events.find(
        (e) => e.eventType === 'core:attempt_action'
      );
      const itemDropped = testFixture.events.find(
        (e) => e.eventType === 'items-core:item_dropped'
      );
      const turnEnded = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );

      expect(attemptAction).toBeDefined();
      expect(itemDropped).toBeDefined();
      expect(turnEnded).toBeDefined();

      // Verify turn ended successfully
      expect(turnEnded.payload.success).toBe(true);
      expect(turnEnded.payload.entityId).toBe('actor-1');
    });
  });

  describe('event payload schema compliance', () => {
    it('should dispatch events with schema-compliant payloads', async () => {
      const scenario = createDropScenario();
      testFixture.reset([
        scenario.room,
        scenario.actor,
        ...scenario.handEntities,
        scenario.item,
      ]);

      await testFixture.executeAction('actor-1', 'item-1');

      // All events should be schema-compliant (no validation errors logged)
      const events = testFixture.events;
      expect(events.length).toBeGreaterThan(0);

      // Filter to system error events (if any exist)
      const systemErrors = events.filter(
        (e) => e.eventType === 'core:system_error_occurred'
      );

      // Validate each system error event payload
      for (const event of systemErrors) {
        expect(event.payload.message).toBeDefined();
        expect(typeof event.payload.message).toBe('string');

        const details = event.payload.details;
        const allowedProps = [
          'statusCode',
          'url',
          'raw',
          'stack',
          'timestamp',
          'scopeName',
          'errorContext',
          'actionId',
          'phase',
          'targetId',
        ];

        // Verify no additional properties beyond allowed list
        const detailKeys = details ? Object.keys(details) : [];
        const invalidKeys = detailKeys.filter(
          (key) => !allowedProps.includes(key)
        );
        expect(invalidKeys).toEqual([]);

        // Specifically verify 'code' and 'actorId' are not present
        expect(details?.code).toBeUndefined();
        expect(details?.actorId).toBeUndefined();
      }
    });
  });
});
