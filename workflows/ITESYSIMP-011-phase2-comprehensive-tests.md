# ITESYSIMP-011: Phase 2 Comprehensive Test Suite

**Phase:** 2 - Inventory Management
**Priority:** High
**Estimated Effort:** 2 hours

## Goal

Create comprehensive test coverage for Phase 2 inventory management actions (drop and pick up).

## Context

Validate that drop_item and pick_up_item work correctly in isolation and together, including edge cases and integration with existing Phase 1 functionality.

## Tasks

### 1. Drop Item Tests

Already partially covered in ITESYSIMP-009. Add additional tests for:

#### Edge Cases
```javascript
describe('Drop Item - Edge Cases', () => {
  it('should handle dropping last item from inventory', () => {
    const actor = testBed.createActorWithInventory(['item-1']);
    testBed.executeAction('items:drop_item', { actorId: actor, targetId: 'item-1' });

    const inventory = testBed.getComponent(actor, 'items:inventory');
    expect(inventory.items).toEqual([]);
  });

  it('should fail gracefully when item already dropped', () => {
    const actor = testBed.createActorWithInventory(['item-1']);
    testBed.executeAction('items:drop_item', { actorId: actor, targetId: 'item-1' });

    const result = testBed.executeAction('items:drop_item', { actorId: actor, targetId: 'item-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('item_not_in_inventory');
  });

  it('should create position component with correct locationId', () => {
    const actor = testBed.createActorWithInventory(['item-1']);
    testBed.setActorPosition(actor, 'saloon');

    testBed.executeAction('items:drop_item', { actorId: actor, targetId: 'item-1' });

    const itemPosition = testBed.getComponent('item-1', 'positioning:position');
    expect(itemPosition.locationId).toBe('saloon');
  });
});
```

### 2. Pick Up Item Tests

#### Integration Tests
```javascript
describe('Pick Up Item - Integration', () => {
  it('should discover items at actor location', () => {
    const actor = testBed.createActor('saloon');
    const item = testBed.createItemAtLocation('letter-1', 'saloon');

    const actions = testBed.discoverActions(actor);
    const pickupActions = actions.filter(a => a.actionId === 'items:pick_up_item');

    expect(pickupActions).toHaveLength(1);
    expect(pickupActions[0].targetId).toBe('letter-1');
  });

  it('should not discover items at other locations', () => {
    const actor = testBed.createActor('saloon');
    const item = testBed.createItemAtLocation('letter-1', 'street');

    const actions = testBed.discoverActions(actor);
    const pickupActions = actions.filter(a => a.actionId === 'items:pick_up_item');

    expect(pickupActions).toHaveLength(0);
  });

  it('should remove position component after pickup', () => {
    const actor = testBed.createActorWithInventory([]);
    const item = testBed.createItemAtLocation('letter-1', 'saloon');
    testBed.setActorPosition(actor, 'saloon');

    testBed.executeAction('items:pick_up_item', { actorId: actor, targetId: 'letter-1' });

    const hasPosition = testBed.hasComponent('letter-1', 'positioning:position');
    expect(hasPosition).toBe(false);
  });

  it('should respect capacity limits', () => {
    const actor = testBed.createActorWithInventory([], { maxWeight: 1, maxItems: 10 });
    const heavyItem = testBed.createItemAtLocation('gold-bar-1', 'saloon');
    testBed.setActorPosition(actor, 'saloon');

    const result = testBed.executeAction('items:pick_up_item', {
      actorId: actor,
      targetId: 'gold-bar-1'
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_weight_exceeded');
  });
});
```

### 3. Drop and Pick Up Workflow

Create `tests/integration/mods/items/dropPickupWorkflow.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Drop and Pick Up Workflow', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should complete full drop and pickup cycle', () => {
    const actor1 = testBed.createActorWithInventory(['letter-1']);
    const actor2 = testBed.createActorWithInventory([]);
    testBed.setActorsAtLocation([actor1, actor2], 'saloon');

    // Actor 1 drops item
    testBed.executeAction('items:drop_item', { actorId: actor1, targetId: 'letter-1' });

    const actor1Inv = testBed.getComponent(actor1, 'items:inventory');
    expect(actor1Inv.items).not.toContain('letter-1');

    // Item should be at location
    const itemPosition = testBed.getComponent('letter-1', 'positioning:position');
    expect(itemPosition.locationId).toBe('saloon');

    // Actor 2 picks up item
    testBed.executeAction('items:pick_up_item', { actorId: actor2, targetId: 'letter-1' });

    const actor2Inv = testBed.getComponent(actor2, 'items:inventory');
    expect(actor2Inv.items).toContain('letter-1');

    // Item should no longer have position
    const hasPosition = testBed.hasComponent('letter-1', 'positioning:position');
    expect(hasPosition).toBe(false);
  });

  it('should handle multiple items dropped at same location', () => {
    const actor = testBed.createActorWithInventory(['letter-1', 'gun-1', 'key-1']);
    testBed.setActorPosition(actor, 'saloon');

    testBed.executeAction('items:drop_item', { actorId: actor, targetId: 'letter-1' });
    testBed.executeAction('items:drop_item', { actorId: actor, targetId: 'gun-1' });

    const itemsAtLocation = testBed.evaluateScope('items:items_at_location', { actor });
    expect(itemsAtLocation).toHaveLength(2);
    expect(itemsAtLocation).toContain('letter-1');
    expect(itemsAtLocation).toContain('gun-1');
  });

  it('should create perception logs for both drop and pickup', () => {
    const actor = testBed.createActorWithInventory(['letter-1']);
    testBed.setActorPosition(actor, 'saloon');

    testBed.executeAction('items:drop_item', { actorId: actor, targetId: 'letter-1' });
    testBed.executeAction('items:pick_up_item', { actorId: actor, targetId: 'letter-1' });

    const logs = testBed.getPerceptionLogs('saloon');
    expect(logs).toContainEqual(
      expect.objectContaining({ perceptionType: 'item_dropped' })
    );
    expect(logs).toContainEqual(
      expect.objectContaining({ perceptionType: 'item_picked_up' })
    );
  });
});
```

### 4. Integration with Phase 1

Create `tests/integration/mods/items/phase1And2Integration.test.js`:

```javascript
describe('Items - Phase 1 and 2 Integration', () => {
  it('should support give, drop, and pickup in sequence', () => {
    const actor1 = testBed.createActorWithInventory(['letter-1']);
    const actor2 = testBed.createActorWithInventory([]);
    testBed.setActorsNearby(actor1, actor2);

    // Give item
    testBed.executeAction('items:give_item', {
      actorId: actor1,
      targetId: actor2,
      secondaryTargetId: 'letter-1'
    });

    expect(testBed.actorHasItem(actor2, 'letter-1')).toBe(true);

    // Drop item
    testBed.executeAction('items:drop_item', { actorId: actor2, targetId: 'letter-1' });

    expect(testBed.itemAtLocation('letter-1', actor2.location)).toBe(true);

    // Pick up item
    testBed.executeAction('items:pick_up_item', { actorId: actor1, targetId: 'letter-1' });

    expect(testBed.actorHasItem(actor1, 'letter-1')).toBe(true);
  });

  it('should discover all action types simultaneously', () => {
    const actor = testBed.createActorWithInventory(['item-1']);
    const recipient = testBed.createActorNearby(actor);
    const groundItem = testBed.createItemAtLocation('item-2', actor.location);

    const actions = testBed.discoverActions(actor);

    const giveActions = actions.filter(a => a.actionId === 'items:give_item');
    const dropActions = actions.filter(a => a.actionId === 'items:drop_item');
    const pickupActions = actions.filter(a => a.actionId === 'items:pick_up_item');

    expect(giveActions.length).toBeGreaterThan(0);
    expect(dropActions.length).toBeGreaterThan(0);
    expect(pickupActions.length).toBeGreaterThan(0);
  });
});
```

### 5. Performance Tests

Create `tests/performance/items/inventoryOperations.performance.test.js`:

```javascript
describe('Items - Performance', () => {
  it('should handle large inventories efficiently', () => {
    const largeInventory = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    const actor = testBed.createActorWithInventory(largeInventory);

    const startTime = performance.now();
    const actions = testBed.discoverActions(actor);
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(500); // 500ms max for 100 items
  });

  it('should handle many items at location efficiently', () => {
    const actor = testBed.createActor('saloon');
    for (let i = 0; i < 50; i++) {
      testBed.createItemAtLocation(`item-${i}`, 'saloon');
    }

    const startTime = performance.now();
    const actions = testBed.discoverActions(actor);
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(300); // 300ms max for 50 items
  });
});
```

## Validation

- [ ] All drop item edge cases covered
- [ ] Pick up item integration tests pass
- [ ] Drop and pickup workflow validated
- [ ] Phase 1 and 2 integration verified
- [ ] Performance tests pass with acceptable thresholds
- [ ] All perception logging verified
- [ ] Test coverage >80% for Phase 2 code
- [ ] All tests pass

## Dependencies

- ITESYSIMP-009: Drop item implementation complete
- ITESYSIMP-010: Pick up item implementation complete
- ITESYSIMP-008: Phase 1 tests complete (for integration)

## Next Steps

Phase 2 is complete. Proceed to Phase 3:
- ITESYSIMP-012: Implement container component
- ITESYSIMP-013: Implement open_container action
