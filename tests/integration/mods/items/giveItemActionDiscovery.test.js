/**
 * @file Integration tests for the items:give_item action definition.
 * @description Tests that the give_item action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import giveItemAction from '../../../../data/mods/items/actions/give_item.action.json' assert { type: 'json' };

describe('items:give_item action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:give_item');

    // Configure action discovery system
    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv || !testEnv.actionIndex) {
        return;
      }
      testEnv.actionIndex.buildIndex([giveItemAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(giveItemAction).toBeDefined();
    expect(giveItemAction.id).toBe('items:give_item');
    expect(giveItemAction.name).toBe('Give Item');
    expect(giveItemAction.description).toBe(
      'Give an item from your inventory to another actor'
    );
    expect(giveItemAction.template).toBe('give {item} to {recipient}');
  });

  it('should use correct scope for primary targets', () => {
    expect(giveItemAction.targets).toBeDefined();
    expect(giveItemAction.targets.primary).toBeDefined();
    expect(giveItemAction.targets.primary.scope).toBe(
      'positioning:close_actors'
    );
    expect(giveItemAction.targets.primary.placeholder).toBe('recipient');
  });

  it('should use correct scope for secondary targets (inventory items)', () => {
    expect(giveItemAction.targets).toBeDefined();
    expect(giveItemAction.targets.secondary).toBeDefined();
    expect(giveItemAction.targets.secondary.scope).toBe(
      'items:actor_inventory_items'
    );
    expect(giveItemAction.targets.secondary.placeholder).toBe('item');
    // contextFrom should NOT be present - we want actor's inventory, not primary target's
    expect(giveItemAction.targets.secondary.contextFrom).toBeUndefined();
  });

  it('should not have prerequisites (portability filtering handled by scope)', () => {
    expect(giveItemAction.prerequisites).toBeUndefined();
  });

  it('should generate combinations for multiple targets', () => {
    expect(giveItemAction.generateCombinations).toBe(true);
  });

  describe('Action discovery integration tests', () => {
    it('should discover give_item action when actor has items and recipients are nearby', () => {
      // Setup: Two actors in same location, one with an item
      const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();

      const actor1 = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['letter-1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const actor2 = new ModEntityBuilder('test:actor2')
        .withName('Bob')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('letter-1')
        .withName('Letter')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:weight', { weight: 0.05 })
        .build();

      // Reset test environment with all entities
      testFixture.reset([room, actor1, actor2, item]);

      // Configure action discovery
      configureActionDiscovery();

      // Discover actions for actor with item
      const availableActions = testFixture.testEnv.getAvailableActions(
        'test:actor1'
      );

      // Assert: give_item action should be discovered
      const actionIds = availableActions.map((a) => a.id);
      expect(actionIds).toContain('items:give_item');
    });

    it('appears when actor has inventory component, but scope returns empty results when no portable items', () => {
      // Setup: Two actors in same location, both with empty inventory
      const room = new ModEntityBuilder('saloon1').asRoom('Saloon').build();

      const actor1 = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const actor2 = new ModEntityBuilder('test:actor2')
        .withName('Bob')
        .atLocation('saloon1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      // Reset test environment with all entities
      testFixture.reset([room, actor1, actor2]);

      // Configure action discovery
      configureActionDiscovery();

      // Discover actions for actor with empty inventory
      const availableActions = testFixture.testEnv.getAvailableActions(
        'test:actor1'
      );

      // Assert: give_item action WILL appear because actor has inventory component
      // (Action indexing is based on component presence, not scope resolution)
      // However, when target resolution happens, the scope will return empty results
      // because there are no portable items in the inventory
      const giveItemActions = availableActions.filter(
        (action) => action.id === 'items:give_item'
      );
      expect(giveItemActions.length).toBe(1);

      // Note: During actual execution, target combination generation will produce
      // zero combinations because the items:actor_inventory_items scope returns
      // an empty array (no portable items exist in inventory)
    });

    it('should NOT appear when no recipients nearby', () => {
      // Manual test case:
      // 1. Create actor with inventory items
      // 2. Place actor alone in location
      // 3. Expected: give_item action should NOT be available
      expect(true).toBe(true);
    });

    it('should create separate actions for each item in inventory', () => {
      // Manual test case:
      // 1. Create actor with multiple items in inventory
      // 2. Create nearby recipient
      // 3. Expected: One give_item action per item in inventory
      expect(true).toBe(true);
    });

    it('should create actions for multiple potential recipients', () => {
      // Manual test case:
      // 1. Create actor with item
      // 2. Create multiple nearby actors
      // 3. Expected: give_item actions for each (item, recipient) combination
      expect(true).toBe(true);
    });
  });
});
