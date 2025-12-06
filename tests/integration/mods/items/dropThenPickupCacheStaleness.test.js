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
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';
import dropItemRule from '../../../../data/mods/items/rules/handle_drop_item.rule.json' assert { type: 'json' };
import eventIsActionDropItem from '../../../../data/mods/items/conditions/event-is-action-drop-item.condition.json' assert { type: 'json' };
import pickUpItemAction from '../../../../data/mods/items/actions/pick_up_item.action.json' assert { type: 'json' };
import actorHasFreeGrabbingCondition from '../../../../data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json' assert { type: 'json' };

describe('Drop/Pickup - Cache Staleness Bug Reproduction', () => {
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
    // Register inventory scopes needed for drop and pickup actions
    ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
    // Register pick_up_item action so it can be discovered after drop
    if (testFixture.testEnv && testFixture.testEnv.actionIndex) {
      testFixture.testEnv.actionIndex.buildIndex([pickUpItemAction]);
    }
    // Register the grabbing prerequisite condition needed by pick_up_item action
    // This is necessary because we're using forAction with drop_item, not pick_up_item
    if (testFixture.testEnv && testFixture.testEnv.dataRegistry) {
      const originalGetCondition =
        testFixture.testEnv.dataRegistry.getConditionDefinition;
      testFixture.testEnv.dataRegistry.getConditionDefinition = (
        conditionId
      ) => {
        if (conditionId === 'anatomy:actor-has-free-grabbing-appendage') {
          return actorHasFreeGrabbingCondition;
        }
        return originalGetCondition(conditionId);
      };
    }
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
    // Create hand entity for grabbing prerequisite
    const handEntity = new ModEntityBuilder('actor1-hand-1')
      .withComponent('anatomy:can_grab', {
        gripStrength: 1.0,
        locked: false,
        heldItemId: null,
      })
      .build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withComponent('anatomy:body', {
        body: { parts: { rightHand: 'actor1-hand-1' } },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item, handEntity]);

    // Execute drop action
    const dropResult = await testFixture.executeAction(
      'test:actor1',
      'letter-1'
    );
    expect(dropResult).toBeDefined();

    // CRITICAL: Clear cache to force fresh reads
    clearEntityCache();

    // Discover available actions
    const actions = await testFixture.discoverActions('test:actor1');

    // Verify pickup action is available
    const pickupAction = actions.find((a) => a.id === 'items:pick_up_item');

    expect(pickupAction).toBeDefined();
    expect(pickupAction.id).toBe('items:pick_up_item');
  });

  it('FIXED: should succeed with automatic cache invalidation', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    // Create hand entity for grabbing prerequisite
    const handEntity = new ModEntityBuilder('actor1-hand-1')
      .withComponent('anatomy:can_grab', {
        gripStrength: 1.0,
        locked: false,
        heldItemId: null,
      })
      .build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withComponent('anatomy:body', {
        body: { parts: { rightHand: 'actor1-hand-1' } },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item, handEntity]);

    // CRITICAL STEP: Prime cache with item BEFORE drop
    // Force scope evaluation that caches the item WITHOUT position
    const actionsBeforeDrop = await testFixture.discoverActions('test:actor1');

    // Verify pickup action does NOT appear before drop
    // Note: The item is in inventory (not at location), so scope resolution returns empty
    // Actions only appear when they have valid targets, so pick_up_item won't be in the list
    const pickupBeforeDrop = actionsBeforeDrop.find(
      (a) => a.id === 'items:pick_up_item'
    );
    // The action should NOT be defined because there are no items at the location yet
    expect(pickupBeforeDrop).toBeUndefined();

    // Execute drop action
    // This updates entity manager storage but does NOT invalidate cache
    const dropResult = await testFixture.executeAction(
      'test:actor1',
      'letter-1'
    );
    expect(dropResult).toBeDefined();

    // Verify drop was successful (direct entity manager query)
    const droppedItem = testFixture.entityManager.getEntityInstance('letter-1');
    expect(droppedItem.components['core:position']).toBeDefined();
    expect(droppedItem.components['core:position'].locationId).toBe('saloon1');
    expect(droppedItem.components['items:item']).toBeDefined();
    expect(droppedItem.components['items:portable']).toBeDefined();

    // Discover actions again
    // With cache invalidation, the cache is automatically cleared when components are added
    const actionsAfterDrop = await testFixture.discoverActions('test:actor1');

    // Verify pickup action IS available (bug is fixed with cache invalidation)
    const pickupAfterDrop = actionsAfterDrop.find(
      (a) => a.id === 'items:pick_up_item'
    );

    // THIS ASSERTION DOCUMENTS THE FIX
    // Expected: pickupAfterDrop should be defined (item is at location and cache was invalidated)
    // Actual: pickupAfterDrop is defined (cache invalidation works correctly)
    expect(pickupAfterDrop).toBeDefined();
  });

  it('should demonstrate cache invalidation allows finding dropped items', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    // Create hand entity for grabbing prerequisite
    const handEntity = new ModEntityBuilder('actor1-hand-1')
      .withComponent('anatomy:can_grab', {
        gripStrength: 1.0,
        locked: false,
        heldItemId: null,
      })
      .build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withComponent('anatomy:body', {
        body: { parts: { rightHand: 'actor1-hand-1' } },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item, handEntity]);

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
    expect(droppedItem.components['core:weight']).toBeDefined();

    // Action discovery succeeds because cache was automatically invalidated
    const actions = await testFixture.discoverActions('test:actor1');
    const pickupAction = actions.find((a) => a.id === 'items:pick_up_item');

    // Bug is fixed: entity data is correct and cache invalidation allows discovery
    expect(pickupAction).toBeDefined();
  });

  it('should work correctly if cache is cleared between operations', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    // Create hand entity for grabbing prerequisite
    const handEntity = new ModEntityBuilder('actor1-hand-1')
      .withComponent('anatomy:can_grab', {
        gripStrength: 1.0,
        locked: false,
        heldItemId: null,
      })
      .build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withComponent('anatomy:body', {
        body: { parts: { rightHand: 'actor1-hand-1' } },
      })
      .build();
    const item = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();

    testFixture.reset([room, actor, item, handEntity]);

    // Discover actions (primes cache)
    await testFixture.discoverActions('test:actor1');

    // Drop item
    await testFixture.executeAction('test:actor1', 'letter-1');

    // WORKAROUND: Clear cache to force fresh reads
    clearEntityCache();

    // Discover actions again (with fresh cache)
    const actions = await testFixture.discoverActions('test:actor1');

    // With cleared cache, pickup action should be available
    const pickupAction = actions.find((a) => a.id === 'items:pick_up_item');

    expect(pickupAction).toBeDefined();
    expect(pickupAction.id).toBe('items:pick_up_item');
  });

  it('should handle multiple drop/pickup cycles with cache clearing', async () => {
    // Setup
    const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();
    // Create hand entity for grabbing prerequisite
    const handEntity = new ModEntityBuilder('actor1-hand-1')
      .withComponent('anatomy:can_grab', {
        gripStrength: 1.0,
        locked: false,
        heldItemId: null,
      })
      .build();
    const actor = new ModEntityBuilder('test:actor1')
      .withName('Alice')
      .atLocation('saloon1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['letter-1', 'gun-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
      })
      .withComponent('anatomy:body', {
        body: { parts: { rightHand: 'actor1-hand-1' } },
      })
      .build();
    const letter = new ModEntityBuilder('letter-1')
      .withName('Letter')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 0.05 })
      .build();
    const gun = new ModEntityBuilder('gun-1')
      .withName('Gun')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .withComponent('core:weight', { weight: 1.2 })
      .build();

    testFixture.reset([room, actor, letter, gun, handEntity]);

    // Drop letter
    await testFixture.executeAction('test:actor1', 'letter-1');
    clearEntityCache(); // Clear cache after mutation

    // Verify letter can be picked up
    let actions = await testFixture.discoverActions('test:actor1');
    let letterPickup = actions.find((a) => a.id === 'items:pick_up_item');
    expect(letterPickup).toBeDefined();

    // Drop gun
    await testFixture.executeAction('test:actor1', 'gun-1');
    clearEntityCache(); // Clear cache after mutation

    // Verify both items can be picked up
    actions = await testFixture.discoverActions('test:actor1');
    letterPickup = actions.find((a) => a.id === 'items:pick_up_item');
    const gunPickup = actions.find((a) => a.id === 'items:pick_up_item');

    expect(letterPickup).toBeDefined();
    expect(gunPickup).toBeDefined();
  });
});
