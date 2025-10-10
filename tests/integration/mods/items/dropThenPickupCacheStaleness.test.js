/**
 * @file Integration tests for cache staleness bug in drop/pickup workflow
 * @description Reproduces and verifies the entity cache staleness bug that prevents
 * pickup actions from being available after dropping items.
 *
 * Bug: Entity cache in scopeDsl/core/entityHelpers.js is not invalidated when
 * entities are mutated, causing scope evaluation to read stale data.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };

describe('Drop/Pickup - Cache Staleness Bug Reproduction', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:drop_item',
      dropItemRule,
      eventIsActionDropItem
    );
    // Clear cache before each test for isolation
    clearEntityCache();
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
    // Clean up cache after tests
    clearEntityCache();
  });

  it('CONTROL: should find pickup action when cache is clear', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item]);

    // Execute drop action
    const dropResult = await testFixture.executeAction('test:actor1', 'letter-1');
    expect(dropResult).toBeDefined();

    // CRITICAL: Clear cache to force fresh reads
    clearEntityCache();

    // Discover available actions
    const actions = await testFixture.discoverActions('test:actor1');

    // Verify pickup action is available
    const pickupAction = actions.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'letter-1'
    );

    expect(pickupAction).toBeDefined();
    expect(pickupAction.actionId).toBe('items:pick_up_item');
    expect(pickupAction.targets.primary.entityId).toBe('letter-1');
  });

  it('BUG REPRODUCTION: should fail when cache contains stale entity', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item]);

    // CRITICAL STEP: Prime cache with item BEFORE drop
    // Force scope evaluation that caches the item WITHOUT position
    const actionsBeforeDrop = await testFixture.discoverActions('test:actor1');

    // Verify no pickup actions available before drop (item in inventory)
    const pickupBeforeDrop = actionsBeforeDrop.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'letter-1'
    );
    expect(pickupBeforeDrop).toBeUndefined(); // Item in inventory, not at location

    // Execute drop action
    // This updates entity manager storage but does NOT invalidate cache
    const dropResult = await testFixture.executeAction('test:actor1', 'letter-1');
    expect(dropResult).toBeDefined();

    // Verify drop was successful (direct entity manager query)
    const droppedItem = testFixture.entityManager.getEntityInstance('letter-1');
    expect(droppedItem.components['core:position']).toBeDefined();
    expect(droppedItem.components['core:position'].locationId).toBe('saloon1');
    expect(droppedItem.components['items:item']).toBeDefined();
    expect(droppedItem.components['items:portable']).toBeDefined();

    // Discover actions again
    // This will use STALE cached entity that lacks core:position component
    const actionsAfterDrop = await testFixture.discoverActions('test:actor1');

    // Verify pickup action is NOT available (bug reproduced)
    const pickupAfterDrop = actionsAfterDrop.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'letter-1'
    );

    // THIS ASSERTION DOCUMENTS THE BUG
    // Expected: pickupAfterDrop should be defined (item is at location)
    // Actual: pickupAfterDrop is undefined (stale cache prevents discovery)
    expect(pickupAfterDrop).toBeUndefined();
  });

  it('should demonstrate cache prevents finding dropped items', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item]);

    // Prime cache by discovering actions before drop
    await testFixture.discoverActions('test:actor1');

    // Drop item
    await testFixture.executeAction('test:actor1', 'letter-1');

    // Verify entity manager has correct data (bypasses cache)
    const droppedItem = testFixture.entityManager.getEntityInstance('letter-1');
    expect(droppedItem.components['core:position']).toBeDefined();
    expect(droppedItem.components['core:position'].locationId).toBe('saloon1');
    expect(droppedItem.components['items:item']).toBeDefined();
    expect(droppedItem.components['items:portable']).toBeDefined();
    expect(droppedItem.components['items:weight']).toBeDefined();

    // But action discovery fails due to stale cache
    const actions = await testFixture.discoverActions('test:actor1');
    const pickupAction = actions.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'letter-1'
    );

    // Bug manifests: entity data is correct, but cache causes discovery to fail
    expect(pickupAction).toBeUndefined();
  });

  it('should work correctly if cache is cleared between operations', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item]);

    // Discover actions (primes cache)
    await testFixture.discoverActions('test:actor1');

    // Drop item
    await testFixture.executeAction('test:actor1', 'letter-1');

    // WORKAROUND: Clear cache to force fresh reads
    clearEntityCache();

    // Discover actions again (with fresh cache)
    const actions = await testFixture.discoverActions('test:actor1');

    // With cleared cache, pickup action should be available
    const pickupAction = actions.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'letter-1'
    );

    expect(pickupAction).toBeDefined();
    expect(pickupAction.actionId).toBe('items:pick_up_item');
  });

  it('should handle multiple drop/pickup cycles with cache clearing', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1', 'gun-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .build();
    const letter = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 0.05 })
      .build();
    const gun = new ModEntityBuilder('gun-1')
      .withName('Gun')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('items:weight', { weight: 1.2 })
      .build();

    testFixture.reset([room, actor, letter, gun]);

    // Drop letter
    await testFixture.executeAction('test:actor1', 'letter-1');
    clearEntityCache(); // Clear cache after mutation

    // Verify letter can be picked up
    let actions = await testFixture.discoverActions('test:actor1');
    let letterPickup = actions.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'letter-1'
    );
    expect(letterPickup).toBeDefined();

    // Drop gun
    await testFixture.executeAction('test:actor1', 'gun-1');
    clearEntityCache(); // Clear cache after mutation

    // Verify both items can be picked up
    actions = await testFixture.discoverActions('test:actor1');
    letterPickup = actions.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'letter-1'
    );
    const gunPickup = actions.find(
      (a) =>
        a.actionId === 'items:pick_up_item' &&
        a.targets?.primary?.entityId === 'gun-1'
    );

    expect(letterPickup).toBeDefined();
    expect(gunPickup).toBeDefined();
  });
});
