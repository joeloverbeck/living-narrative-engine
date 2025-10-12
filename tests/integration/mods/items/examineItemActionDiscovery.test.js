/**
 * @file Integration tests for the items:examine_item action definition.
 * @description Tests that the examine_item action is properly defined and structured.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import examineItemAction from '../../../../data/mods/items/actions/examine_item.action.json' assert { type: 'json' };

describe('items:examine_item action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'items:examine_item');

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([examineItemAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(examineItemAction).toBeDefined();
    expect(examineItemAction.id).toBe('items:examine_item');
    expect(examineItemAction.name).toBe('Examine Item');
    expect(examineItemAction.description).toBe(
      'Inspect an item to learn its details'
    );
    expect(examineItemAction.template).toBe('examine {item}');
  });

  it('should use correct scope for primary targets (examinable items)', () => {
    expect(examineItemAction.targets).toBeDefined();
    expect(examineItemAction.targets.primary).toBeDefined();
    expect(examineItemAction.targets.primary.scope).toBe(
      'items:examinable_items'
    );
    expect(examineItemAction.targets.primary.placeholder).toBe('item');
    expect(examineItemAction.targets.primary.description).toBe(
      'Item to examine'
    );
  });

  it('should require item and description components on primary target', () => {
    expect(examineItemAction.required_components).toBeDefined();
    expect(examineItemAction.required_components.primary).toBeDefined();
    expect(examineItemAction.required_components.primary).toEqual([
      'items:item',
      'core:description',
    ]);
  });

  it('should have empty prerequisites array', () => {
    expect(examineItemAction.prerequisites).toBeDefined();
    expect(Array.isArray(examineItemAction.prerequisites)).toBe(true);
    expect(examineItemAction.prerequisites).toEqual([]);
  });

  describe('Action discovery behavior', () => {
    it('should appear when items with description exist in actor inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['test_item_1'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('test_item_1')
        .withName('ancient scroll')
        .withDescription('A yellowed parchment with faded text')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'actor1'
      );

      const examineActions = availableActions.filter(
        (a) => a.id === 'items:examine_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);
      // Note: getAvailableActions returns raw action definitions with validation,
      // not fully resolved actions with target IDs. We can only verify that
      // the action was discovered for this actor.
    });

    it('should appear when items with description exist at actor location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      const item = new ModEntityBuilder('test_item_2')
        .withName('rusty key')
        .withDescription('An old key covered in rust')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'actor1'
      );
      const examineActions = availableActions.filter(
        (a) => a.id === 'items:examine_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);
      // Note: Raw action definitions don't contain resolved target IDs
    });

    it('should NOT appear when no items present', () => {
      const room = ModEntityScenarios.createRoom('empty_location', 'Empty Room');

      const actor = new ModEntityBuilder('lonely_actor')
        .withName('Lonely')
        .atLocation('empty_location')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'lonely_actor'
      );
      const examineActions = availableActions.filter(
        (a) => a.id === 'items:examine_item'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear for items lacking core:description component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['incomplete_item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item = new ModEntityBuilder('incomplete_item')
        .withName('nameless object')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        // Missing core:description
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'actor1'
      );
      const examineActions = availableActions.filter(
        (a) => a.id === 'items:examine_item'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear for items at different locations', () => {
      const roomA = ModEntityScenarios.createRoom('location_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('location_b', 'Room B');

      const actor = new ModEntityBuilder('actor1')
        .withName('Diana')
        .atLocation('location_a')
        .asActor()
        .build();

      const item = new ModEntityBuilder('distant_item')
        .withName('far away object')
        .withDescription('Too far to examine')
        .atLocation('location_b')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([roomA, roomB, actor, item]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'actor1'
      );
      const examineActions = availableActions.filter(
        (a) => a.id === 'items:examine_item'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should appear for both inventory and location items with description', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Eve')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['inventory_item'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const inventoryItem = new ModEntityBuilder('inventory_item')
        .withName('pocket watch')
        .withDescription('A golden pocket watch')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const locationItem = new ModEntityBuilder('location_item')
        .withName('floor lamp')
        .withDescription('A tall standing lamp')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, inventoryItem, locationItem]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'actor1'
      );
      const examineActions = availableActions.filter(
        (a) => a.id === 'items:examine_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);
      // Note: The action index validates that targets exist, but doesn't
      // attach target IDs to action definitions. We can only verify discovery.
    });

    it('should NOT appear for non-portable items even with description', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Frank')
        .atLocation('room1')
        .asActor()
        .build();

      const item = new ModEntityBuilder('heavy_furniture')
        .withName('oak wardrobe')
        .withDescription('A massive oak wardrobe')
        .atLocation('room1')
        .withComponent('items:item', {})
        // Missing items:portable
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        'actor1'
      );
      const examineActions = availableActions.filter(
        (a) => a.id === 'items:examine_item'
      );

      expect(examineActions.length).toBe(0);
    });
  });
});
