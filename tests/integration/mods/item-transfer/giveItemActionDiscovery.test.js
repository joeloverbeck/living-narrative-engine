/**
 * @file Integration tests for the item-transfer:give_item action definition.
 * @description Tests that the give_item action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import giveItemAction from '../../../../data/mods/item-transfer/actions/give_item.action.json' assert { type: 'json' };

describe('item-transfer:give_item action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('item-transfer', 'item-transfer:give_item');

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
    expect(giveItemAction.id).toBe('item-transfer:give_item');
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
      'core:actors_in_location'
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

  it('should have prerequisites for free grabbing appendage', () => {
    // GRAPREEXP-005: give_item now requires a free grabbing appendage
    expect(giveItemAction.prerequisites).toBeDefined();
    expect(Array.isArray(giveItemAction.prerequisites)).toBe(true);
    expect(giveItemAction.prerequisites.length).toBeGreaterThan(0);
    expect(giveItemAction.prerequisites[0].logic.condition_ref).toBe(
      'anatomy:actor-has-free-grabbing-appendage'
    );
  });

  it('should generate combinations for multiple targets', () => {
    expect(giveItemAction.generateCombinations).toBe(true);
  });

  it('should have Trade Amber visual colors', () => {
    expect(giveItemAction.visual).toBeDefined();
    expect(giveItemAction.visual.backgroundColor).toBe('#7d5a00');
    expect(giveItemAction.visual.textColor).toBe('#fff8e1');
    expect(giveItemAction.visual.hoverBackgroundColor).toBe('#9a7000');
    expect(giveItemAction.visual.hoverTextColor).toBe('#ffffff');
  });

  describe('Action discovery integration tests', () => {
    it('should NOT appear when actor has inventory component but no portable items', () => {
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

      // Assert: give_item action should NOT appear because there are no items to give
      // Actions only appear when they have valid targets
      // The scope (items:actor_inventory_items) returns empty because inventory is empty
      const giveItemActions = availableActions.filter(
        (action) => action.id === 'item-transfer:give_item'
      );
      expect(giveItemActions.length).toBe(0);
    });
  });

  describe('Target inventory requirement tests', () => {
    it('should require items:inventory component on primary target', () => {
      // Verify the action schema has required_components.primary with items:inventory
      expect(giveItemAction.required_components).toBeDefined();
      expect(giveItemAction.required_components.primary).toBeDefined();
      expect(giveItemAction.required_components.primary).toContain(
        'items:inventory'
      );
    });

    it('should NOT appear when recipient (primary target) lacks inventory component', () => {
      // Setup: Room with two actors
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Create a hand entity for the anatomy system
      const handEntity = new ModEntityBuilder('alice-hand-1')
        .withComponent('anatomy:can_grab', {
          gripStrength: 1.0,
          locked: false,
          heldItemId: null,
        })
        .build();

      // Actor WITH inventory and items to give
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['test-item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('anatomy:body', {
          body: { parts: { rightHand: 'alice-hand-1' } },
        })
        .build();

      // Recipient WITHOUT inventory component - this is the bug scenario
      const recipient = new ModEntityBuilder('test:actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        // NO items:inventory component - recipient cannot receive items
        .build();

      // Create an item in the actor's inventory
      const item = new ModEntityBuilder('test-item')
        .withName('test item')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.1 })
        .build();

      testFixture.reset([room, actor, recipient, item, handEntity]);
      configureActionDiscovery();

      // Discover actions for actor
      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor1');

      // Assert: give_item action should NOT appear because recipient lacks inventory
      const giveItemActions = availableActions.filter(
        (action) => action.id === 'item-transfer:give_item'
      );
      expect(giveItemActions.length).toBe(0);
    });

    it('should appear when both actor and recipient have inventory components', () => {
      // Setup: Room with two actors, both having inventory
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Create a hand entity for the anatomy system
      const handEntity = new ModEntityBuilder('alice-hand-1')
        .withComponent('anatomy:can_grab', {
          gripStrength: 1.0,
          locked: false,
          heldItemId: null,
        })
        .build();

      // Actor WITH inventory and items to give
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['test-item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .withComponent('anatomy:body', {
          body: { parts: { rightHand: 'alice-hand-1' } },
        })
        .build();

      // Recipient WITH inventory component - can receive items
      const recipient = new ModEntityBuilder('test:actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      // Create an item in the actor's inventory
      const item = new ModEntityBuilder('test-item')
        .withName('test item')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('core:weight', { weight: 0.1 })
        .build();

      testFixture.reset([room, actor, recipient, item, handEntity]);
      configureActionDiscovery();

      // Discover actions for actor
      const availableActions =
        testFixture.testEnv.getAvailableActions('test:actor1');

      // Assert: give_item action SHOULD appear because recipient has inventory
      const giveItemActions = availableActions.filter(
        (action) => action.id === 'item-transfer:give_item'
      );
      expect(giveItemActions.length).toBeGreaterThan(0);
    });
  });
});
