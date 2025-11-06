/**
 * @file Integration tests for drinkable items action discovery.
 * @description Tests that drink_from and drink_entirely actions are properly defined and discovered in correct scenarios.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import drinkFromAction from '../../../../data/mods/items/actions/drink_from.action.json' assert { type: 'json' };
import drinkEntirelyAction from '../../../../data/mods/items/actions/drink_entirely.action.json' assert { type: 'json' };

describe('Drink From Action Discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('items', 'drink_from');

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([drinkFromAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action Structure', () => {
    it('should have correct action structure', () => {
      expect(drinkFromAction).toBeDefined();
      expect(drinkFromAction.id).toBe('items:drink_from');
      expect(drinkFromAction.name).toBe('Drink From');
      expect(drinkFromAction.description).toBe(
        'Take a single serving from a drinkable container, reducing its volume by the serving size.'
      );
      expect(drinkFromAction.template).toBe('drink from {primary}');
    });

    it('should use correct scope for primary targets (examinable items)', () => {
      expect(drinkFromAction.targets).toBeDefined();
      expect(drinkFromAction.targets.primary).toBeDefined();
      expect(drinkFromAction.targets.primary.scope).toBe(
        'items:examinable_items'
      );
      expect(drinkFromAction.targets.primary.placeholder).toBe('primary');
      expect(drinkFromAction.targets.primary.description).toBe(
        'Drinkable container to consume from'
      );
    });

    it('should require both drinkable and liquid_container components on primary target', () => {
      expect(drinkFromAction.required_components).toBeDefined();
      expect(drinkFromAction.required_components.primary).toBeDefined();
      expect(drinkFromAction.required_components.primary).toEqual([
        'items:drinkable',
        'items:liquid_container',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(drinkFromAction.prerequisites).toBeDefined();
      expect(Array.isArray(drinkFromAction.prerequisites)).toBe(true);
      expect(drinkFromAction.prerequisites).toEqual([]);
    });
  });

  describe('Availability Conditions', () => {
    it('should discover drink_from when drinkable container in inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['waterskin'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const waterskin = new ModEntityBuilder('waterskin')
        .withName('Leather Waterskin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 250,
          isRefillable: true,
          flavorText: 'Cool, refreshing water quenches your thirst.',
        })
        .build();

      testFixture.reset([room, actor, waterskin]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      expect(drinkActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:examinable_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['waterskin']);
    });

    it('should discover drink_from when drinkable container at location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      const fountain = new ModEntityBuilder('fountain')
        .withName('Stone Fountain')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 999999,
          maxCapacityMilliliters: 999999,
          servingSizeMilliliters: 250,
          isRefillable: true,
          flavorText: 'Fresh spring water from the fountain, cool and pure.',
        })
        .build();

      testFixture.reset([room, actor, fountain]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      expect(drinkActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:examinable_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).toEqual(['fountain']);
    });

    it('should NOT discover drink_from for non-portable drinkable at location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .build();

      const fixedFountain = new ModEntityBuilder('fixed_fountain')
        .withName('Marble Fountain')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 999999,
          maxCapacityMilliliters: 999999,
          servingSizeMilliliters: 250,
          isRefillable: true,
          flavorText: 'Crystal clear water flows endlessly.',
        })
        .build();

      testFixture.reset([room, actor, fixedFountain]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      // Non-portable items are filtered out by examinable_items scope
      expect(drinkActions.length).toBe(0);
    });

    it('should NOT discover when container lacks drinkable component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Diana')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['vase'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const vase = new ModEntityBuilder('vase')
        .withName('Decorative Vase')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 300,
          maxCapacityMilliliters: 500,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'The water tastes stale.',
        })
        .build();

      testFixture.reset([room, actor, vase]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      expect(drinkActions.length).toBe(0);
    });

    it('should NOT discover when container lacks liquid_container component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Eve')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['cup'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const cup = new ModEntityBuilder('cup')
        .withName('Empty Cup')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .build();

      testFixture.reset([room, actor, cup]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      expect(drinkActions.length).toBe(0);
    });

    it('should NOT discover when container in different location', () => {
      const roomA = ModEntityScenarios.createRoom('room_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room_b', 'Room B');

      const actor = new ModEntityBuilder('actor1')
        .withName('Frank')
        .atLocation('room_a')
        .asActor()
        .build();

      const distantWaterskin = new ModEntityBuilder('distant_waterskin')
        .withName('Distant Waterskin')
        .atLocation('room_b')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 250,
          isRefillable: true,
          flavorText: 'Cool water.',
        })
        .build();

      testFixture.reset([roomA, roomB, actor, distantWaterskin]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      expect(drinkActions.length).toBe(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:examinable_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(Array.from(scopeResult.value)).not.toContain('distant_waterskin');
    });
  });

  describe('Edge Cases', () => {
    it('should discover action even if container is empty (rule handles this)', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Grace')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['empty_bottle'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const emptyBottle = new ModEntityBuilder('empty_bottle')
        .withName('Empty Bottle')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 0,
          maxCapacityMilliliters: 500,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'Nothing to drink.',
        })
        .build();

      testFixture.reset([room, actor, emptyBottle]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      // Action should be discovered (the rule will handle the empty state)
      expect(drinkActions.length).toBeGreaterThan(0);
    });

    it('should discover for multiple drinkable containers simultaneously', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Henry')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['waterskin', 'potion'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const waterskin = new ModEntityBuilder('waterskin')
        .withName('Waterskin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 750,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 250,
          isRefillable: true,
          flavorText: 'Refreshing water.',
        })
        .build();

      const potion = new ModEntityBuilder('potion')
        .withName('Healing Potion')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 50,
          maxCapacityMilliliters: 50,
          servingSizeMilliliters: 50,
          isRefillable: false,
          flavorText: 'Magical elixir tingles as it flows down.',
        })
        .build();

      testFixture.reset([room, actor, waterskin, potion]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );

      expect(drinkActions.length).toBeGreaterThan(0);

      const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
      const scopeContext = {
        actor: {
          id: 'actor1',
          components: actorInstance.components,
        },
      };

      const scopeResult =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'items:examinable_items',
          scopeContext
        );

      expect(scopeResult.success).toBe(true);
      expect(new Set(scopeResult.value)).toEqual(
        new Set(['waterskin', 'potion'])
      );
    });
  });
});

describe('Drink Entirely Action Discovery', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'drink_entirely'
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([drinkEntirelyAction]);
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action Structure', () => {
    it('should have correct action structure', () => {
      expect(drinkEntirelyAction).toBeDefined();
      expect(drinkEntirelyAction.id).toBe('items:drink_entirely');
      expect(drinkEntirelyAction.name).toBe('Drink Entirely');
      expect(drinkEntirelyAction.description).toBe(
        'Consume all remaining liquid from a drinkable container, emptying it completely.'
      );
      expect(drinkEntirelyAction.template).toBe('drink entirety of {primary}');
    });

    it('should use correct scope for primary targets (examinable items)', () => {
      expect(drinkEntirelyAction.targets).toBeDefined();
      expect(drinkEntirelyAction.targets.primary).toBeDefined();
      expect(drinkEntirelyAction.targets.primary.scope).toBe(
        'items:examinable_items'
      );
      expect(drinkEntirelyAction.targets.primary.placeholder).toBe('primary');
      expect(drinkEntirelyAction.targets.primary.description).toBe(
        'Drinkable container to empty completely'
      );
    });

    it('should require both drinkable and liquid_container components on primary target', () => {
      expect(drinkEntirelyAction.required_components).toBeDefined();
      expect(drinkEntirelyAction.required_components.primary).toBeDefined();
      expect(drinkEntirelyAction.required_components.primary).toEqual([
        'items:drinkable',
        'items:liquid_container',
      ]);
    });

    it('should have empty prerequisites array', () => {
      expect(drinkEntirelyAction.prerequisites).toBeDefined();
      expect(Array.isArray(drinkEntirelyAction.prerequisites)).toBe(true);
      expect(drinkEntirelyAction.prerequisites).toEqual([]);
    });
  });

  describe('Availability Conditions', () => {
    it('should discover drink_entirely when drinkable container in inventory', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['waterskin'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const waterskin = new ModEntityBuilder('waterskin')
        .withName('Leather Waterskin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 250,
          isRefillable: true,
          flavorText: 'Cool, refreshing water quenches your thirst.',
        })
        .build();

      testFixture.reset([room, actor, waterskin]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_entirely'
      );

      expect(drinkActions.length).toBeGreaterThan(0);
    });

    it('should discover drink_entirely when drinkable container at location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      const goblet = new ModEntityBuilder('goblet')
        .withName('Wine Goblet')
        .atLocation('room1')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 200,
          maxCapacityMilliliters: 300,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'Rich, full-bodied wine with hints of oak.',
        })
        .build();

      testFixture.reset([room, actor, goblet]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_entirely'
      );

      expect(drinkActions.length).toBeGreaterThan(0);
    });

    it('should NOT discover when container lacks drinkable component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['vase'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const vase = new ModEntityBuilder('vase')
        .withName('Decorative Vase')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 300,
          maxCapacityMilliliters: 500,
          servingSizeMilliliters: 100,
          isRefillable: true,
          flavorText: 'The water tastes stale.',
        })
        .build();

      testFixture.reset([room, actor, vase]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_entirely'
      );

      expect(drinkActions.length).toBe(0);
    });

    it('should NOT discover when container lacks liquid_container component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Diana')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['cup'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const cup = new ModEntityBuilder('cup')
        .withName('Empty Cup')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .build();

      testFixture.reset([room, actor, cup]);
      configureActionDiscovery();

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_entirely'
      );

      expect(drinkActions.length).toBe(0);
    });
  });

  describe('Coexistence with Drink From', () => {
    it('should discover BOTH actions for same drinkable container', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Eve')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['waterskin'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const waterskin = new ModEntityBuilder('waterskin')
        .withName('Leather Waterskin')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 250,
          isRefillable: true,
          flavorText: 'Cool, refreshing water quenches your thirst.',
        })
        .build();

      testFixture.reset([room, actor, waterskin]);

      // Configure both actions for discovery
      const { testEnv } = testFixture;
      if (testEnv) {
        testEnv.actionIndex.buildIndex([drinkFromAction, drinkEntirelyAction]);
      }

      const discoveredActions = testFixture.discoverActions('actor1');
      const drinkFromActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_from'
      );
      const drinkEntirelyActions = discoveredActions.filter(
        (action) => action.id === 'items:drink_entirely'
      );

      // Both actions should be discovered for the same container
      expect(drinkFromActions.length).toBeGreaterThan(0);
      expect(drinkEntirelyActions.length).toBeGreaterThan(0);
    });

    it('should allow player to choose consumption style', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Frank')
        .atLocation('room1')
        .asActor()
        .withComponent('items:inventory', {
          items: ['potion'],
          capacity: { maxWeight: 50, maxItems: 10 },
        })
        .build();

      const potion = new ModEntityBuilder('potion')
        .withName('Healing Potion')
        .withComponent('items:item', {})
        .withComponent('items:portable', {})
        .withComponent('items:drinkable', {})
        .withComponent('items:liquid_container', {
          currentVolumeMilliliters: 50,
          maxCapacityMilliliters: 50,
          servingSizeMilliliters: 50,
          isRefillable: false,
          flavorText: 'Magical elixir tingles.',
        })
        .build();

      testFixture.reset([room, actor, potion]);

      // Configure both actions for discovery
      const { testEnv } = testFixture;
      if (testEnv) {
        testEnv.actionIndex.buildIndex([drinkFromAction, drinkEntirelyAction]);
      }

      const discoveredActions = testFixture.discoverActions('actor1');
      const actionIds = discoveredActions.map((action) => action.id);

      // Both consumption styles should be available
      expect(actionIds).toContain('items:drink_from');
      expect(actionIds).toContain('items:drink_entirely');
    });
  });
});
