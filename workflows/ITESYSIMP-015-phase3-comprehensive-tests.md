# ITESYSIMP-015: Phase 3 Comprehensive Test Suite

**Phase:** 3 - Container System
**Priority:** High
**Estimated Effort:** 2 hours

## Goal

Create comprehensive test coverage for Phase 3 container system functionality.

## Context

Validate complete container workflows including opening locked/unlocked containers and item retrieval with proper state management.

## Tasks

### 1. Container Component Tests

Already covered in ITESYSIMP-012. Ensure:
- [ ] Container data validation
- [ ] Key requirements
- [ ] Open/closed state
- [ ] Contents management

### 2. Open Container Integration Tests

Create `tests/integration/mods/items/open_container.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Open Container Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should open unlocked container successfully', () => {
    const actor = testBed.createActor('tavern');
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: ['coin-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: false,
        requiresKey: false
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.executeAction('items:open_container', {
      actorId: actor,
      targetId: chest
    });

    const container = testBed.getComponent(chest, 'items:container');
    expect(container.isOpen).toBe(true);
  });

  it('should fail to open locked container without key', () => {
    const actor = testBed.createActorWithInventory([]);
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: ['coin-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: false,
        requiresKey: true,
        keyItemId: 'brass-key-1'
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.setActorPosition(actor, 'tavern');

    const result = testBed.executeAction('items:open_container', {
      actorId: actor,
      targetId: chest
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('missing_key');

    const container = testBed.getComponent(chest, 'items:container');
    expect(container.isOpen).toBe(false);
  });

  it('should open locked container with correct key', () => {
    const actor = testBed.createActorWithInventory(['brass-key-1']);
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: ['coin-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: false,
        requiresKey: true,
        keyItemId: 'brass-key-1'
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.setActorPosition(actor, 'tavern');

    testBed.executeAction('items:open_container', {
      actorId: actor,
      targetId: chest
    });

    const container = testBed.getComponent(chest, 'items:container');
    expect(container.isOpen).toBe(true);
  });

  it('should handle already-open container gracefully', () => {
    const actor = testBed.createActor('tavern');
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: [],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: true,
        requiresKey: false
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    const result = testBed.executeAction('items:open_container', {
      actorId: actor,
      targetId: chest
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('already_open');
  });
});
```

### 3. Take From Container Integration Tests

Create `tests/integration/mods/items/take_from_container.test.js`:

```javascript
describe('Items - Take From Container Integration', () => {
  it('should take item from open container', () => {
    const actor = testBed.createActorWithInventory([]);
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: ['coin-1', 'coin-2'],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: true
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.setActorPosition(actor, 'tavern');

    testBed.executeAction('items:take_from_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });

    const inventory = testBed.getComponent(actor, 'items:inventory');
    expect(inventory.items).toContain('coin-1');

    const container = testBed.getComponent(chest, 'items:container');
    expect(container.contents).not.toContain('coin-1');
    expect(container.contents).toContain('coin-2'); // Other items remain
  });

  it('should fail to take from closed container', () => {
    const actor = testBed.createActorWithInventory([]);
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: ['coin-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: false
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.setActorPosition(actor, 'tavern');

    const result = testBed.executeAction('items:take_from_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('container_closed');
  });

  it('should respect inventory capacity when taking from container', () => {
    const actor = testBed.createActorWithInventory([], {
      maxWeight: 1,
      maxItems: 10
    });
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: ['gold-bar-1'], // Heavy item
        capacity: { maxWeight: 100, maxItems: 20 },
        isOpen: true
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.setActorPosition(actor, 'tavern');

    const result = testBed.executeAction('items:take_from_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'gold-bar-1'
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_weight_exceeded');
  });
});
```

### 4. Container Workflow Tests

Create `tests/integration/mods/items/containerWorkflow.test.js`:

```javascript
describe('Items - Complete Container Workflow', () => {
  it('should complete unlock → open → take workflow', () => {
    const actor = testBed.createActorWithInventory(['brass-key-1']);
    const chest = testBed.createEntity('chest-1', {
      'items:container': {
        contents: ['treasure-1'],
        capacity: { maxWeight: 50, maxItems: 10 },
        isOpen: false,
        requiresKey: true,
        keyItemId: 'brass-key-1'
      },
      'items:openable': {},
      'positioning:position': { locationId: 'tavern' }
    });

    testBed.setActorPosition(actor, 'tavern');

    // Open with key
    testBed.executeAction('items:open_container', {
      actorId: actor,
      targetId: chest
    });

    expect(testBed.getComponent(chest, 'items:container').isOpen).toBe(true);

    // Take item
    testBed.executeAction('items:take_from_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'treasure-1'
    });

    expect(testBed.actorHasItem(actor, 'treasure-1')).toBe(true);
    expect(testBed.getComponent(chest, 'items:container').contents).toEqual([]);
  });

  it('should create perception logs for entire workflow', () => {
    const actor = testBed.createActorWithInventory(['brass-key-1']);
    const chest = testBed.createLockedChest('tavern', ['coin-1'], 'brass-key-1');

    testBed.setActorPosition(actor, 'tavern');

    testBed.executeAction('items:open_container', {
      actorId: actor,
      targetId: chest
    });

    testBed.executeAction('items:take_from_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'coin-1'
    });

    const logs = testBed.getPerceptionLogs('tavern');
    expect(logs).toContainEqual(
      expect.objectContaining({ perceptionType: 'container_opened' })
    );
    expect(logs).toContainEqual(
      expect.objectContaining({ perceptionType: 'item_taken_from_container' })
    );
  });

  it('should discover take action only for open containers', () => {
    const actor = testBed.createActor('tavern');
    const openChest = testBed.createOpenChest('tavern', ['coin-1']);
    const closedChest = testBed.createClosedChest('tavern', ['coin-2']);

    const actions = testBed.discoverActions(actor);
    const takeActions = actions.filter(a => a.actionId === 'items:take_from_container');

    // Should only discover take action for open chest
    const openChestTakes = takeActions.filter(a => a.targetId === openChest);
    const closedChestTakes = takeActions.filter(a => a.targetId === closedChest);

    expect(openChestTakes.length).toBeGreaterThan(0);
    expect(closedChestTakes).toEqual([]);
  });
});
```

### 5. Integration with Previous Phases

Create `tests/integration/mods/items/fullSystemIntegration.test.js`:

```javascript
describe('Items - Full System Integration', () => {
  it('should support complete item lifecycle', () => {
    const actor = testBed.createActorWithInventory(['brass-key-1']);
    const chest = testBed.createLockedChest('tavern', ['letter-1'], 'brass-key-1');
    const recipient = testBed.createActorNearby(actor);

    testBed.setActorPosition(actor, 'tavern');

    // 1. Open container
    testBed.executeAction('items:open_container', {
      actorId: actor,
      targetId: chest
    });

    // 2. Take from container
    testBed.executeAction('items:take_from_container', {
      actorId: actor,
      targetId: chest,
      secondaryTargetId: 'letter-1'
    });

    // 3. Give to another actor (Phase 1)
    testBed.executeAction('items:give_item', {
      actorId: actor,
      targetId: recipient,
      secondaryTargetId: 'letter-1'
    });

    // 4. Drop on ground (Phase 2)
    testBed.executeAction('items:drop_item', {
      actorId: recipient,
      targetId: 'letter-1'
    });

    // 5. Pick back up (Phase 2)
    testBed.executeAction('items:pick_up_item', {
      actorId: actor,
      targetId: 'letter-1'
    });

    expect(testBed.actorHasItem(actor, 'letter-1')).toBe(true);
  });
});
```

## Validation

- [ ] Open container tests cover locked/unlocked scenarios
- [ ] Key validation works correctly
- [ ] Take from container tests cover all edge cases
- [ ] Closed container prevents taking
- [ ] Capacity validation works
- [ ] Complete workflow validated
- [ ] Perception logging verified throughout
- [ ] Action discovery respects container state (open/closed)
- [ ] Integration with Phase 1 and 2 verified
- [ ] Test coverage >80% for Phase 3 code
- [ ] All tests pass

## Dependencies

- ITESYSIMP-012: Container component
- ITESYSIMP-013: Open container action
- ITESYSIMP-014: Take from container action

## Next Steps

Phase 3 is complete. Proceed to Phase 4:
- ITESYSIMP-016: Implement examine_item action
- ITESYSIMP-017: Implement put_in_container action
