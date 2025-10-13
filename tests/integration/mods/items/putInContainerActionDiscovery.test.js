import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createFullTestEnvironment } from '../../../common/fullTestEnvironment.js';

describe('Put In Container Action Discovery Integration Tests', () => {
  let env;

  beforeEach(async () => {
    env = await createFullTestEnvironment({
      mods: ['core', 'positioning', 'items'],
    });
  });

  afterEach(() => {
    env?.cleanup();
  });

  it('should discover put_in_container action when actor has items and open container is available', async () => {
    const { entityManager, container } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor with inventory
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', { items: ['item1'] });

    // Create item
    const item = entityManager.createEntity('item1');
    entityManager.addComponent(item, 'items:item', { name: 'Test Item' });
    entityManager.addComponent(item, 'items:portable', {});

    // Create open container at location
    const chest = entityManager.createEntity('chest1');
    entityManager.addComponent(chest, 'core:position', { locationId: location });
    entityManager.addComponent(chest, 'items:container', {
      contents: [],
      capacity: { maxItems: 5, maxWeight: 100 },
    });
    entityManager.addComponent(chest, 'items:openable', { isOpen: true });

    // Get action discovery service
    const actionDiscoveryService = container.resolve('IActionDiscoveryService');
    const actions = await actionDiscoveryService.discoverActions(actor);

    // Find put_in_container action
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
    );

    expect(putInContainerActions.length).toBeGreaterThan(0);

    // Verify action has correct targets
    const action = putInContainerActions[0];
    expect(action.primaryId).toBe(chest);
    expect(action.secondaryId).toBe('item1');
  });

  it('should NOT discover put_in_container when actor has no items', async () => {
    const { entityManager, container } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor with empty inventory
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', { items: [] });

    // Create open container at location
    const chest = entityManager.createEntity('chest1');
    entityManager.addComponent(chest, 'core:position', { locationId: location });
    entityManager.addComponent(chest, 'items:container', {
      contents: [],
      capacity: { maxItems: 5, maxWeight: 100 },
    });
    entityManager.addComponent(chest, 'items:openable', { isOpen: true });

    // Get action discovery service
    const actionDiscoveryService = container.resolve('IActionDiscoveryService');
    const actions = await actionDiscoveryService.discoverActions(actor);

    // Verify no put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
    );

    expect(putInContainerActions.length).toBe(0);
  });

  it('should NOT discover put_in_container when no open containers available', async () => {
    const { entityManager, container } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor with inventory
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', { items: ['item1'] });

    // Create item
    const item = entityManager.createEntity('item1');
    entityManager.addComponent(item, 'items:item', { name: 'Test Item' });

    // Create closed container at location
    const chest = entityManager.createEntity('chest1');
    entityManager.addComponent(chest, 'core:position', { locationId: location });
    entityManager.addComponent(chest, 'items:container', {
      contents: [],
      capacity: { maxItems: 5, maxWeight: 100 },
    });
    entityManager.addComponent(chest, 'items:openable', { isOpen: false });

    // Get action discovery service
    const actionDiscoveryService = container.resolve('IActionDiscoveryService');
    const actions = await actionDiscoveryService.discoverActions(actor);

    // Verify no put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
    );

    expect(putInContainerActions.length).toBe(0);
  });

  it('should discover multiple put_in_container actions with multiple items and containers', async () => {
    const { entityManager, container } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor with multiple items
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', {
      items: ['item1', 'item2'],
    });

    // Create items
    const item1 = entityManager.createEntity('item1');
    entityManager.addComponent(item1, 'items:item', { name: 'Item One' });
    entityManager.addComponent(item1, 'items:portable', {});

    const item2 = entityManager.createEntity('item2');
    entityManager.addComponent(item2, 'items:item', { name: 'Item Two' });
    entityManager.addComponent(item2, 'items:portable', {});

    // Create multiple open containers
    const chest1 = entityManager.createEntity('chest1');
    entityManager.addComponent(chest1, 'core:position', { locationId: location });
    entityManager.addComponent(chest1, 'items:container', {
      contents: [],
      capacity: { maxItems: 5, maxWeight: 100 },
    });
    entityManager.addComponent(chest1, 'items:openable', { isOpen: true });

    const chest2 = entityManager.createEntity('chest2');
    entityManager.addComponent(chest2, 'core:position', { locationId: location });
    entityManager.addComponent(chest2, 'items:container', {
      contents: [],
      capacity: { maxItems: 5, maxWeight: 100 },
    });
    entityManager.addComponent(chest2, 'items:openable', { isOpen: true });

    // Get action discovery service
    const actionDiscoveryService = container.resolve('IActionDiscoveryService');
    const actions = await actionDiscoveryService.discoverActions(actor);

    // Find put_in_container actions
    const putInContainerActions = actions.filter(
      (a) => a.actionId === 'items:put_in_container'
    );

    // Should have 4 combinations: 2 items × 2 containers
    expect(putInContainerActions.length).toBe(4);
  });
});
