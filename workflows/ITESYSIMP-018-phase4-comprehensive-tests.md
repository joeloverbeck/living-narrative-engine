# ITESYSIMP-018: Phase 4 Comprehensive Test Suite

**Phase:** 4 - Advanced Features
**Priority:** High
**Estimated Effort:** 2 hours

## Goal

Create comprehensive test coverage for Phase 4 advanced features (examine and put in container).

## Context

Validate advanced item interactions including examination and bidirectional container operations.

## Tasks

### 1. Examine Item Tests

Create `tests/integration/mods/items/examine_item.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Examine Item Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should examine item in inventory', () => {
    const actor = testBed.createActorWithInventory(['letter-to-sheriff-1']);

    const result = testBed.executeAction('items:examine_item', {
      actorId: actor,
      targetId: 'letter-to-sheriff-1'
    });

    expect(result.success).toBe(true);
    expect(result.fullDescription).toBeDefined();
    expect(result.fullDescription.length).toBeGreaterThan(0);
  });

  it('should examine item at location', () => {
    const actor = testBed.createActor('tavern');
    const item = testBed.createItemAtLocation('letter-1', 'tavern');

    const result = testBed.executeAction('items:examine_item', {
      actorId: actor,
      targetId: 'letter-1'
    });

    expect(result.success).toBe(true);
    expect(result.fullDescription).toBeDefined();
  });

  it('should discover items from both inventory and location', () => {
    const actor = testBed.createActorWithInventory(['item-1']);
    testBed.setActorPosition(actor, 'tavern');
    testBed.createItemAtLocation('item-2', 'tavern');

    const actions = testBed.discoverActions(actor);
    const examineActions = actions.filter(a => a.actionId === 'items:examine_item');

    const targetIds = examineActions.map(a => a.targetId);
    expect(targetIds).toContain('item-1'); // From inventory
    expect(targetIds).toContain('item-2'); // From location
  });

  it('should create perception log with full description', () => {
    const actor = testBed.createActorWithInventory(['letter-to-sheriff-1']);
    testBed.setActorPosition(actor, 'tavern');

    testBed.executeAction('items:examine_item', {
      actorId: actor,
      targetId: 'letter-to-sheriff-1'
    });

    const logs = testBed.getPerceptionLogs('tavern');
    const examineLog = logs.find(l => l.perceptionType === 'item_examined');

    expect(examineLog).toBeDefined();
    expect(examineLog.fullDescription).toBeDefined();
    expect(examineLog.descriptionText).toContain('examines');
  });

  it('should NOT end turn (examine is free action)', () => {
    const actor = testBed.createActorWithInventory(['letter-1']);

    testBed.executeAction('items:examine_item', {
      actorId: actor,
      targetId: 'letter-1'
    });

    const turnEnded = testBed.hasEventBeenDispatched('END_TURN');
    expect(turnEnded).toBe(false);
  });

  it('should handle missing description gracefully', () => {
    const actor = testBed.createActorWithInventory(['no-desc-item']);

    const result = testBed.executeAction('items:examine_item', {
      actorId: actor,
      targetId: 'no-desc-item'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('no_description');
  });
});
```

### 2. Put In Container Tests

Create `tests/integration/mods/items/put_in_container.test.js`:

```javascript
describe('Items - Put In Container Integration', () => {
  it('should put item from inventory into open container', () => {
    const actor = testBed.createActorWithInventory(['coin-1']);
    const chest = testBed.createOpenChest('tavern', []);

    testBed.setActorPosition(actor, 'tavern');

    testBed.executeAction('items:put_in_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });

    const inventory = testBed.getComponent(actor, 'items:inventory');
    const container = testBed.getComponent(chest, 'items:container');

    expect(inventory.items).not.toContain('coin-1');
    expect(container.contents).toContain('coin-1');
  });

  it('should fail to put in closed container', () => {
    const actor = testBed.createActorWithInventory(['coin-1']);
    const chest = testBed.createClosedChest('tavern', []);

    testBed.setActorPosition(actor, 'tavern');

    const result = testBed.executeAction('items:put_in_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('container_closed');
  });

  it('should respect container capacity limits', () => {
    const actor = testBed.createActorWithInventory(['gold-bar-1']);
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: [],
        capacity: { maxWeight: 1, maxItems: 10 },
        isOpen: true
      },
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.setActorPosition(actor, 'tavern');

    const result = testBed.executeAction('items:put_in_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'gold-bar-1'
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_weight_exceeded');
  });

  it('should discover only open containers for put action', () => {
    const actor = testBed.createActorWithInventory(['coin-1']);
    const openChest = testBed.createOpenChest('tavern', []);
    const closedChest = testBed.createClosedChest('tavern', []);

    testBed.setActorPosition(actor, 'tavern');

    const actions = testBed.discoverActions(actor);
    const putActions = actions.filter(a => a.actionId === 'items:put_in_container');

    const targets = putActions.map(a => a.targetId);
    expect(targets).toContain(openChest);
    expect(targets).not.toContain(closedChest);
  });
});
```

### 3. Bidirectional Container Operations

Create `tests/integration/mods/items/containerBidirectional.test.js`:

```javascript
describe('Items - Bidirectional Container Operations', () => {
  it('should support take and put cycle', () => {
    const actor = testBed.createActorWithInventory([]);
    const chest = testBed.createOpenChest('tavern', ['coin-1']);

    testBed.setActorPosition(actor, 'tavern');

    // Take from container
    testBed.executeAction('items:take_from_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });

    expect(testBed.actorHasItem(actor, 'coin-1')).toBe(true);

    // Put back in container
    testBed.executeAction('items:put_in_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });

    const container = testBed.getComponent(chest, 'items:container');
    expect(container.contents).toContain('coin-1');
    expect(testBed.actorHasItem(actor, 'coin-1')).toBe(false);
  });

  it('should handle multiple items in container operations', () => {
    const actor = testBed.createActorWithInventory(['coin-1', 'coin-2', 'coin-3']);
    const chest = testBed.createOpenChest('tavern', []);

    testBed.setActorPosition(actor, 'tavern');

    // Put multiple items
    testBed.executeAction('items:put_in_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });
    testBed.executeAction('items:put_in_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-2'
    });

    const container = testBed.getComponent(chest, 'items:container');
    expect(container.contents).toHaveLength(2);
    expect(container.contents).toContain('coin-1');
    expect(container.contents).toContain('coin-2');
  });
});
```

### 4. Full System Integration

Create `tests/e2e/items/completeItemsWorkflow.e2e.test.js`:

```javascript
describe('Items - Complete System E2E', () => {
  it('should support all item operations in realistic scenario', async () => {
    // Setup: Player has key, chest is locked with treasure
    const player = testBed.createPlayer({
      inventory: ['brass-key-1'],
      location: 'tavern-cellar'
    });

    const chest = testBed.createLockedChest('tavern-cellar', ['treasure-1'], 'brass-key-1');

    // 1. Open chest with key
    await testBed.performAction('items:open_container', {
      actorId: player,
      targetId: chest
    });

    // 2. Examine treasure
    const examineResult = await testBed.performAction('items:examine_item', {
      actorId: player,
      targetId: 'treasure-1'
    });
    expect(examineResult.fullDescription).toBeDefined();

    // 3. Take treasure
    await testBed.performAction('items:take_from_container', {
      actorId: player,
      targetId: chest,
      secondaryTargetId: 'treasure-1'
    });

    // 4. Drop key (no longer needed)
    await testBed.performAction('items:drop_item', {
      actorId: player,
      targetId: 'brass-key-1'
    });

    // 5. Put treasure back (changed mind)
    await testBed.performAction('items:put_in_container', {
      actorId: player,
      targetId: chest,
      secondaryTargetId: 'treasure-1'
    });

    // 6. Pick up key again
    await testBed.performAction('items:pick_up_item', {
      actorId: player,
      targetId: 'brass-key-1'
    });

    // Verify final state
    expect(testBed.actorHasItem(player, 'brass-key-1')).toBe(true);
    expect(testBed.getComponent(chest, 'items:container').contents).toContain('treasure-1');

    // Verify narrative log
    const narrative = testBed.getNarrativeLog();
    expect(narrative).toContain('opened');
    expect(narrative).toContain('examines');
    expect(narrative).toContain('took');
    expect(narrative).toContain('dropped');
    expect(narrative).toContain('Put');
    expect(narrative).toContain('picked up');
  });
});
```

## Validation

- [ ] Examine tests cover inventory and location items
- [ ] Examine scope union works correctly
- [ ] Examine does not end turn
- [ ] Put in container tests cover all scenarios
- [ ] Container capacity validation works for put operations
- [ ] Closed containers prevent putting
- [ ] Bidirectional operations validated
- [ ] Full E2E workflow demonstrates all features
- [ ] Perception logging verified for all actions
- [ ] Test coverage >80% for Phase 4 code
- [ ] All tests pass

## Dependencies

- ITESYSIMP-016: Examine item implementation
- ITESYSIMP-017: Put in container implementation

## Next Steps

After completion, proceed to:
- ITESYSIMP-019: Final integration and documentation
