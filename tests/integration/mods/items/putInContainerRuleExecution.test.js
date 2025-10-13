import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createFullTestEnvironment } from '../../../common/fullTestEnvironment.js';

describe('Put In Container Rule Execution Integration Tests', () => {
  let env;

  beforeEach(async () => {
    env = await createFullTestEnvironment({
      mods: ['core', 'positioning', 'items'],
    });
  });

  afterEach(() => {
    env?.cleanup();
  });

  it('should successfully execute put_in_container action', async () => {
    const { entityManager, eventBus, container } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor with inventory
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:actor', {
      name: 'Test Actor',
      isPlayer: false,
    });
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', { items: ['item1'] });

    // Create item with weight
    const item = entityManager.createEntity('item1');
    entityManager.addComponent(item, 'items:item', { name: 'Gold Coin' });
    entityManager.addComponent(item, 'items:portable', {});
    entityManager.addComponent(item, 'items:weight', { weight: 1 });

    // Create open container with capacity
    const chest = entityManager.createEntity('chest1');
    entityManager.addComponent(chest, 'core:actor', { name: 'Treasure Chest' });
    entityManager.addComponent(chest, 'core:position', { locationId: location });
    entityManager.addComponent(chest, 'items:container', {
      contents: [],
      capacity: { maxItems: 5, maxWeight: 100 },
    });
    entityManager.addComponent(chest, 'items:openable', { isOpen: true });

    // Set up event listener for item_put_in_container
    let capturedEvent = null;
    eventBus.on('items:item_put_in_container', (event) => {
      capturedEvent = event;
    });

    // Dispatch attempt_action event
    await eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId: actor,
        actionId: 'items:put_in_container',
        targetId: chest,
        secondaryId: item,
      },
    });

    // Verify item was moved
    const actorInventory = entityManager.getComponentData(actor, 'items:inventory');
    expect(actorInventory.items).not.toContain(item);
    expect(actorInventory.items).toHaveLength(0);

    const containerData = entityManager.getComponentData(chest, 'items:container');
    expect(containerData.contents).toContain(item);
    expect(containerData.contents).toHaveLength(1);

    // Verify event was dispatched
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.payload.actorEntity).toBe(actor);
    expect(capturedEvent.payload.containerEntity).toBe(chest);
    expect(capturedEvent.payload.itemEntity).toBe(item);
  });

  it('should fail when container is at max items capacity', async () => {
    const { entityManager, eventBus } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:actor', {
      name: 'Test Actor',
      isPlayer: false,
    });
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', { items: ['item1'] });

    // Create item
    const item = entityManager.createEntity('item1');
    entityManager.addComponent(item, 'items:item', { name: 'New Item' });
    entityManager.addComponent(item, 'items:portable', {});
    entityManager.addComponent(item, 'items:weight', { weight: 1 });

    // Create container at max capacity
    const chest = entityManager.createEntity('chest1');
    entityManager.addComponent(chest, 'core:actor', { name: 'Small Box' });
    entityManager.addComponent(chest, 'core:position', { locationId: location });
    entityManager.addComponent(chest, 'items:container', {
      contents: ['existing1', 'existing2', 'existing3'],
      capacity: { maxItems: 3, maxWeight: 100 },
    });
    entityManager.addComponent(chest, 'items:openable', { isOpen: true });

    // Set up event listener for put_in_container_failed
    let failureEventCaptured = false;
    eventBus.on('core:perceptible_event', (event) => {
      if (event.payload.perceptionType === 'put_in_container_failed') {
        failureEventCaptured = true;
      }
    });

    // Dispatch attempt_action event
    await eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId: actor,
        actionId: 'items:put_in_container',
        targetId: chest,
        secondaryId: item,
      },
    });

    // Verify item was NOT moved
    const actorInventory = entityManager.getComponentData(actor, 'items:inventory');
    expect(actorInventory.items).toContain(item);

    const containerData = entityManager.getComponentData(chest, 'items:container');
    expect(containerData.contents).not.toContain(item);
    expect(containerData.contents).toHaveLength(3);

    // Verify failure event was dispatched
    expect(failureEventCaptured).toBe(true);
  });

  it('should fail when container exceeds max weight capacity', async () => {
    const { entityManager, eventBus } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:actor', {
      name: 'Test Actor',
      isPlayer: false,
    });
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', { items: ['heavy_item'] });

    // Create heavy item
    const heavyItem = entityManager.createEntity('heavy_item');
    entityManager.addComponent(heavyItem, 'items:item', { name: 'Heavy Item' });
    entityManager.addComponent(heavyItem, 'items:portable', {});
    entityManager.addComponent(heavyItem, 'items:weight', { weight: 50 });

    // Create existing items in container
    const existing1 = entityManager.createEntity('existing1');
    entityManager.addComponent(existing1, 'items:item', { name: 'Existing 1' });
    entityManager.addComponent(existing1, 'items:weight', { weight: 40 });

    const existing2 = entityManager.createEntity('existing2');
    entityManager.addComponent(existing2, 'items:item', { name: 'Existing 2' });
    entityManager.addComponent(existing2, 'items:weight', { weight: 30 });

    // Create container with weight limit
    const chest = entityManager.createEntity('chest1');
    entityManager.addComponent(chest, 'core:actor', { name: 'Weak Chest' });
    entityManager.addComponent(chest, 'core:position', { locationId: location });
    entityManager.addComponent(chest, 'items:container', {
      contents: ['existing1', 'existing2'],
      capacity: { maxItems: 10, maxWeight: 100 },
    });
    entityManager.addComponent(chest, 'items:openable', { isOpen: true });

    // Set up event listener
    let failureEventCaptured = false;
    eventBus.on('core:perceptible_event', (event) => {
      if (event.payload.perceptionType === 'put_in_container_failed') {
        failureEventCaptured = true;
      }
    });

    // Dispatch attempt_action event
    await eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId: actor,
        actionId: 'items:put_in_container',
        targetId: chest,
        secondaryId: heavyItem,
      },
    });

    // Verify item was NOT moved (would exceed 100 weight limit: 40 + 30 + 50 = 120)
    const actorInventory = entityManager.getComponentData(actor, 'items:inventory');
    expect(actorInventory.items).toContain(heavyItem);

    const containerData = entityManager.getComponentData(chest, 'items:container');
    expect(containerData.contents).not.toContain(heavyItem);

    // Verify failure event was dispatched
    expect(failureEventCaptured).toBe(true);
  });

  it('should handle multiple sequential put_in_container actions', async () => {
    const { entityManager, eventBus } = env;

    // Create location
    const location = entityManager.createEntity('location1');
    entityManager.addComponent(location, 'core:location', {
      name: 'Test Location',
    });

    // Create actor with multiple items
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent(actor, 'core:actor', {
      name: 'Test Actor',
      isPlayer: false,
    });
    entityManager.addComponent(actor, 'core:position', { locationId: location });
    entityManager.addComponent(actor, 'items:inventory', {
      items: ['item1', 'item2', 'item3'],
    });

    // Create items
    const item1 = entityManager.createEntity('item1');
    entityManager.addComponent(item1, 'items:item', { name: 'Item 1' });
    entityManager.addComponent(item1, 'items:portable', {});
    entityManager.addComponent(item1, 'items:weight', { weight: 5 });

    const item2 = entityManager.createEntity('item2');
    entityManager.addComponent(item2, 'items:item', { name: 'Item 2' });
    entityManager.addComponent(item2, 'items:portable', {});
    entityManager.addComponent(item2, 'items:weight', { weight: 5 });

    const item3 = entityManager.createEntity('item3');
    entityManager.addComponent(item3, 'items:item', { name: 'Item 3' });
    entityManager.addComponent(item3, 'items:portable', {});
    entityManager.addComponent(item3, 'items:weight', { weight: 5 });

    // Create container
    const chest = entityManager.createEntity('chest1');
    entityManager.addComponent(chest, 'core:actor', { name: 'Storage Chest' });
    entityManager.addComponent(chest, 'core:position', { locationId: location });
    entityManager.addComponent(chest, 'items:container', {
      contents: [],
      capacity: { maxItems: 10, maxWeight: 100 },
    });
    entityManager.addComponent(chest, 'items:openable', { isOpen: true });

    // Put all items in container
    await eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId: actor,
        actionId: 'items:put_in_container',
        targetId: chest,
        secondaryId: item1,
      },
    });

    await eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId: actor,
        actionId: 'items:put_in_container',
        targetId: chest,
        secondaryId: item2,
      },
    });

    await eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId: actor,
        actionId: 'items:put_in_container',
        targetId: chest,
        secondaryId: item3,
      },
    });

    // Verify all items were moved
    const actorInventory = entityManager.getComponentData(actor, 'items:inventory');
    expect(actorInventory.items).toHaveLength(0);

    const containerData = entityManager.getComponentData(chest, 'items:container');
    expect(containerData.contents).toHaveLength(3);
    expect(containerData.contents).toEqual(
      expect.arrayContaining([item1, item2, item3])
    );
  });
});
