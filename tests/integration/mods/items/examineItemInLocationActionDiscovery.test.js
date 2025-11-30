import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import examineItemInLocationAction from '../../../../data/mods/items/actions/examine_item_in_location.action.json' assert { type: 'json' };

describe('items:examine_item_in_location action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:examine_item_in_location',
      null,
      null,
      { autoRegisterScopes: true, scopeCategories: ['items'] }
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([examineItemInLocationAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(examineItemInLocationAction).toBeDefined();
      expect(examineItemInLocationAction.id).toBe('items:examine_item_in_location');
      expect(examineItemInLocationAction.name).toBe('Examine Item in Location');
      expect(examineItemInLocationAction.description).toBe(
        'Inspect an item at your current location to learn its details'
      );
      expect(examineItemInLocationAction.template).toBe('examine {target} in location');
    });

    it('should use correct scope for primary targets (items at location)', () => {
      expect(examineItemInLocationAction.targets).toBeDefined();
      expect(examineItemInLocationAction.targets.primary).toBeDefined();
      expect(examineItemInLocationAction.targets.primary.scope).toBe(
        'items:items_at_actor_location'
      );
      expect(examineItemInLocationAction.targets.primary.placeholder).toBe('target');
      expect(examineItemInLocationAction.targets.primary.description).toBe(
        'Item at location to examine'
      );
    });

    it('should require item and description components on primary target', () => {
      expect(examineItemInLocationAction.required_components).toBeDefined();
      expect(examineItemInLocationAction.required_components.primary).toBeDefined();
      expect(examineItemInLocationAction.required_components.primary).toEqual([
        'items:item',
        'core:description',
      ]);
    });

    it('should forbid action during complex performance', () => {
      expect(examineItemInLocationAction.forbidden_components).toBeDefined();
      expect(examineItemInLocationAction.forbidden_components.actor).toEqual([
        'positioning:doing_complex_performance',
        'positioning:fallen',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(examineItemInLocationAction.prerequisites).toBeDefined();
      expect(Array.isArray(examineItemInLocationAction.prerequisites)).toBe(true);
      expect(examineItemInLocationAction.prerequisites).toEqual([]);
    });
  });

  describe('Action discovery behavior', () => {
    it('should appear when portable items with description exist at actor location', () => {
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

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:items_at_actor_location',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['test_item_2']);
    });

    it('should appear when non-portable items with description exist at actor location', () => {
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
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:items_at_actor_location',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['heavy_furniture']);
    });

    it('should NOT appear when items are in inventory but not at location', () => {
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

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear when no items present at location', () => {
      const room = ModEntityScenarios.createRoom('empty_location', 'Empty Room');

      const actor = new ModEntityBuilder('lonely_actor')
        .withName('Lonely')
        .atLocation('empty_location')
        .asActor()
        .build();

      testFixture.reset([room, actor]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('lonely_actor');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear for items lacking core:description component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .build();

      const item = new ModEntityBuilder('incomplete_item')
        .withName('nameless object')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
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

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should appear for both portable and non-portable items at location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Eve')
        .atLocation('room1')
        .asActor()
        .build();

      const portableItem = new ModEntityBuilder('portable_item')
        .withName('floor lamp')
        .withDescription('A tall standing lamp')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const nonPortableItem = new ModEntityBuilder('non_portable_item')
        .withName('stone statue')
        .withDescription('An ancient carved statue')
        .atLocation('room1')
        .withComponent('items:item', {})
        .build();

      testFixture.reset([room, actor, portableItem, nonPortableItem]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'items:examine_item_in_location'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:items_at_actor_location',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(new Set(scopeResult.value)).toEqual(
        new Set(['portable_item', 'non_portable_item'])
      );
    });
  });
});
