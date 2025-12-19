import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import examineOwnedItemAction from '../../../../data/mods/observation/actions/examine_owned_item.action.json' assert { type: 'json' };

describe('observation:examine_owned_item action definition', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'observation',
      'observation:examine_owned_item'
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([examineOwnedItemAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('should have correct action structure', () => {
      expect(examineOwnedItemAction).toBeDefined();
      expect(examineOwnedItemAction.id).toBe('observation:examine_owned_item');
      expect(examineOwnedItemAction.name).toBe('Examine Owned Item');
      expect(examineOwnedItemAction.description).toBe(
        'Inspect an item in your inventory to learn its details'
      );
      expect(examineOwnedItemAction.template).toBe('examine my {target}');
    });

    it('should use correct scope for primary targets (actor inventory items)', () => {
      expect(examineOwnedItemAction.targets).toBeDefined();
      expect(examineOwnedItemAction.targets.primary).toBeDefined();
      expect(examineOwnedItemAction.targets.primary.scope).toBe(
        'items:actor_inventory_items'
      );
      expect(examineOwnedItemAction.targets.primary.placeholder).toBe('target');
      expect(examineOwnedItemAction.targets.primary.description).toBe(
        'Item in inventory to examine'
      );
    });

    it('should require item and description components on primary target', () => {
      expect(examineOwnedItemAction.required_components).toBeDefined();
      expect(examineOwnedItemAction.required_components.primary).toBeDefined();
      expect(examineOwnedItemAction.required_components.primary).toEqual([
        'items:item',
        'core:description',
      ]);
    });

    it('should forbid action during complex performance', () => {
      expect(examineOwnedItemAction.forbidden_components).toBeDefined();
      expect(examineOwnedItemAction.forbidden_components.actor).toEqual([
        'positioning:doing_complex_performance',
        'physical-control-states:restraining',
      ]);
    });

    it('should have lighting prerequisites', () => {
      expect(examineOwnedItemAction.prerequisites).toBeDefined();
      expect(Array.isArray(examineOwnedItemAction.prerequisites)).toBe(true);
      expect(examineOwnedItemAction.prerequisites).toHaveLength(1);
      expect(examineOwnedItemAction.prerequisites[0].logic).toEqual({
        isActorLocationLit: ['actor'],
      });
      expect(examineOwnedItemAction.prerequisites[0].failure_message).toBe(
        'It is too dark to examine anything.'
      );
    });
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

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'observation:examine_owned_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:actor_inventory_items',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['test_item_1']);
    });

    it('should NOT appear when items are at location but not in inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
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
        (action) => action.id === 'observation:examine_owned_item'
      );

      expect(examineActions.length).toBe(0);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:actor_inventory_items',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toHaveLength(0);
    });

    it('should NOT appear when inventory is empty', () => {
      const room = ModEntityScenarios.createRoom(
        'empty_location',
        'Empty Room'
      );

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

      const discoveredActions = testFixture.discoverActions('lonely_actor');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'observation:examine_owned_item'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should NOT appear for inventory items lacking core:description component', () => {
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
        .build();

      testFixture.reset([room, actor, item]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'observation:examine_owned_item'
      );

      expect(examineActions.length).toBe(0);
    });

    it('should appear for multiple inventory items with descriptions', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Diana')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['item1', 'item2'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const item1 = new ModEntityBuilder('item1')
        .withName('pocket watch')
        .withDescription('A golden pocket watch')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      const item2 = new ModEntityBuilder('item2')
        .withName('compass')
        .withDescription('A brass compass')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .build();

      testFixture.reset([room, actor, item1, item2]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const examineActions = discoveredActions.filter(
        (action) => action.id === 'observation:examine_owned_item'
      );

      expect(examineActions.length).toBeGreaterThan(0);

      const actorInstance =
        testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:actor_inventory_items',
        scopeContext
      );

      expect(scopeResult.success).toBe(true);
      expect(new Set(scopeResult.value)).toEqual(new Set(['item1', 'item2']));
    });
  });
});
