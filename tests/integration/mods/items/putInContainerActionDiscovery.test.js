/**
 * @file Integration tests for containers:put_in_container action discovery.
 * @description Tests that the put_in_container action is discovered correctly
 * based on game state (actor has items, open container available, etc.).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import putInContainerRule from '../../../../data/mods/containers/rules/handle_put_in_container.rule.json' assert { type: 'json' };
import eventIsActionPutInContainer from '../../../../data/mods/containers/conditions/event-is-action-put-in-container.condition.json' assert { type: 'json' };
import putInContainerAction from '../../../../data/mods/containers/actions/put_in_container.action.json' assert { type: 'json' };

describe('Put In Container Action Discovery Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'containers',
      'containers:put_in_container',
      putInContainerRule,
      eventIsActionPutInContainer
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build the action index with the put_in_container action
      testEnv.actionIndex.buildIndex([putInContainerAction]);
    };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover put_in_container action when actor has items and open container is available', async () => {
    // Arrange: Create location
    const location = new ModEntityBuilder('location1')
      .asRoom('Test Location')
      .build();

    // Create actor with inventory and free grabbing appendages (for prerequisite)
    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('inventory:inventory', { items: ['item1'] })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    // Create item
    const item = new ModEntityBuilder('item1')
      .withName('Test Item')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .build();

    // Create open container at location
    const chest = new ModEntityBuilder('chest1')
      .withName('Chest')
      .atLocation('location1')
      .withComponent('containers-core:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items-core:openable', {})
      .build();

    testFixture.reset([location, actor, ...handEntities, item, chest]);
    configureActionDiscovery();

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Find put_in_container action
    const putInContainerActions = actions.filter(
      (a) => a.id === 'containers:put_in_container'
    );

    expect(putInContainerActions).toHaveLength(1);

    const action = putInContainerActions[0];
    expect(action.generateCombinations).toBe(true);
    expect(action.template).toBe('put {secondary.name} in {primary.name}');

    const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
    const scopeContext = {
      actor: {
        id: 'actor1',
        components: actorInstance.components,
      },
    };

    const containerResult =
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'containers-core:open_containers_at_location',
        scopeContext
      );
    expect(containerResult.success).toBe(true);
    expect([...containerResult.value]).toEqual(['chest1']);

    const inventoryResult =
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:actor_inventory_items',
        scopeContext
      );
    expect(inventoryResult.success).toBe(true);
    expect([...inventoryResult.value]).toEqual(['item1']);
  });

  it('should NOT discover put_in_container when actor has no items', async () => {
    // Arrange: Create location
    const location = new ModEntityBuilder('location1')
      .asRoom('Test Location')
      .build();

    // Create actor with empty inventory
    const actor = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('inventory:inventory', { items: [] })
      .build();

    // Create open container at location
    const chest = new ModEntityBuilder('chest1')
      .withName('Chest')
      .atLocation('location1')
      .withComponent('containers-core:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items-core:openable', {})
      .build();

    testFixture.reset([location, actor, chest]);
    configureActionDiscovery();

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Verify no put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.id === 'containers:put_in_container'
    );

    expect(putInContainerActions.length).toBe(0);
  });

  it('should NOT discover put_in_container when no open containers available', async () => {
    // Arrange: Create location
    const location = new ModEntityBuilder('location1')
      .asRoom('Test Location')
      .build();

    // Create actor with inventory
    const actor = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('inventory:inventory', { items: ['item1'] })
      .build();

    // Create item
    const item = new ModEntityBuilder('item1')
      .withName('Test Item')
      .withComponent('items-core:item', {})
      .build();

    // Create closed container at location
    const chest = new ModEntityBuilder('chest1')
      .withName('Chest')
      .atLocation('location1')
      .withComponent('containers-core:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: false,
      })
      .withComponent('items-core:openable', {})
      .build();

    testFixture.reset([location, actor, item, chest]);
    configureActionDiscovery();

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Verify no put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.id === 'containers:put_in_container'
    );

    expect(putInContainerActions.length).toBe(0);
  });

  it('should discover multiple put_in_container actions with multiple items and containers', async () => {
    // Arrange: Create location
    const location = new ModEntityBuilder('location1')
      .asRoom('Test Location')
      .build();

    // Create actor with multiple items and free grabbing appendages (for prerequisite)
    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('inventory:inventory', {
        items: ['item1', 'item2'],
      })
      .withGrabbingHands(2);
    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    // Create items
    const item1 = new ModEntityBuilder('item1')
      .withName('Item One')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .build();

    const item2 = new ModEntityBuilder('item2')
      .withName('Item Two')
      .withComponent('items-core:item', {})
      .withComponent('items-core:portable', {})
      .build();

    // Create multiple open containers
    const chest1 = new ModEntityBuilder('chest1')
      .withName('Chest 1')
      .atLocation('location1')
      .withComponent('containers-core:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items-core:openable', {})
      .build();

    const chest2 = new ModEntityBuilder('chest2')
      .withName('Chest 2')
      .atLocation('location1')
      .withComponent('containers-core:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items-core:openable', {})
      .build();

    testFixture.reset([
      location,
      actor,
      ...handEntities,
      item1,
      item2,
      chest1,
      chest2,
    ]);
    configureActionDiscovery();

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Find put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.id === 'containers:put_in_container'
    );

    expect(putInContainerActions).toHaveLength(1);

    const actorInstance = testFixture.entityManager.getEntityInstance('actor1');
    const scopeContext = {
      actor: {
        id: 'actor1',
        components: actorInstance.components,
      },
    };

    const containerResult =
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'containers-core:open_containers_at_location',
        scopeContext
      );
    expect(containerResult.success).toBe(true);
    expect(new Set(containerResult.value)).toEqual(
      new Set(['chest1', 'chest2'])
    );

    const inventoryResult =
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'items:actor_inventory_items',
        scopeContext
      );
    expect(inventoryResult.success).toBe(true);
    expect(new Set(inventoryResult.value)).toEqual(new Set(['item1', 'item2']));

    const combos = [];
    for (const containerId of containerResult.value) {
      for (const itemId of inventoryResult.value) {
        combos.push({ containerId, itemId });
      }
    }

    expect(combos).toEqual(
      expect.arrayContaining([
        { containerId: 'chest1', itemId: 'item1' },
        { containerId: 'chest1', itemId: 'item2' },
        { containerId: 'chest2', itemId: 'item1' },
        { containerId: 'chest2', itemId: 'item2' },
      ])
    );
    expect(combos).toHaveLength(4);
  });
});
