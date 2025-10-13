/**
 * @file Integration tests for items:put_in_container action discovery.
 * @description Tests that the put_in_container action is discovered correctly
 * based on game state (actor has items, open container available, etc.).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import putInContainerRule from '../../../../data/mods/items/rules/handle_put_in_container.rule.json' assert { type: 'json' };
import eventIsActionPutInContainer from '../../../../data/mods/items/conditions/event-is-action-put-in-container.condition.json' assert { type: 'json' };

describe('Put In Container Action Discovery Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:put_in_container',
      putInContainerRule,
      eventIsActionPutInContainer
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover put_in_container action when actor has items and open container is available', async () => {
    // Arrange: Create location
    const location = new ModEntityBuilder('location1')
      .asRoom('Test Location')
      .build();

    // Create actor with inventory
    const actor = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('items:inventory', { items: ['item1'] })
      .build();

    // Create item
    const item = new ModEntityBuilder('item1')
      .withName('Test Item')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .build();

    // Create open container at location
    const chest = new ModEntityBuilder('chest1')
      .withName('Chest')
      .atLocation('location1')
      .withComponent('items:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items:openable', {})
      .build();

    testFixture.reset([location, actor, item, chest]);

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Find put_in_container action
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
    );

    expect(putInContainerActions.length).toBeGreaterThan(0);

    // Verify action has correct targets
    const action = putInContainerActions[0];
    expect(action.primaryId).toBe('chest1');
    expect(action.secondaryId).toBe('item1');
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
      .withComponent('items:inventory', { items: [] })
      .build();

    // Create open container at location
    const chest = new ModEntityBuilder('chest1')
      .withName('Chest')
      .atLocation('location1')
      .withComponent('items:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items:openable', {})
      .build();

    testFixture.reset([location, actor, chest]);

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Verify no put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
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
      .withComponent('items:inventory', { items: ['item1'] })
      .build();

    // Create item
    const item = new ModEntityBuilder('item1')
      .withName('Test Item')
      .withComponent('items:item', {})
      .build();

    // Create closed container at location
    const chest = new ModEntityBuilder('chest1')
      .withName('Chest')
      .atLocation('location1')
      .withComponent('items:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: false,
      })
      .withComponent('items:openable', {})
      .build();

    testFixture.reset([location, actor, item, chest]);

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Verify no put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
    );

    expect(putInContainerActions.length).toBe(0);
  });

  it('should discover multiple put_in_container actions with multiple items and containers', async () => {
    // Arrange: Create location
    const location = new ModEntityBuilder('location1')
      .asRoom('Test Location')
      .build();

    // Create actor with multiple items
    const actor = new ModEntityBuilder('actor1')
      .withName('Test Actor')
      .atLocation('location1')
      .asActor()
      .withComponent('items:inventory', {
        items: ['item1', 'item2'],
      })
      .build();

    // Create items
    const item1 = new ModEntityBuilder('item1')
      .withName('Item One')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .build();

    const item2 = new ModEntityBuilder('item2')
      .withName('Item Two')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .build();

    // Create multiple open containers
    const chest1 = new ModEntityBuilder('chest1')
      .withName('Chest 1')
      .atLocation('location1')
      .withComponent('items:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items:openable', {})
      .build();

    const chest2 = new ModEntityBuilder('chest2')
      .withName('Chest 2')
      .atLocation('location1')
      .withComponent('items:container', {
        contents: [],
        capacity: { maxItems: 5, maxWeight: 100 },
        isOpen: true,
      })
      .withComponent('items:openable', {})
      .build();

    testFixture.reset([location, actor, item1, item2, chest1, chest2]);

    // Act: Get available actions
    const actions = testFixture.discoverActions('actor1');

    // Assert: Find put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
    );

    // Should have 4 combinations: 2 items × 2 containers
    expect(putInContainerActions.length).toBe(4);
  });
});
