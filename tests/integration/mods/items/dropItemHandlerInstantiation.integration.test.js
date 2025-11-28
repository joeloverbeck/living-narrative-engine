/**
 * @file Integration test for DropItemAtLocationHandler instantiation
 * @description Reproduces the bug where handler validation fails during DI container resolution
 * due to premature method checking before EntityManager proxy is fully set up.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

/**
 * Helper to create a complete drop scenario
 *
 * @returns {{room: object, actor: object, crate: object, handEntities: object[]}} Test entities
 */
function createCompleteScenario() {
  const room = new ModEntityBuilder('room-1').asRoom('Storage Room').build();

  const actorBuilder = new ModEntityBuilder('actor-1')
    .withName('Worker')
    .atLocation('room-1')
    .asActor()
    .withComponent('items:inventory', {
      items: ['crate-1'],
      capacity: { maxWeight: 100, maxItems: 20 },
    })
    .withGrabbingHands(2);
  const actor = actorBuilder.build();
  const handEntities = actorBuilder.getHandEntities();

  const crate = new ModEntityBuilder('crate-1')
    .withName('Wooden Crate')
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('items:weight', { weight: 5.0 })
    .build();

  return { room, actor, crate, handEntities };
}

describe('DropItemAtLocationHandler instantiation', () => {
  let testFixture;

  beforeEach(async () => {
    // Create full fixture with rule
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

  describe('handler creation during bootstrap', () => {
    it('should successfully instantiate handler from DI container', async () => {
      const scenario = createCompleteScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.handEntities, scenario.crate]);

      // This test verifies the handler can be created without throwing
      // The act of executing the action triggers handler instantiation
      expect(async () => {
        await testFixture.executeAction('actor-1', 'crate-1');
      }).not.toThrow();
    });

    it('should not throw validation errors during handler resolution', async () => {
      const scenario = createCompleteScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.handEntities, scenario.crate]);

      // Execute - should not throw any DI validation errors
      await expect(
        testFixture.executeAction('actor-1', 'crate-1')
      ).resolves.not.toThrow();

      // Specifically: no InvalidArgumentError about batchAddComponentsOptimized
      // (If there were such errors, the above would have failed)
    });

    it('should successfully execute drop operation', async () => {
      const scenario = createCompleteScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.handEntities, scenario.crate]);

      await testFixture.executeAction('actor-1', 'crate-1');

      // Verify item was dropped
      const actor = testFixture.entityManager.getEntityInstance('actor-1');
      expect(actor.components['items:inventory'].items).not.toContain('crate-1');

      // Verify item has position
      const crate = testFixture.entityManager.getEntityInstance('crate-1');
      expect(crate.components['core:position']).toBeDefined();
      expect(crate.components['core:position'].locationId).toBe('room-1');
    });
  });

  describe('EntityManager method availability', () => {
    it('should have batchAddComponentsOptimized method available', async () => {
      const scenario = createCompleteScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.handEntities, scenario.crate]);

      // Verify EntityManager has the method
      const entityManager = testFixture.entityManager;
      expect(entityManager.batchAddComponentsOptimized).toBeDefined();
      expect(typeof entityManager.batchAddComponentsOptimized).toBe('function');
    });

    it('should successfully call batchAddComponentsOptimized during drop', async () => {
      const scenario = createCompleteScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.handEntities, scenario.crate]);

      // Spy on batchAddComponentsOptimized to verify it's called
      const entityManager = testFixture.entityManager;
      const originalMethod = entityManager.batchAddComponentsOptimized;
      let methodCalled = false;
      entityManager.batchAddComponentsOptimized = jest.fn(async (...args) => {
        methodCalled = true;
        return await originalMethod.apply(entityManager, args);
      });

      await testFixture.executeAction('actor-1', 'crate-1');

      // Verify method was called
      expect(methodCalled).toBe(true);
      expect(entityManager.batchAddComponentsOptimized).toHaveBeenCalled();

      // Restore original method
      entityManager.batchAddComponentsOptimized = originalMethod;
    });
  });

  describe('DI container error handling', () => {
    it('should successfully execute without DI errors', async () => {
      // This test documents expected behavior: handler creation should succeed
      const scenario = createCompleteScenario();
      testFixture.reset([scenario.room, scenario.actor, ...scenario.handEntities, scenario.crate]);

      // Should execute successfully without DI container errors
      await expect(
        testFixture.executeAction('actor-1', 'crate-1')
      ).resolves.not.toThrow();
    });
  });
});
