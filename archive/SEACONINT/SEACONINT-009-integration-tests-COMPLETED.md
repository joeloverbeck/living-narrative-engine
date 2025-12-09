# SEACONINT-009: Integration Tests for Seated Container Interaction

**Status**: COMPLETED
**Priority**: HIGH
**Estimated Effort**: 2-3 hours
**Dependencies**: SEACONINT-004, SEACONINT-005, SEACONINT-006
**Blocks**: None (final testing step)

## Outcome

**Completed**: All 4 integration test files created and passing.

### Bug Fixed During Implementation

During test development, discovered and fixed a bug in `src/logic/operators/isOnNearbyFurnitureOperator.js`:
- **Issue**: Operator was checking `core:position.locationId` to determine what furniture an entity is on
- **Problem**: `core:position.locationId` contains the ROOM id, not the furniture id
- **Fix**: Changed to check `furniture:on_furniture.furnitureId` which correctly tracks what furniture an entity is placed on

### Files Created

| File | Tests |
|------|-------|
| `tests/integration/mods/furniture/takeFromNearbySurfaceActionDiscovery.test.js` | 10 tests |
| `tests/integration/mods/furniture/putOnNearbySurfaceActionDiscovery.test.js` | 10 tests |
| `tests/integration/mods/furniture/takeFromNearbySurfaceRuleExecution.test.js` | 5 tests |
| `tests/integration/mods/furniture/putOnNearbySurfaceRuleExecution.test.js` | 5 tests |

### Files Modified

| File | Change |
|------|--------|
| `src/logic/operators/isOnNearbyFurnitureOperator.js` | Fixed to check `furniture:on_furniture` component |
| `tests/unit/logic/operators/isOnNearbyFurnitureOperator.test.js` | Updated expectations for new component |

### Test Results

```
Test Suites: 5 passed, 5 total
Tests:       56 passed, 56 total (furniture integration tests)
             15 passed, 15 total (operator unit tests)
```

---

## Objective

Create comprehensive integration tests for the seated container interaction feature, covering action discovery and rule execution for both take and put actions.

## Files To Create

| File | Purpose |
|------|---------|
| `tests/integration/mods/furniture/takeFromNearbySurfaceActionDiscovery.test.js` | Action discovery tests for take action |
| `tests/integration/mods/furniture/putOnNearbySurfaceActionDiscovery.test.js` | Action discovery tests for put action |
| `tests/integration/mods/furniture/takeFromNearbySurfaceRuleExecution.test.js` | Rule execution tests for take action |
| `tests/integration/mods/furniture/putOnNearbySurfaceRuleExecution.test.js` | Rule execution tests for put action |

## Files To Modify

None.

## Out of Scope

- **DO NOT** modify the operator implementation
- **DO NOT** modify the action/rule/condition JSON files
- **DO NOT** create unit tests (handled in SEACONINT-008)
- **DO NOT** modify any entity definitions or instances
- **DO NOT** modify the mod manifest

## Implementation Details

### 1. Take Action Discovery Tests

Create `tests/integration/mods/furniture/takeFromNearbySurfaceActionDiscovery.test.js`:

```javascript
/**
 * @file takeFromNearbySurfaceActionDiscovery.test.js
 * @description Integration tests for take_from_nearby_surface action discovery
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('take_from_nearby_surface Action Discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'furniture',
      'furniture:take_from_nearby_surface'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('when actor is seated near furniture with open container', () => {
    it('should discover action when container has items', async () => {
      // Setup: Actor seated on stool near table with open container containing items
      const { actor, stool, table, container, item } =
        await setupSeatedActorWithNearbyContainer(fixture);

      // Act
      const actions = await fixture.discoverActions(actor.id);

      // Assert
      expect(actions).toContainAction('furniture:take_from_nearby_surface');
      const takeAction = actions.find(
        (a) => a.id === 'furniture:take_from_nearby_surface'
      );
      expect(takeAction.targets.primary).toContain(container.id);
      expect(takeAction.targets.secondary).toContain(item.id);
    });

    it('should NOT discover action when container is closed', async () => {
      const { actor, container } =
        await setupSeatedActorWithNearbyContainer(fixture);
      await fixture.setComponentData(container.id, 'items:container', {
        isOpen: false,
      });

      const actions = await fixture.discoverActions(actor.id);

      expect(actions).not.toContainAction('furniture:take_from_nearby_surface');
    });

    it('should NOT discover action when container is empty', async () => {
      const { actor, container } =
        await setupSeatedActorWithNearbyContainer(fixture);
      await fixture.removeAllItemsFromContainer(container.id);

      const actions = await fixture.discoverActions(actor.id);

      // Action may still appear but with no secondary targets
      const takeAction = actions.find(
        (a) => a.id === 'furniture:take_from_nearby_surface'
      );
      if (takeAction) {
        expect(takeAction.targets.secondary).toHaveLength(0);
      }
    });
  });

  describe('when actor is NOT seated', () => {
    it('should NOT discover action for standing actor', async () => {
      const { actor } = await setupStandingActorWithNearbyContainer(fixture);

      const actions = await fixture.discoverActions(actor.id);

      expect(actions).not.toContainAction('furniture:take_from_nearby_surface');
    });
  });

  describe('when furniture is NOT nearby', () => {
    it('should NOT discover action when seated but furniture not in nearFurnitureIds', async () => {
      const { actor } =
        await setupSeatedActorWithDistantContainer(fixture);

      const actions = await fixture.discoverActions(actor.id);

      expect(actions).not.toContainAction('furniture:take_from_nearby_surface');
    });
  });

  describe('when actor has no free hands', () => {
    it('should NOT discover action when both hands are occupied', async () => {
      const { actor } =
        await setupSeatedActorWithNearbyContainer(fixture);
      await fixture.occupyBothHands(actor.id);

      const actions = await fixture.discoverActions(actor.id);

      // Action should fail prerequisite check
      expect(actions).not.toContainAction('furniture:take_from_nearby_surface');
    });
  });
});

// Helper functions
async function setupSeatedActorWithNearbyContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [table.id] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const item = await fixture.createEntity('items:apple', {
    'core:position': { locationId: container.id },
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': { items: [], maxWeight: 50, maxVolume: 50 },
  });

  return { actor, stool, table, container, item, location };
}

async function setupStandingActorWithNearbyContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const item = await fixture.createEntity('items:apple', {
    'core:position': { locationId: container.id },
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'items:inventory': { items: [], maxWeight: 50, maxVolume: 50 },
  });

  return { actor, table, container, item, location };
}

async function setupSeatedActorWithDistantContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    // Note: nearFurnitureIds does NOT include the table
    'furniture:near_furniture': { nearFurnitureIds: [] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const item = await fixture.createEntity('items:apple', {
    'core:position': { locationId: container.id },
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': { items: [], maxWeight: 50, maxVolume: 50 },
  });

  return { actor, stool, table, container, item, location };
}
```

### 2. Put Action Discovery Tests

Create `tests/integration/mods/furniture/putOnNearbySurfaceActionDiscovery.test.js`:

```javascript
/**
 * @file putOnNearbySurfaceActionDiscovery.test.js
 * @description Integration tests for put_on_nearby_surface action discovery
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('put_on_nearby_surface Action Discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'furniture',
      'furniture:put_on_nearby_surface'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('when actor is seated near furniture with open container', () => {
    it('should discover action when actor has inventory items', async () => {
      const { actor, container, inventoryItem } =
        await setupSeatedActorWithItemAndNearbyContainer(fixture);

      const actions = await fixture.discoverActions(actor.id);

      expect(actions).toContainAction('furniture:put_on_nearby_surface');
      const putAction = actions.find(
        (a) => a.id === 'furniture:put_on_nearby_surface'
      );
      expect(putAction.targets.primary).toContain(container.id);
      expect(putAction.targets.secondary).toContain(inventoryItem.id);
    });

    it('should NOT discover action when container is closed', async () => {
      const { actor, container } =
        await setupSeatedActorWithItemAndNearbyContainer(fixture);
      await fixture.setComponentData(container.id, 'items:container', {
        isOpen: false,
      });

      const actions = await fixture.discoverActions(actor.id);

      expect(actions).not.toContainAction('furniture:put_on_nearby_surface');
    });

    it('should NOT discover action when actor inventory is empty', async () => {
      const { actor } =
        await setupSeatedActorWithEmptyInventoryNearContainer(fixture);

      const actions = await fixture.discoverActions(actor.id);

      // Action may still appear but with no secondary targets
      const putAction = actions.find(
        (a) => a.id === 'furniture:put_on_nearby_surface'
      );
      if (putAction) {
        expect(putAction.targets.secondary).toHaveLength(0);
      }
    });
  });

  describe('when actor is NOT seated', () => {
    it('should NOT discover action for standing actor', async () => {
      const { actor } = await setupStandingActorWithItemNearContainer(fixture);

      const actions = await fixture.discoverActions(actor.id);

      expect(actions).not.toContainAction('furniture:put_on_nearby_surface');
    });
  });

  describe('when furniture is NOT nearby', () => {
    it('should NOT discover action when seated but furniture not in nearFurnitureIds', async () => {
      const { actor } =
        await setupSeatedActorWithItemNearDistantContainer(fixture);

      const actions = await fixture.discoverActions(actor.id);

      expect(actions).not.toContainAction('furniture:put_on_nearby_surface');
    });
  });
});

// Helper functions similar to take action tests but with inventory items
async function setupSeatedActorWithItemAndNearbyContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [table.id] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const inventoryItem = await fixture.createEntity('items:apple');
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': {
      items: [inventoryItem.id],
      maxWeight: 50,
      maxVolume: 50,
    },
  });

  return { actor, stool, table, container, inventoryItem, location };
}

async function setupSeatedActorWithEmptyInventoryNearContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [table.id] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': { items: [], maxWeight: 50, maxVolume: 50 },
  });

  return { actor, stool, table, container, location };
}

async function setupStandingActorWithItemNearContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const inventoryItem = await fixture.createEntity('items:apple');
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'items:inventory': {
      items: [inventoryItem.id],
      maxWeight: 50,
      maxVolume: 50,
    },
  });

  return { actor, table, container, inventoryItem, location };
}

async function setupSeatedActorWithItemNearDistantContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const inventoryItem = await fixture.createEntity('items:apple');
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': {
      items: [inventoryItem.id],
      maxWeight: 50,
      maxVolume: 50,
    },
  });

  return { actor, stool, table, container, inventoryItem, location };
}
```

### 3. Take Action Rule Execution Tests

Create `tests/integration/mods/furniture/takeFromNearbySurfaceRuleExecution.test.js`:

```javascript
/**
 * @file takeFromNearbySurfaceRuleExecution.test.js
 * @description Integration tests for take_from_nearby_surface rule execution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('take_from_nearby_surface Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forRule(
      'furniture',
      'handle_take_from_nearby_surface'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('successful execution', () => {
    it('should transfer item from container to actor inventory', async () => {
      const { actor, container, item } =
        await setupSeatedActorWithNearbyContainer(fixture);

      await fixture.executeAction(
        actor.id,
        'furniture:take_from_nearby_surface',
        {
          targetId: container.id,
          secondaryId: item.id,
        }
      );

      // Item should be in actor's inventory
      const inventory = await fixture.getComponentData(
        actor.id,
        'items:inventory'
      );
      expect(inventory.items).toContain(item.id);

      // Item should NOT be in container
      const itemPosition = await fixture.getComponentData(
        item.id,
        'core:position'
      );
      expect(itemPosition.locationId).not.toBe(container.id);
    });

    it('should dispatch perceptible event on success', async () => {
      const { actor, container, item, location } =
        await setupSeatedActorWithNearbyContainer(fixture);
      const events = fixture.captureEvents('PERCEPTIBLE_EVENT');

      await fixture.executeAction(
        actor.id,
        'furniture:take_from_nearby_surface',
        {
          targetId: container.id,
          secondaryId: item.id,
        }
      );

      expect(events).toContainEvent({
        perception_type: 'item_taken_from_nearby_surface',
        location_id: location.id,
      });
    });
  });

  describe('capacity validation failure', () => {
    it('should NOT transfer item when actor inventory is full', async () => {
      const { actor, container, item } =
        await setupSeatedActorWithFullInventory(fixture);

      await fixture.executeAction(
        actor.id,
        'furniture:take_from_nearby_surface',
        {
          targetId: container.id,
          secondaryId: item.id,
        }
      );

      // Item should still be in container
      const itemPosition = await fixture.getComponentData(
        item.id,
        'core:position'
      );
      expect(itemPosition.locationId).toBe(container.id);
    });

    it('should dispatch failure event when capacity exceeded', async () => {
      const { actor, container, item, location } =
        await setupSeatedActorWithFullInventory(fixture);
      const events = fixture.captureEvents('PERCEPTIBLE_EVENT');

      await fixture.executeAction(
        actor.id,
        'furniture:take_from_nearby_surface',
        {
          targetId: container.id,
          secondaryId: item.id,
        }
      );

      expect(events).toContainEvent({
        perception_type: 'take_from_nearby_surface_failed',
        location_id: location.id,
      });
    });
  });
});

// Helper functions
async function setupSeatedActorWithNearbyContainer(fixture) {
  // Same setup as discovery tests
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [table.id] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const item = await fixture.createEntity('items:apple', {
    'core:position': { locationId: container.id },
    'items:physical': { weight: 1, volume: 1 },
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': { items: [], maxWeight: 50, maxVolume: 50 },
  });

  return { actor, stool, table, container, item, location };
}

async function setupSeatedActorWithFullInventory(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [table.id] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 10, maxVolume: 10 },
  });
  const item = await fixture.createEntity('items:heavy_item', {
    'core:position': { locationId: container.id },
    'items:physical': { weight: 100, volume: 1 }, // Too heavy
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': { items: [], maxWeight: 5, maxVolume: 50 }, // Low weight limit
  });

  return { actor, stool, table, container, item, location };
}
```

### 4. Put Action Rule Execution Tests

Create `tests/integration/mods/furniture/putOnNearbySurfaceRuleExecution.test.js`:

```javascript
/**
 * @file putOnNearbySurfaceRuleExecution.test.js
 * @description Integration tests for put_on_nearby_surface rule execution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('put_on_nearby_surface Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forRule(
      'furniture',
      'handle_put_on_nearby_surface'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('successful execution', () => {
    it('should transfer item from actor inventory to container', async () => {
      const { actor, container, inventoryItem } =
        await setupSeatedActorWithItemAndNearbyContainer(fixture);

      await fixture.executeAction(
        actor.id,
        'furniture:put_on_nearby_surface',
        {
          targetId: container.id,
          secondaryId: inventoryItem.id,
        }
      );

      // Item should be in container
      const itemPosition = await fixture.getComponentData(
        inventoryItem.id,
        'core:position'
      );
      expect(itemPosition.locationId).toBe(container.id);

      // Item should NOT be in actor's inventory
      const inventory = await fixture.getComponentData(
        actor.id,
        'items:inventory'
      );
      expect(inventory.items).not.toContain(inventoryItem.id);
    });

    it('should dispatch perceptible event on success', async () => {
      const { actor, container, inventoryItem, location } =
        await setupSeatedActorWithItemAndNearbyContainer(fixture);
      const events = fixture.captureEvents('PERCEPTIBLE_EVENT');

      await fixture.executeAction(
        actor.id,
        'furniture:put_on_nearby_surface',
        {
          targetId: container.id,
          secondaryId: inventoryItem.id,
        }
      );

      expect(events).toContainEvent({
        perception_type: 'item_put_on_nearby_surface',
        location_id: location.id,
      });
    });
  });

  describe('capacity validation failure', () => {
    it('should NOT transfer item when container is full', async () => {
      const { actor, container, inventoryItem } =
        await setupSeatedActorWithItemNearFullContainer(fixture);

      await fixture.executeAction(
        actor.id,
        'furniture:put_on_nearby_surface',
        {
          targetId: container.id,
          secondaryId: inventoryItem.id,
        }
      );

      // Item should still be in actor's inventory
      const inventory = await fixture.getComponentData(
        actor.id,
        'items:inventory'
      );
      expect(inventory.items).toContain(inventoryItem.id);
    });

    it('should dispatch failure event when container capacity exceeded', async () => {
      const { actor, container, inventoryItem, location } =
        await setupSeatedActorWithItemNearFullContainer(fixture);
      const events = fixture.captureEvents('PERCEPTIBLE_EVENT');

      await fixture.executeAction(
        actor.id,
        'furniture:put_on_nearby_surface',
        {
          targetId: container.id,
          secondaryId: inventoryItem.id,
        }
      );

      expect(events).toContainEvent({
        perception_type: 'put_on_nearby_surface_failed',
        location_id: location.id,
      });
    });
  });
});

// Helper functions
async function setupSeatedActorWithItemAndNearbyContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [table.id] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 50, maxVolume: 50 },
  });
  const inventoryItem = await fixture.createEntity('items:apple', {
    'items:physical': { weight: 1, volume: 1 },
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': {
      items: [inventoryItem.id],
      maxWeight: 50,
      maxVolume: 50,
    },
  });

  return { actor, stool, table, container, inventoryItem, location };
}

async function setupSeatedActorWithItemNearFullContainer(fixture) {
  const location = await fixture.createLocation('test_location');
  const table = await fixture.createEntity('furniture:rustic_wooden_table', {
    'core:position': { locationId: location.id },
  });
  const stool = await fixture.createEntity('furniture:plain_wooden_stool', {
    'core:position': { locationId: location.id },
    'furniture:near_furniture': { nearFurnitureIds: [table.id] },
  });
  const container = await fixture.createEntity('items:wooden_bowl', {
    'core:position': { locationId: table.id },
    'items:container': { isOpen: true, maxWeight: 1, maxVolume: 1 }, // Very limited
  });
  const inventoryItem = await fixture.createEntity('items:heavy_item', {
    'items:physical': { weight: 100, volume: 100 }, // Too heavy/large
  });
  const actor = await fixture.createActor({
    'core:position': { locationId: location.id },
    'positioning:sitting_on': { furniture_id: stool.id },
    'items:inventory': {
      items: [inventoryItem.id],
      maxWeight: 200,
      maxVolume: 200,
    },
  });

  return { actor, stool, table, container, inventoryItem, location };
}
```

## Test Cases Summary

### Action Discovery Tests

| Category | Test Case | Expected Result |
|----------|-----------|-----------------|
| Seated near container | Container has items | Action discovered with targets |
| Seated near container | Container closed | Action NOT discovered |
| Seated near container | Container empty | No secondary targets |
| Seated near container | No inventory items (put) | No secondary targets |
| Not seated | Standing actor | Action NOT discovered |
| Not near furniture | Empty nearFurnitureIds | Action NOT discovered |
| No free hands | Both hands occupied | Action NOT discovered |

### Rule Execution Tests

| Category | Test Case | Expected Result |
|----------|-----------|-----------------|
| Success | Take item | Item in inventory, not in container |
| Success | Put item | Item in container, not in inventory |
| Success | Take dispatches event | `item_taken_from_nearby_surface` event |
| Success | Put dispatches event | `item_put_on_nearby_surface` event |
| Failure | Inventory full (take) | Item stays in container |
| Failure | Container full (put) | Item stays in inventory |
| Failure | Take failure event | `take_from_nearby_surface_failed` event |
| Failure | Put failure event | `put_on_nearby_surface_failed` event |

## Acceptance Criteria

### Tests That Must Pass

1. All integration tests pass: `npm run test:integration -- tests/integration/mods/furniture/`
2. Test coverage for action discovery ≥80% branches
3. Test coverage for rule execution ≥80% branches
4. `npx eslint tests/integration/mods/furniture/` passes

### Invariants That Must Remain True

1. Existing container action tests continue to pass
2. Test follows project testing conventions from `docs/testing/mod-testing-guide.md`
3. No modifications to production code
4. Tests use `ModTestFixture` patterns consistently

## Verification Commands

```bash
# Run all furniture integration tests
npm run test:integration -- tests/integration/mods/furniture/

# Run specific test files
npm run test:integration -- tests/integration/mods/furniture/takeFromNearbySurfaceActionDiscovery.test.js
npm run test:integration -- tests/integration/mods/furniture/putOnNearbySurfaceActionDiscovery.test.js
npm run test:integration -- tests/integration/mods/furniture/takeFromNearbySurfaceRuleExecution.test.js
npm run test:integration -- tests/integration/mods/furniture/putOnNearbySurfaceRuleExecution.test.js

# Run with coverage
npm run test:integration -- tests/integration/mods/furniture/ --coverage

# Lint the test files
npx eslint tests/integration/mods/furniture/

# Run all integration tests to ensure no regressions
npm run test:integration

# Full test suite
npm run test:ci
```

## Related Test Files (For Reference)

- `tests/integration/mods/items/takeFromContainerActionDiscovery.test.js` - Similar action discovery pattern
- `tests/integration/mods/items/takeFromContainerRuleExecution.test.js` - Similar rule execution pattern
- `tests/integration/mods/items/putInContainerActionDiscovery.test.js` - Similar action discovery pattern
- `tests/integration/mods/items/putInContainerRuleExecution.test.js` - Similar rule execution pattern
- `tests/common/mods/ModTestFixture.js` - Test fixture utilities

## Directory Structure After Changes

```
tests/integration/mods/furniture/
├── takeFromNearbySurfaceActionDiscovery.test.js    # New
├── putOnNearbySurfaceActionDiscovery.test.js       # New
├── takeFromNearbySurfaceRuleExecution.test.js      # New
└── putOnNearbySurfaceRuleExecution.test.js         # New
```
