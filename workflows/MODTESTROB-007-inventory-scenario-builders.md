# MODTESTROB-007: High-Level Scenario Builders - Inventory Scenarios

**Status:** Ready for Implementation
**Priority:** P1 (High)
**Estimated Time:** 3-4 hours
**Risk Level:** Low
**Phase:** 2 - Developer Experience

---

## Overview

Create high-level scenario builder functions for common inventory and item management patterns, eliminating repetitive setup code in item action tests.

### Problem Statement

Current inventory setup is verbose and error-prone:

```javascript
// Current approach - 25+ lines for simple inventory scenario
testEnv.given.actorExists('actor1', { location: 'room1' });
testEnv.given.itemExists('sword1', { location: 'room1' });
testEnv.given.itemExists('potion1', { location: 'room1' });

testEnv.given.actorHasComponent('actor1', 'core:inventory', {
  items: ['sword1'],
  capacity: 10,
  weight: 5,
});

testEnv.given.actorHasComponent('actor1', 'core:equipped', {
  mainHand: 'sword1',
});

testEnv.given.itemHasComponent('sword1', 'items:item');
testEnv.given.itemHasComponent('sword1', 'items:weapon', {
  damage: 10,
  type: 'sword',
});
testEnv.given.itemHasComponent('sword1', 'items:equippable', {
  slot: 'mainHand',
});
// ... more setup ...
```

### Target State

Clear, intent-revealing scenario functions:

```javascript
// New approach - 1-2 lines
testEnv.scenarios.inventory.actorWithWeapon({
  actor: 'actor1',
  weapon: 'sword1',
  equipped: true,
});

// Or even simpler
testEnv.scenarios.inventory.actorCarryingItems();
```

### Benefits

- **90% reduction** in setup code
- **Self-documenting** tests
- **Consistent patterns** across all item tests
- **Fewer errors** in inventory setup
- **Faster test writing**

---

## Prerequisites

**Required Understanding:**
- Item and inventory component system
- Weight and capacity mechanics
- Equipment slots and equippable items
- Container and storage mechanics
- Item location and ownership

**Required Files:**
- `tests/common/mods/ModTestFixture.js`
- `tests/common/mods/sittingScenarios.js` (pattern reference)
- Domain matchers (MODTESTROB-005)

**Development Environment:**
- Jest testing framework
- Node.js 18+ with ES modules

---

## Detailed Steps

### Step 1: Create Inventory Scenario Builder

Create `tests/common/mods/inventoryScenarios.js`:

```javascript
/**
 * @file High-level scenario builders for inventory and item management
 * @description Pre-configured setups for common item and inventory test scenarios
 */

/**
 * Scenario builder for inventory and item management
 */
export class InventoryScenarios {
  #testEnv;

  constructor(testEnv) {
    this.#testEnv = testEnv;
  }

  /**
   * Actor carrying items in inventory
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string[]} [options.items=['item1', 'item2']] - Item IDs
   * @param {string} [options.location='room1'] - Location ID
   * @param {number} [options.capacity=10] - Inventory capacity
   * @param {number} [options.totalWeight=5] - Total weight of items
   * @returns {Object} Created entity IDs
   */
  actorCarryingItems(options = {}) {
    const {
      actor = 'actor1',
      items = ['item1', 'item2'],
      location = 'room1',
      capacity = 10,
      totalWeight = 5,
    } = options;

    // Create location and actor
    this.#testEnv.given.locationExists(location);
    this.#testEnv.given.actorExists(actor, { location });

    // Create inventory component
    this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
      items,
      capacity,
      currentWeight: totalWeight,
    });

    // Create each item
    items.forEach((itemId, index) => {
      const weight = totalWeight / items.length; // Distribute weight evenly
      this.#testEnv.given.itemExists(itemId, {
        ownerId: actor,
        location: null, // In inventory
      });
      this.#testEnv.given.itemHasComponent(itemId, 'items:item');
      this.#testEnv.given.itemHasComponent(itemId, 'items:physical', {
        weight: Math.round(weight * 10) / 10,
      });
    });

    return { actor, items, location };
  }

  /**
   * Actor with weapon equipped
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.weapon='sword1'] - Weapon ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.equipped=true] - Whether weapon is equipped
   * @param {string} [options.slot='mainHand'] - Equipment slot
   * @param {number} [options.damage=10] - Weapon damage
   * @returns {Object} Created entity IDs
   */
  actorWithWeapon(options = {}) {
    const {
      actor = 'actor1',
      weapon = 'sword1',
      location = 'room1',
      equipped = true,
      slot = 'mainHand',
      damage = 10,
    } = options;

    // Create location and actor
    this.#testEnv.given.locationExists(location);
    this.#testEnv.given.actorExists(actor, { location });

    // Create inventory with weapon
    this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
      items: [weapon],
      capacity: 10,
      currentWeight: 3,
    });

    // Create equipped component if equipped
    if (equipped) {
      this.#testEnv.given.actorHasComponent(actor, 'core:equipped', {
        [slot]: weapon,
      });
    }

    // Create weapon item
    this.#testEnv.given.itemExists(weapon, {
      ownerId: actor,
      location: null,
    });
    this.#testEnv.given.itemHasComponent(weapon, 'items:item');
    this.#testEnv.given.itemHasComponent(weapon, 'items:weapon', {
      damage,
      type: 'sword',
    });
    this.#testEnv.given.itemHasComponent(weapon, 'items:equippable', {
      slot,
    });
    this.#testEnv.given.itemHasComponent(weapon, 'items:physical', {
      weight: 3,
    });

    return { actor, weapon, location };
  }

  /**
   * Items lying at location (on ground)
   * @param {Object} options
   * @param {string[]} [options.items=['item1', 'item2']] - Item IDs
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.createActor=false] - Whether to create actor at location
   * @param {string} [options.actor='actor1'] - Actor ID if createActor is true
   * @returns {Object} Created entity IDs
   */
  itemsAtLocation(options = {}) {
    const {
      items = ['item1', 'item2'],
      location = 'room1',
      createActor = false,
      actor = 'actor1',
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Optionally create actor
    if (createActor) {
      this.#testEnv.given.actorExists(actor, { location });
      this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
        items: [],
        capacity: 10,
        currentWeight: 0,
      });
    }

    // Create items at location
    items.forEach(itemId => {
      this.#testEnv.given.itemExists(itemId, {
        location,
        ownerId: null,
      });
      this.#testEnv.given.itemHasComponent(itemId, 'items:item');
      this.#testEnv.given.itemHasComponent(itemId, 'items:physical', {
        weight: 1,
      });
    });

    const result = { items, location };
    if (createActor) {
      result.actor = actor;
    }
    return result;
  }

  /**
   * Actor with full inventory (at capacity)
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {number} [options.capacity=10] - Inventory capacity
   * @returns {Object} Created entity IDs
   */
  actorWithFullInventory(options = {}) {
    const {
      actor = 'actor1',
      location = 'room1',
      capacity = 10,
    } = options;

    // Generate items to fill capacity
    const items = Array.from({ length: capacity }, (_, i) => `item${i + 1}`);

    return this.actorCarryingItems({
      actor,
      items,
      location,
      capacity,
      totalWeight: capacity, // Each item weighs 1
    });
  }

  /**
   * Actor with empty inventory
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {number} [options.capacity=10] - Inventory capacity
   * @returns {Object} Created entity IDs
   */
  actorWithEmptyInventory(options = {}) {
    const {
      actor = 'actor1',
      location = 'room1',
      capacity = 10,
    } = options;

    // Create location and actor
    this.#testEnv.given.locationExists(location);
    this.#testEnv.given.actorExists(actor, { location });

    // Create empty inventory
    this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
      items: [],
      capacity,
      currentWeight: 0,
    });

    return { actor, location };
  }

  /**
   * Container with items inside
   * @param {Object} options
   * @param {string} [options.container='chest1'] - Container ID
   * @param {string[]} [options.items=['item1', 'item2']] - Item IDs
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.locked=false] - Whether container is locked
   * @param {string} [options.keyId=null] - Key item ID if locked
   * @returns {Object} Created entity IDs
   */
  containerWithItems(options = {}) {
    const {
      container = 'chest1',
      items = ['item1', 'item2'],
      location = 'room1',
      locked = false,
      keyId = null,
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create container
    this.#testEnv.given.itemExists(container, { location });
    this.#testEnv.given.itemHasComponent(container, 'items:item');
    this.#testEnv.given.itemHasComponent(container, 'items:container', {
      contents: items,
      capacity: 20,
      locked,
      keyId: locked ? keyId : null,
    });

    // Create items inside container
    items.forEach(itemId => {
      this.#testEnv.given.itemExists(itemId, {
        location: null,
        ownerId: container,
      });
      this.#testEnv.given.itemHasComponent(itemId, 'items:item');
      this.#testEnv.given.itemHasComponent(itemId, 'items:physical', {
        weight: 1,
      });
    });

    const result = { container, items, location };
    if (locked && keyId) {
      result.keyId = keyId;
    }
    return result;
  }

  /**
   * Actor transferring item to another actor
   * @param {Object} options
   * @param {string} [options.giver='actor1'] - Giver actor ID
   * @param {string} [options.receiver='actor2'] - Receiver actor ID
   * @param {string} [options.item='item1'] - Item ID to transfer
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.receiverHasSpace=true] - Whether receiver has inventory space
   * @returns {Object} Created entity IDs
   */
  actorGivingItem(options = {}) {
    const {
      giver = 'actor1',
      receiver = 'actor2',
      item = 'item1',
      location = 'room1',
      receiverHasSpace = true,
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create giver with item
    this.#testEnv.given.actorExists(giver, { location });
    this.#testEnv.given.actorHasComponent(giver, 'core:inventory', {
      items: [item],
      capacity: 10,
      currentWeight: 2,
    });

    // Create receiver with or without space
    this.#testEnv.given.actorExists(receiver, { location });
    if (receiverHasSpace) {
      this.#testEnv.given.actorHasComponent(receiver, 'core:inventory', {
        items: [],
        capacity: 10,
        currentWeight: 0,
      });
    } else {
      // Full inventory
      const fillerItems = Array.from({ length: 10 }, (_, i) => `filler${i}`);
      this.#testEnv.given.actorHasComponent(receiver, 'core:inventory', {
        items: fillerItems,
        capacity: 10,
        currentWeight: 10,
      });
    }

    // Create item
    this.#testEnv.given.itemExists(item, {
      ownerId: giver,
      location: null,
    });
    this.#testEnv.given.itemHasComponent(item, 'items:item');
    this.#testEnv.given.itemHasComponent(item, 'items:physical', {
      weight: 2,
    });

    return { giver, receiver, item, location };
  }

  /**
   * Actor dropping item at location
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.item='item1'] - Item ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.equipped=false] - Whether item is equipped
   * @returns {Object} Created entity IDs
   */
  actorDroppingItem(options = {}) {
    const {
      actor = 'actor1',
      item = 'item1',
      location = 'room1',
      equipped = false,
    } = options;

    // Create location and actor
    this.#testEnv.given.locationExists(location);
    this.#testEnv.given.actorExists(actor, { location });

    // Create inventory with item
    this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
      items: [item],
      capacity: 10,
      currentWeight: 2,
    });

    // Optionally equip item
    if (equipped) {
      this.#testEnv.given.actorHasComponent(actor, 'core:equipped', {
        mainHand: item,
      });
    }

    // Create item
    this.#testEnv.given.itemExists(item, {
      ownerId: actor,
      location: null,
    });
    this.#testEnv.given.itemHasComponent(item, 'items:item');
    this.#testEnv.given.itemHasComponent(item, 'items:physical', {
      weight: 2,
    });

    if (equipped) {
      this.#testEnv.given.itemHasComponent(item, 'items:equippable', {
        slot: 'mainHand',
      });
    }

    return { actor, item, location };
  }

  /**
   * Actor picking up item from location
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.item='item1'] - Item ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.hasSpace=true] - Whether actor has inventory space
   * @param {number} [options.itemWeight=2] - Weight of item
   * @returns {Object} Created entity IDs
   */
  actorPickingUpItem(options = {}) {
    const {
      actor = 'actor1',
      item = 'item1',
      location = 'room1',
      hasSpace = true,
      itemWeight = 2,
    } = options;

    // Create location
    this.#testEnv.given.locationExists(location);

    // Create actor with or without space
    this.#testEnv.given.actorExists(actor, { location });
    if (hasSpace) {
      this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
        items: [],
        capacity: 10,
        currentWeight: 0,
      });
    } else {
      // Full inventory
      const fillerItems = Array.from({ length: 10 }, (_, i) => `filler${i}`);
      this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
        items: fillerItems,
        capacity: 10,
        currentWeight: 10,
      });
    }

    // Create item at location
    this.#testEnv.given.itemExists(item, {
      location,
      ownerId: null,
    });
    this.#testEnv.given.itemHasComponent(item, 'items:item');
    this.#testEnv.given.itemHasComponent(item, 'items:physical', {
      weight: itemWeight,
    });

    return { actor, item, location };
  }

  /**
   * Actor opening container at location
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.container='chest1'] - Container ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.locked=false] - Whether container is locked
   * @param {boolean} [options.hasKey=true] - Whether actor has key (if locked)
   * @param {string} [options.keyId='key1'] - Key item ID
   * @returns {Object} Created entity IDs
   */
  actorOpeningContainer(options = {}) {
    const {
      actor = 'actor1',
      container = 'chest1',
      location = 'room1',
      locked = false,
      hasKey = true,
      keyId = 'key1',
    } = options;

    // Create location and actor
    this.#testEnv.given.locationExists(location);
    this.#testEnv.given.actorExists(actor, { location });

    // Create actor inventory with or without key
    const actorItems = (locked && hasKey) ? [keyId] : [];
    this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
      items: actorItems,
      capacity: 10,
      currentWeight: actorItems.length,
    });

    // Create key item if needed
    if (locked && hasKey) {
      this.#testEnv.given.itemExists(keyId, {
        ownerId: actor,
        location: null,
      });
      this.#testEnv.given.itemHasComponent(keyId, 'items:item');
      this.#testEnv.given.itemHasComponent(keyId, 'items:key', {
        unlocks: container,
      });
    }

    // Create container
    this.#testEnv.given.itemExists(container, { location });
    this.#testEnv.given.itemHasComponent(container, 'items:item');
    this.#testEnv.given.itemHasComponent(container, 'items:container', {
      contents: [],
      capacity: 20,
      locked,
      keyId: locked ? keyId : null,
    });

    const result = { actor, container, location };
    if (locked) {
      result.locked = true;
      result.keyId = keyId;
      result.hasKey = hasKey;
    }
    return result;
  }

  /**
   * Actor putting item in container
   * @param {Object} options
   * @param {string} [options.actor='actor1'] - Actor ID
   * @param {string} [options.item='item1'] - Item ID
   * @param {string} [options.container='chest1'] - Container ID
   * @param {string} [options.location='room1'] - Location ID
   * @param {boolean} [options.containerHasSpace=true] - Whether container has space
   * @returns {Object} Created entity IDs
   */
  actorPuttingItemInContainer(options = {}) {
    const {
      actor = 'actor1',
      item = 'item1',
      container = 'chest1',
      location = 'room1',
      containerHasSpace = true,
    } = options;

    // Create location and actor
    this.#testEnv.given.locationExists(location);
    this.#testEnv.given.actorExists(actor, { location });

    // Create actor inventory with item
    this.#testEnv.given.actorHasComponent(actor, 'core:inventory', {
      items: [item],
      capacity: 10,
      currentWeight: 2,
    });

    // Create item
    this.#testEnv.given.itemExists(item, {
      ownerId: actor,
      location: null,
    });
    this.#testEnv.given.itemHasComponent(item, 'items:item');
    this.#testEnv.given.itemHasComponent(item, 'items:physical', {
      weight: 2,
    });

    // Create container with or without space
    this.#testEnv.given.itemExists(container, { location });
    this.#testEnv.given.itemHasComponent(container, 'items:item');

    if (containerHasSpace) {
      this.#testEnv.given.itemHasComponent(container, 'items:container', {
        contents: [],
        capacity: 20,
        locked: false,
      });
    } else {
      // Full container
      const fillerItems = Array.from({ length: 20 }, (_, i) => `filler${i}`);
      this.#testEnv.given.itemHasComponent(container, 'items:container', {
        contents: fillerItems,
        capacity: 20,
        locked: false,
      });
    }

    return { actor, item, container, location };
  }
}

/**
 * Factory function to create inventory scenarios for a test environment
 * @param {Object} testEnv - ModTestFixture test environment
 * @returns {InventoryScenarios}
 */
export function createInventoryScenarios(testEnv) {
  return new InventoryScenarios(testEnv);
}
```

### Step 2: Integrate with ModTestFixture

Update `tests/common/mods/ModTestFixture.js`:

```javascript
// Add import at top
import { createInventoryScenarios } from './inventoryScenarios.js';

// Update scenarios property in forAction method
scenarios: {
  sitting: createSittingScenarios(testEnv),
  inventory: createInventoryScenarios(testEnv),
},
```

### Step 3: Create Unit Tests

Create `tests/unit/common/mods/inventoryScenarios.test.js`:

```javascript
import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { registerDomainMatchers } from '../../../common/mods/domainMatchers.js';

describe('Inventory Scenarios - Unit Tests', () => {
  let testBed;
  let testEnv;

  beforeAll(() => {
    registerDomainMatchers();
  });

  beforeEach(() => {
    testBed = createTestBed();
    testEnv = ModTestFixture.forAction('pick_up_item', testBed);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('actorCarryingItems', () => {
    it('should create actor with items in inventory', () => {
      const result = testEnv.scenarios.inventory.actorCarryingItems();

      expect(result).toEqual({
        actor: 'actor1',
        items: ['item1', 'item2'],
        location: 'room1',
      });

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponent('core:inventory');
      expect(actor).toHaveComponentData('core:inventory', {
        items: ['item1', 'item2'],
        capacity: 10,
      });

      expect(testEnv.getEntity('item1')).toHaveComponent('items:item');
      expect(testEnv.getEntity('item2')).toHaveComponent('items:item');
    });

    it('should accept custom options', () => {
      const result = testEnv.scenarios.inventory.actorCarryingItems({
        actor: 'hero',
        items: ['sword', 'potion'],
        location: 'dungeon',
        capacity: 15,
      });

      expect(result.actor).toBe('hero');
      expect(result.items).toEqual(['sword', 'potion']);
      expect(result.location).toBe('dungeon');
    });
  });

  describe('actorWithWeapon', () => {
    it('should create actor with equipped weapon', () => {
      const result = testEnv.scenarios.inventory.actorWithWeapon();

      expect(result).toEqual({
        actor: 'actor1',
        weapon: 'sword1',
        location: 'room1',
      });

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponent('core:equipped');
      expect(actor).toHaveComponentData('core:equipped', {
        mainHand: 'sword1',
      });

      const weapon = testEnv.getEntity('sword1');
      expect(weapon).toHaveComponent('items:weapon');
      expect(weapon).toHaveComponent('items:equippable');
    });

    it('should create weapon without equipping when equipped=false', () => {
      testEnv.scenarios.inventory.actorWithWeapon({ equipped: false });

      const actor = testEnv.getEntity('actor1');
      expect(actor).not.toHaveComponent('core:equipped');
      expect(actor).toHaveComponent('core:inventory');
    });
  });

  describe('itemsAtLocation', () => {
    it('should create items at location without actor', () => {
      const result = testEnv.scenarios.inventory.itemsAtLocation();

      expect(result).toEqual({
        items: ['item1', 'item2'],
        location: 'room1',
      });

      const item1 = testEnv.getEntity('item1');
      expect(item1).toHaveComponentData('core:position', {
        location: 'room1',
      });
    });

    it('should optionally create actor at location', () => {
      const result = testEnv.scenarios.inventory.itemsAtLocation({
        createActor: true,
      });

      expect(result.actor).toBe('actor1');
      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponent('core:inventory');
      expect(actor).toBeAt('room1');
    });
  });

  describe('actorWithFullInventory', () => {
    it('should create actor with full inventory', () => {
      const result = testEnv.scenarios.inventory.actorWithFullInventory({
        capacity: 5,
      });

      expect(result.items.length).toBe(5);

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: ['item1', 'item2', 'item3', 'item4', 'item5'],
        capacity: 5,
      });
    });
  });

  describe('actorWithEmptyInventory', () => {
    it('should create actor with empty inventory', () => {
      const result = testEnv.scenarios.inventory.actorWithEmptyInventory();

      expect(result).toEqual({
        actor: 'actor1',
        location: 'room1',
      });

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: [],
        capacity: 10,
        currentWeight: 0,
      });
    });
  });

  describe('containerWithItems', () => {
    it('should create unlocked container with items', () => {
      const result = testEnv.scenarios.inventory.containerWithItems();

      expect(result).toEqual({
        container: 'chest1',
        items: ['item1', 'item2'],
        location: 'room1',
      });

      const container = testEnv.getEntity('chest1');
      expect(container).toHaveComponent('items:container');
      expect(container).toHaveComponentData('items:container', {
        contents: ['item1', 'item2'],
        locked: false,
      });
    });

    it('should create locked container with key', () => {
      const result = testEnv.scenarios.inventory.containerWithItems({
        locked: true,
        keyId: 'key1',
      });

      expect(result.keyId).toBe('key1');

      const container = testEnv.getEntity('chest1');
      expect(container).toHaveComponentData('items:container', {
        locked: true,
        keyId: 'key1',
      });
    });
  });

  describe('actorGivingItem', () => {
    it('should set up item transfer scenario', () => {
      const result = testEnv.scenarios.inventory.actorGivingItem();

      expect(result).toEqual({
        giver: 'actor1',
        receiver: 'actor2',
        item: 'item1',
        location: 'room1',
      });

      const giver = testEnv.getEntity('actor1');
      expect(giver).toHaveComponentData('core:inventory', {
        items: ['item1'],
      });

      const receiver = testEnv.getEntity('actor2');
      expect(receiver).toHaveComponentData('core:inventory', {
        items: [],
      });
    });

    it('should create receiver without space when receiverHasSpace=false', () => {
      testEnv.scenarios.inventory.actorGivingItem({
        receiverHasSpace: false,
      });

      const receiver = testEnv.getEntity('actor2');
      const inventory = receiver.components.find(c => c.type === 'core:inventory');
      expect(inventory.data.items.length).toBe(10);
      expect(inventory.data.currentWeight).toBe(10);
    });
  });

  describe('actorDroppingItem', () => {
    it('should set up item drop scenario', () => {
      const result = testEnv.scenarios.inventory.actorDroppingItem();

      expect(result).toEqual({
        actor: 'actor1',
        item: 'item1',
        location: 'room1',
      });

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: ['item1'],
      });
    });

    it('should optionally equip item before drop', () => {
      testEnv.scenarios.inventory.actorDroppingItem({ equipped: true });

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponent('core:equipped');
    });
  });

  describe('actorPickingUpItem', () => {
    it('should set up item pickup scenario', () => {
      const result = testEnv.scenarios.inventory.actorPickingUpItem();

      expect(result).toEqual({
        actor: 'actor1',
        item: 'item1',
        location: 'room1',
      });

      const item = testEnv.getEntity('item1');
      expect(item).toBeAt('room1');

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: [],
      });
    });

    it('should create actor without space when hasSpace=false', () => {
      testEnv.scenarios.inventory.actorPickingUpItem({ hasSpace: false });

      const actor = testEnv.getEntity('actor1');
      const inventory = actor.components.find(c => c.type === 'core:inventory');
      expect(inventory.data.items.length).toBe(10);
    });
  });

  describe('actorOpeningContainer', () => {
    it('should set up unlocked container opening', () => {
      const result = testEnv.scenarios.inventory.actorOpeningContainer();

      expect(result).toEqual({
        actor: 'actor1',
        container: 'chest1',
        location: 'room1',
      });

      const container = testEnv.getEntity('chest1');
      expect(container).toHaveComponentData('items:container', {
        locked: false,
      });
    });

    it('should set up locked container with key', () => {
      const result = testEnv.scenarios.inventory.actorOpeningContainer({
        locked: true,
        hasKey: true,
      });

      expect(result.locked).toBe(true);
      expect(result.hasKey).toBe(true);

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: ['key1'],
      });

      const container = testEnv.getEntity('chest1');
      expect(container).toHaveComponentData('items:container', {
        locked: true,
        keyId: 'key1',
      });
    });

    it('should set up locked container without key', () => {
      const result = testEnv.scenarios.inventory.actorOpeningContainer({
        locked: true,
        hasKey: false,
      });

      expect(result.hasKey).toBe(false);

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: [],
      });
    });
  });

  describe('actorPuttingItemInContainer', () => {
    it('should set up putting item in container', () => {
      const result = testEnv.scenarios.inventory.actorPuttingItemInContainer();

      expect(result).toEqual({
        actor: 'actor1',
        item: 'item1',
        container: 'chest1',
        location: 'room1',
      });

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: ['item1'],
      });

      const container = testEnv.getEntity('chest1');
      expect(container).toHaveComponentData('items:container', {
        contents: [],
        capacity: 20,
      });
    });

    it('should create full container when containerHasSpace=false', () => {
      testEnv.scenarios.inventory.actorPuttingItemInContainer({
        containerHasSpace: false,
      });

      const container = testEnv.getEntity('chest1');
      const containerComp = container.components.find(c => c.type === 'items:container');
      expect(containerComp.data.contents.length).toBe(20);
    });
  });
});
```

### Step 4: Create Integration Tests

Create `tests/integration/common/mods/inventoryScenarios.integration.test.js`:

```javascript
import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { registerDomainMatchers } from '../../../common/mods/domainMatchers.js';

describe('Inventory Scenarios - Integration Tests', () => {
  let testBed;

  beforeAll(() => {
    registerDomainMatchers();
  });

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Real Action Tests with Scenarios', () => {
    it('should test pick_up_item action with items at location', async () => {
      const testEnv = ModTestFixture.forAction('pick_up_item', testBed);

      testEnv.scenarios.inventory.itemsAtLocation({
        items: ['sword'],
        createActor: true,
      });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        item: 'sword',
      });

      expect(result).toSucceed();
      expect(result).toUpdateComponent('core:inventory', 'actor1');

      const actor = testEnv.getEntity('actor1');
      expect(actor).toHaveComponentData('core:inventory', {
        items: ['sword'],
      });
    });

    it('should test drop_item action with actor carrying items', async () => {
      const testEnv = ModTestFixture.forAction('drop_item', testBed);

      testEnv.scenarios.inventory.actorDroppingItem({
        item: 'sword',
      });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        item: 'sword',
      });

      expect(result).toSucceed();
      expect(result).toUpdateComponent('core:inventory', 'actor1');

      const item = testEnv.getEntity('sword');
      expect(item).toBeAt('room1');
    });

    it('should test give_item action with transfer scenario', async () => {
      const testEnv = ModTestFixture.forAction('give_item', testBed);

      testEnv.scenarios.inventory.actorGivingItem({
        giver: 'actor1',
        receiver: 'actor2',
        item: 'potion',
      });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
        item: 'potion',
      });

      expect(result).toSucceed();
      expect(result).toUpdateComponent('core:inventory', 'actor1');
      expect(result).toUpdateComponent('core:inventory', 'actor2');

      const receiver = testEnv.getEntity('actor2');
      expect(receiver).toHaveComponentData('core:inventory', {
        items: ['potion'],
      });
    });

    it('should test open_container action with locked container', async () => {
      const testEnv = ModTestFixture.forAction('open_container', testBed);

      testEnv.scenarios.inventory.actorOpeningContainer({
        locked: true,
        hasKey: true,
      });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        container: 'chest1',
      });

      expect(result).toSucceed();
      expect(result).toUpdateComponent('items:container', 'chest1');

      const container = testEnv.getEntity('chest1');
      expect(container).toHaveComponentData('items:container', {
        locked: false,
      });
    });

    it('should test weight capacity validation with full inventory', async () => {
      const testEnv = ModTestFixture.forAction('pick_up_item', testBed);

      testEnv.scenarios.inventory.actorPickingUpItem({
        hasSpace: false,
        itemWeight: 5,
      });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        item: 'item1',
      });

      expect(result).toFail();
      expect(result).toHaveValidationError('capacity');
    });
  });

  describe('Before/After Comparison', () => {
    it('demonstrates setup code reduction', async () => {
      const testEnv = ModTestFixture.forAction('give_item', testBed);

      // OLD WAY - 20+ lines
      // testEnv.given.locationExists('room1');
      // testEnv.given.actorExists('actor1', { location: 'room1' });
      // testEnv.given.actorExists('actor2', { location: 'room1' });
      // testEnv.given.actorHasComponent('actor1', 'core:inventory', { ... });
      // testEnv.given.actorHasComponent('actor2', 'core:inventory', { ... });
      // testEnv.given.itemExists('potion', { ... });
      // testEnv.given.itemHasComponent('potion', 'items:item');
      // testEnv.given.itemHasComponent('potion', 'items:physical', { ... });
      // ... more setup ...

      // NEW WAY - 1 line
      testEnv.scenarios.inventory.actorGivingItem({ item: 'potion' });

      const result = await testEnv.when.actorPerformsAction('actor1', {
        target: 'actor2',
        item: 'potion',
      });

      expect(result).toSucceed();
    });
  });
});
```

### Step 5: Create Usage Guide

Create `docs/testing/inventory-scenarios-guide.md`:

```markdown
# Inventory Scenarios Guide

## Overview

High-level inventory scenario builders eliminate repetitive setup code for common item management patterns.

## Available Scenarios

### `actorCarryingItems(options)`
Actor with items in inventory.

```javascript
testEnv.scenarios.inventory.actorCarryingItems({
  actor: 'hero',
  items: ['sword', 'potion'],
  capacity: 15,
});
```

### `actorWithWeapon(options)`
Actor with equipped weapon.

```javascript
testEnv.scenarios.inventory.actorWithWeapon({
  weapon: 'sword',
  equipped: true,
  damage: 15,
});
```

### `itemsAtLocation(options)`
Items lying at location.

```javascript
testEnv.scenarios.inventory.itemsAtLocation({
  items: ['sword', 'potion'],
  createActor: true,
});
```

### `actorWithFullInventory(options)`
Actor with full inventory capacity.

```javascript
testEnv.scenarios.inventory.actorWithFullInventory({
  capacity: 10,
});
```

### `actorWithEmptyInventory(options)`
Actor with empty inventory.

```javascript
testEnv.scenarios.inventory.actorWithEmptyInventory();
```

### `containerWithItems(options)`
Container with items inside.

```javascript
testEnv.scenarios.inventory.containerWithItems({
  locked: true,
  keyId: 'key1',
});
```

### `actorGivingItem(options)`
Actor transferring item to another actor.

```javascript
testEnv.scenarios.inventory.actorGivingItem({
  giver: 'actor1',
  receiver: 'actor2',
  item: 'sword',
});
```

### `actorDroppingItem(options)`
Actor dropping item at location.

```javascript
testEnv.scenarios.inventory.actorDroppingItem({
  item: 'sword',
  equipped: true,
});
```

### `actorPickingUpItem(options)`
Actor picking up item from location.

```javascript
testEnv.scenarios.inventory.actorPickingUpItem({
  item: 'sword',
  hasSpace: true,
});
```

### `actorOpeningContainer(options)`
Actor opening container.

```javascript
testEnv.scenarios.inventory.actorOpeningContainer({
  locked: true,
  hasKey: true,
});
```

### `actorPuttingItemInContainer(options)`
Actor putting item in container.

```javascript
testEnv.scenarios.inventory.actorPuttingItemInContainer({
  item: 'sword',
  container: 'chest',
});
```

## Migration Example

**Before:**
```javascript
// 25 lines of setup
testEnv.given.locationExists('room1');
testEnv.given.actorExists('actor1', { location: 'room1' });
testEnv.given.itemExists('sword', { location: 'room1' });
testEnv.given.actorHasComponent('actor1', 'core:inventory', { ... });
// ... 20 more lines ...
```

**After:**
```javascript
// 1 line
testEnv.scenarios.inventory.itemsAtLocation({
  items: ['sword'],
  createActor: true,
});
```

## Best Practices

1. Use scenarios for common patterns
2. Customize with options when needed
3. Combine with domain matchers
4. Document new scenarios for reuse
```

---

## Validation Criteria

### Unit Tests Must Pass

```bash
NODE_ENV=test npx jest tests/unit/common/mods/inventoryScenarios.test.js --no-coverage --verbose
```

### Integration Tests Must Pass

```bash
NODE_ENV=test npx jest tests/integration/common/mods/inventoryScenarios.integration.test.js --no-coverage --verbose
```

### Code Quality Checks

```bash
npx eslint tests/common/mods/inventoryScenarios.js
npm run typecheck
```

---

## Files Created/Modified

### New Files

1. **`tests/common/mods/inventoryScenarios.js`** (~550 lines)
2. **`tests/unit/common/mods/inventoryScenarios.test.js`** (~400 lines)
3. **`tests/integration/common/mods/inventoryScenarios.integration.test.js`** (~200 lines)
4. **`docs/testing/inventory-scenarios-guide.md`** (~150 lines)

### Modified Files

1. **`tests/common/mods/ModTestFixture.js`**
   - Add inventory scenarios to scenarios property

---

## Testing

```bash
NODE_ENV=test npx jest tests/unit/common/mods/inventoryScenarios.test.js tests/integration/common/mods/inventoryScenarios.integration.test.js --no-coverage --silent
```

---

## Rollback Plan

```bash
rm tests/common/mods/inventoryScenarios.js
rm tests/unit/common/mods/inventoryScenarios.test.js
rm tests/integration/common/mods/inventoryScenarios.integration.test.js
rm docs/testing/inventory-scenarios-guide.md
git checkout tests/common/mods/ModTestFixture.js
NODE_ENV=test npm run test:unit
```

---

## Commit Strategy

### Commit 1: Implementation
```bash
git add tests/common/mods/inventoryScenarios.js tests/unit/common/mods/inventoryScenarios.test.js
git commit -m "feat(testing): add inventory scenario builders

- Implement 11 common inventory patterns
- Include capacity, weight, equipment scenarios
- Add container and transfer scenarios
- Comprehensive unit tests

Reduces setup code by 90%"
```

### Commit 2: Integration
```bash
git add tests/common/mods/ModTestFixture.js tests/integration/common/mods/inventoryScenarios.integration.test.js
git commit -m "feat(testing): integrate inventory scenarios

- Add to ModTestFixture scenarios
- Integration tests with real actions
- Before/after comparison"
```

### Commit 3: Documentation
```bash
git add docs/testing/inventory-scenarios-guide.md
git commit -m "docs(testing): add inventory scenarios guide

- Document all 11 scenarios
- Migration examples
- Best practices"
```

---

## Success Criteria

- [x] All 11 inventory scenarios implemented
- [x] Default values work correctly
- [x] Custom options accepted
- [x] Integration with ModTestFixture
- [x] Unit tests 100% coverage
- [x] Documentation complete

**Impact:**
- 90% reduction in setup code
- Self-documenting tests
- Consistent patterns
- Faster test writing

---

## Next Steps

1. **MODTESTROB-008**: Create comprehensive testing best practices guide
2. **Begin Phase 3** documentation tickets
3. **Start migration** of existing tests (MODTESTROB-010)

---

## Notes

- Covers all common inventory operations
- Works with domain matchers (MODTESTROB-005)
- Complements sitting scenarios (MODTESTROB-006)
- No breaking changes to existing tests
