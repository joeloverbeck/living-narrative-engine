/**
 * @file Integration test reproducing and verifying fixes for drop_item bugs
 * @description This test reproduces the specific bugs reported in the logs:
 * 1. TypeError: batchAddComponentsOptimized is not a function (line 232)
 *    - Root cause: EntityManagerAdapter was missing the method
 *    - Fix: Added batchAddComponentsOptimized delegation in EntityManagerAdapter
 * 2. VED: Payload validation FAILED for perceptionType "item_dropped" (line 296)
 *    - Root cause: Cascading failure from Issue 1
 *    - Fix: Resolves automatically when Issue 1 is fixed
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { EntityManagerAdapter } from '../../../../src/entities/entityManagerAdapter.js';
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('Drop Item - Bug Fixes from logs/127.0.0.1-1757518601476.log', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // Load additional condition required by the rule's "or" block
    await testFixture.loadDependencyConditions([
      'items:event-is-action-drop-wielded-item',
    ]);
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  describe('Issue 1: TypeError - batchAddComponentsOptimized is not a function', () => {
    it('should have batchAddComponentsOptimized method available on EntityManagerAdapter', () => {
      // The bug was that EntityManagerAdapter (used in production) didn't expose this method
      // even though the underlying EntityManager had it
      const adapter = new EntityManagerAdapter({
        entityManager: testFixture.entityManager,
        locationQueryService: {
          getEntitiesInLocation: () => new Set(),
        },
      });

      // Verify the adapter now has the method
      expect(adapter.batchAddComponentsOptimized).toBeDefined();
      expect(typeof adapter.batchAddComponentsOptimized).toBe('function');
    });

    it('should successfully call batchAddComponentsOptimized through adapter', async () => {
      // Setup adapter
      const adapter = new EntityManagerAdapter({
        entityManager: testFixture.entityManager,
        locationQueryService: {
          getEntitiesInLocation: () => new Set(),
        },
      });

      // Create test entities
      const room = new ModEntityBuilder('test-location').asRoom('Room').build();
      const item = new ModEntityBuilder('test-item')
        .withName('TestItem')
        .withComponent('items:item', {})
        .build();

      testFixture.reset([room, item]);

      // Test the method through the adapter (this is what production code does)
      const componentSpecs = [
        {
          instanceId: 'test-item',
          componentTypeId: 'core:position',
          componentData: { locationId: 'test-location' },
        },
      ];

      // This should NOT throw TypeError
      const result = await adapter.batchAddComponentsOptimized(
        componentSpecs,
        true
      );

      // Verify the method executed successfully
      expect(result).toBeDefined();
      expect(result.updateCount).toBe(1);

      // Verify the component was added via the adapter
      const itemAfter = adapter.getEntityInstance('test-item');
      expect(itemAfter.components['core:position']).toBeDefined();
      expect(itemAfter.components['core:position'].locationId).toBe(
        'test-location'
      );
    });

    it('should successfully call batchAddComponentsOptimized without TypeError', async () => {
      // Setup: Actor with item at location (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('p_erotica:patient_room_instance')
        .asRoom('Patient Room')
        .build();

      const actorBuilder = new ModEntityBuilder(
        'p_erotica:jon_urena_daydream_instance'
      )
        .withName('Jon Ureña')
        .atLocation('p_erotica:patient_room_instance')
        .asActor()
        .withComponent('items:inventory', {
          items: ['p_erotica:yellowed_goodbye_letter_instance'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      const item = new ModEntityBuilder(
        'p_erotica:yellowed_goodbye_letter_instance'
      )
        .withName('yellowed goodbye letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Act: Drop item - this previously threw TypeError at line 130
      await expect(
        testFixture.executeAction(
          'p_erotica:jon_urena_daydream_instance',
          'p_erotica:yellowed_goodbye_letter_instance'
        )
      ).resolves.not.toThrow();

      // Verify: Item was successfully dropped
      const actorAfter = testFixture.entityManager.getEntityInstance(
        'p_erotica:jon_urena_daydream_instance'
      );
      expect(actorAfter.components['items:inventory'].items).not.toContain(
        'p_erotica:yellowed_goodbye_letter_instance'
      );

      const itemAfter = testFixture.entityManager.getEntityInstance(
        'p_erotica:yellowed_goodbye_letter_instance'
      );
      expect(itemAfter.components['core:position']).toBeDefined();
      expect(itemAfter.components['core:position'].locationId).toBe(
        'p_erotica:patient_room_instance'
      );
    });
  });

  describe('Issue 2: VED validation failed for perceptionType "item_dropped"', () => {
    it('should accept "item_dropped" as valid perceptionType', async () => {
      // Setup: Same scenario as in logs (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('p_erotica:patient_room_instance')
        .asRoom('Patient Room')
        .build();

      const actorBuilder = new ModEntityBuilder(
        'p_erotica:jon_urena_daydream_instance'
      )
        .withName('Jon Ureña')
        .atLocation('p_erotica:patient_room_instance')
        .asActor()
        .withComponent('items:inventory', {
          items: ['p_erotica:yellowed_goodbye_letter_instance'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      const item = new ModEntityBuilder(
        'p_erotica:yellowed_goodbye_letter_instance'
      )
        .withName('yellowed goodbye letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Act: Drop item - this previously failed validation at line 296
      await testFixture.executeAction(
        'p_erotica:jon_urena_daydream_instance',
        'p_erotica:yellowed_goodbye_letter_instance'
      );

      // Assert: Perceptible event was dispatched successfully
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );

      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe('item_dropped');
      expect(perceptibleEvent.payload.locationId).toBe(
        'p_erotica:patient_room_instance'
      );
      expect(perceptibleEvent.payload.actorId).toBe(
        'p_erotica:jon_urena_daydream_instance'
      );
      expect(perceptibleEvent.payload.targetId).toBe(
        'p_erotica:yellowed_goodbye_letter_instance'
      );
      expect(perceptibleEvent.payload.involvedEntities).toEqual([]);
      expect(perceptibleEvent.payload.descriptionText).toContain('Jon Ureña');
      expect(perceptibleEvent.payload.descriptionText).toContain('drops');
      expect(perceptibleEvent.payload.descriptionText).toContain(
        'yellowed goodbye letter'
      );
    });

    it('should not emit validation warnings for item_dropped perceptionType', async () => {
      // Setup (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('location-1').asRoom('Room').build();
      const actorBuilder = new ModEntityBuilder('actor-1')
        .withName('Actor')
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
        .withName('Item')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.5 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Act
      await testFixture.executeAction('actor-1', 'item-1');

      // Assert: No validation errors should be present
      const errorEvents = testFixture.events.filter(
        (e) =>
          e.eventType === 'core:system_error_occurred' &&
          e.payload?.message?.includes('validation')
      );

      expect(errorEvents).toHaveLength(0);

      // Assert: Perceptible event exists with correct type
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe('item_dropped');
    });
  });

  describe('Full workflow verification', () => {
    it('should complete full drop item workflow without errors', async () => {
      // This test verifies the complete workflow from the logs works end-to-end
      // (with grabbing hands for prerequisite)
      const room = new ModEntityBuilder('p_erotica:patient_room_instance')
        .asRoom('Patient Room')
        .build();

      const actorBuilder = new ModEntityBuilder(
        'p_erotica:jon_urena_daydream_instance'
      )
        .withName('Jon Ureña')
        .atLocation('p_erotica:patient_room_instance')
        .asActor()
        .withComponent('items:inventory', {
          items: ['p_erotica:yellowed_goodbye_letter_instance'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withGrabbingHands(2);
      const actor = actorBuilder.build();
      const handEntities = actorBuilder.getHandEntities();

      const item = new ModEntityBuilder(
        'p_erotica:yellowed_goodbye_letter_instance'
      )
        .withName('yellowed goodbye letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.05 })
        .build();

      testFixture.reset([room, actor, ...handEntities, item]);

      // Execute the complete workflow
      await testFixture.executeAction(
        'p_erotica:jon_urena_daydream_instance',
        'p_erotica:yellowed_goodbye_letter_instance'
      );

      // Verify all steps completed successfully

      // 1. Item removed from inventory
      const actorAfter = testFixture.entityManager.getEntityInstance(
        'p_erotica:jon_urena_daydream_instance'
      );
      expect(actorAfter.components['items:inventory'].items).not.toContain(
        'p_erotica:yellowed_goodbye_letter_instance'
      );

      // 2. Item has position component
      const itemAfter = testFixture.entityManager.getEntityInstance(
        'p_erotica:yellowed_goodbye_letter_instance'
      );
      expect(itemAfter.components['core:position']).toBeDefined();
      expect(itemAfter.components['core:position'].locationId).toBe(
        'p_erotica:patient_room_instance'
      );

      // 3. ITEM_DROPPED event was dispatched (internal event, not captured in testFixture.events)
      // Note: ITEM_DROPPED is an internal event from the handler, not a system event

      // 4. Perceptible event was dispatched with correct type
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.perceptionType).toBe('item_dropped');

      // 5. Turn ended successfully
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);

      // 6. No error events
      const systemErrorEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:system_error_occurred'
      );
      expect(systemErrorEvents).toHaveLength(0);
    });
  });
});
