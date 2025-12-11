/**
 * @file Unit tests for inventory scenario builders
 * @description Validates the high-level ModEntityScenarios inventory helpers
 */

import { describe, it, expect } from '@jest/globals';
import { ModEntityScenarios } from '../../../../tests/common/mods/ModEntityBuilder.js';

const getComponent = (entity, componentId) => entity.components[componentId];

describe('ModEntityScenarios inventory helpers', () => {
  it('creates a default inventory loadout with populated inventory and items', () => {
    const scenario = ModEntityScenarios.createInventoryLoadout();

    expect(scenario.room.id).toBe('room_inventory');
    expect(scenario.items).toHaveLength(2);

    const inventory = getComponent(scenario.actor, 'items:inventory');
    expect(inventory.items).toEqual(['item_primary', 'item_secondary']);
    expect(inventory.capacity).toEqual({ maxWeight: 50, maxItems: 10 });

    const firstItem = scenario.items[0];
    expect(getComponent(firstItem, 'items:item')).toEqual({});
    expect(getComponent(firstItem, 'items:portable')).toEqual({});
    expect(getComponent(firstItem, 'core:weight')).toEqual({ weight: 1 });
  });

  it('creates items on the ground with optional actor inventory', () => {
    const scenario = ModEntityScenarios.createItemsOnGround({
      items: [{ id: 'coin', name: 'Coin', weight: 0.1 }],
      actor: {
        id: 'actor_ground',
        name: 'Grounded',
        inventoryItems: [{ id: 'satchel', name: 'Satchel', weight: 0.5 }],
      },
    });

    expect(scenario.items).toHaveLength(1);
    const groundItem = scenario.items[0];
    expect(getComponent(groundItem, 'core:position').locationId).toBe(
      'room_inventory'
    );

    expect(scenario.actor.id).toBe('actor_ground');
    const actorInventory = getComponent(scenario.actor, 'items:inventory');
    expect(actorInventory.items).toContain('satchel');
    expect(scenario.actorInventoryItems[0].id).toBe('satchel');
  });

  it('creates container scenarios with contents and optional key items', () => {
    const scenario = ModEntityScenarios.createContainerWithContents({
      container: {
        id: 'vault',
        name: 'Vault',
        isOpen: false,
        requiresKey: true,
      },
      contents: [{ id: 'gemstone', name: 'Gemstone', weight: 2 }],
    });

    const containerData = getComponent(scenario.container, 'containers-core:container');
    expect(containerData.isOpen).toBe(false);
    expect(containerData.requiresKey).toBe(true);
    expect(containerData.contents).toEqual(['gemstone']);
    expect(containerData.capacity).toEqual({ maxWeight: 50, maxItems: 5 });
    expect(containerData.keyItemId).toBeDefined();
    expect(scenario.keyItem).toBeDefined();
  });

  it('creates inventory transfer scenarios with giver and receiver actors', () => {
    const scenario = ModEntityScenarios.createInventoryTransfer({
      giverId: 'giver',
      receiverId: 'receiver',
      item: { id: 'artifact', name: 'Artifact', weight: 3 },
      receiverItems: [{ id: 'wallet', name: 'Wallet', weight: 0.2 }],
    });

    const giverInventory = getComponent(scenario.giver, 'items:inventory');
    const receiverInventory = getComponent(
      scenario.receiver,
      'items:inventory'
    );

    expect(giverInventory.items).toContain('artifact');
    expect(receiverInventory.items).toEqual(['wallet']);
    expect(scenario.transferItem.id).toBe('artifact');
  });

  it('creates drop item scenarios with actor inventory', () => {
    const scenario = ModEntityScenarios.createDropItemScenario({
      actor: { id: 'dropper' },
      item: { id: 'to_drop', weight: 1 },
      additionalInventoryItems: [{ id: 'extra', weight: 0.5 }],
    });

    expect(scenario.item.id).toBe('to_drop');
    const inventory = getComponent(scenario.actor, 'items:inventory');
    expect(inventory.items).toEqual(['to_drop', 'extra']);
  });

  it('creates pickup scenarios and supports full inventory configuration', () => {
    const scenario = ModEntityScenarios.createPickupScenario({
      actor: { id: 'picker' },
      item: { id: 'ground_pickup', weight: 0.3 },
      inventoryItems: [{ id: 'existing', weight: 0.1 }],
      fullInventory: true,
    });

    expect(scenario.groundItem.id).toBe('ground_pickup');
    expect(getComponent(scenario.groundItem, 'core:position').locationId).toBe(
      'room_inventory'
    );

    const inventory = getComponent(scenario.actor, 'items:inventory');
    expect(inventory.items).toContain('existing');
    expect(inventory.items.length).toBe(inventory.capacity.maxItems);
  });

  it('creates open container scenarios with actor context', () => {
    const scenario = ModEntityScenarios.createOpenContainerScenario({
      actor: {
        id: 'container_actor',
        inventoryItems: [{ id: 'note', weight: 0.1 }],
      },
      container: { id: 'crate', isOpen: false },
      contents: [{ id: 'stored', weight: 1 }],
      locked: true,
    });

    const containerData = getComponent(scenario.container, 'containers-core:container');
    expect(containerData.isOpen).toBe(false);
    expect(containerData.requiresKey).toBe(true);
    expect(scenario.actor.id).toBe('container_actor');
    expect(scenario.actorInventoryItems[0].id).toBe('note');
  });

  it('creates put in container scenarios with held item and container contents', () => {
    const scenario = ModEntityScenarios.createPutInContainerScenario({
      actor: { id: 'storer' },
      container: { id: 'locker' },
      item: { id: 'supply', weight: 0.4 },
      containerContents: [{ id: 'existing_supply', weight: 0.2 }],
      containerFull: true,
    });

    expect(scenario.heldItem.id).toBe('supply');
    const containerData = getComponent(scenario.container, 'containers-core:container');
    expect(containerData.isOpen).toBe(true);
    expect(containerData.contents.length).toBe(containerData.capacity.maxItems);
    const inventory = getComponent(scenario.actor, 'items:inventory');
    expect(inventory.items).toContain('supply');
  });
});
