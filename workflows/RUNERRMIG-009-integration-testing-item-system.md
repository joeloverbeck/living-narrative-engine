# RUNERRMIG-009: Integration Testing - Item System

**Priority**: 🟡 P1 (High)
**Complexity**: ⭐⭐⭐ Medium
**Sprint**: 2 (Schema Improvements)
**Estimate**: 1 hour

## Context

After fixing all schema validation errors and implementing the required operation schemas, comprehensive integration tests are needed to ensure the item system works correctly end-to-end.

## Problem Statement

The item system includes drop, pick-up, give, and inventory validation operations. While unit tests may exist for individual handlers, integration tests are needed to verify the complete workflows function correctly in realistic scenarios.

## Objectives

1. **Verify Complete Workflows**: Test entire action sequences from discovery to execution
2. **Validate State Changes**: Ensure inventory and location state updates correctly
3. **Test Edge Cases**: Full inventory, invalid items, missing components
4. **Perception System**: Verify perception events are dispatched properly
5. **Error Handling**: Confirm graceful handling of failure scenarios

## Implementation Steps

### Step 1: Create Test File Structure (10 minutes)

Create: `tests/integration/mods/items/itemSystemWorkflows.integration.test.js`

Follow the existing mod integration test conventions by using the shared `ModTestFixture`
utilities instead of the low-level `createTestBed()` helper. The fixtures already know how to
wire up the item operation handlers (`DROP_ITEM_AT_LOCATION`, `PICK_UP_ITEM_FROM_LOCATION`,
`TRANSFER_ITEM`, `VALIDATE_INVENTORY_CAPACITY`) with an instrumented entity manager and event
bus.

Basic structure:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

describe('Item System - Integration Workflows', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:drop_item');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  // Helper functions and test suites go here
});
```

Create helper builders (mirroring the existing rule execution tests in the folder) for actors and
items using `ModEntityBuilder`. Inventory data should use the production schema shape:

```javascript
function buildActor(actorId, locationId, itemIds = []) {
  return new ModEntityBuilder(actorId)
    .withName('Test Actor')
    .atLocation(locationId)
    .asActor()
    .withComponent('items:inventory', {
      items: itemIds,
      capacity: { maxWeight: 50, maxItems: 10 }
    })
    .build();
}

function buildPortableItem(itemId, weight, locationId = null) {
  const builder = new ModEntityBuilder(itemId)
    .withName(itemId)
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('items:weight', { weight });

  return locationId ? builder.atLocation(locationId).build() : builder.build();
}
```

Create separate `ModTestFixture.forAction` instances inside each workflow-specific `describe`
block (drop, pick up, give) so that each suite runs against the correct rule file without mixing
state between actions.

### Step 2: Drop Item Workflow Tests (15 minutes)

```javascript
describe('Drop Item Workflow', () => {
  /** @type {import('../../../common/mods/ModTestFixture.js').ModActionTestFixture} */
  let dropFixture;

  beforeEach(async () => {
    dropFixture = await ModTestFixture.forAction('items', 'items:drop_item');
  });

  afterEach(() => {
    dropFixture.cleanup();
  });

  it('should successfully drop an inventory item at the actor\'s location', async () => {
    const locationId = 'test-location';
    const room = new ModEntityBuilder(locationId).asRoom('Test Location').build();
    const item = buildPortableItem('item-1', 5);
    const actor = new ModEntityBuilder('actor-1')
      .withName('Alice')
      .atLocation(locationId)
      .asActor()
      .withComponent('items:inventory', {
        items: ['item-1'],
        capacity: { maxWeight: 100, maxItems: 10 }
      })
      .build();

    dropFixture.reset([room, actor, item]);

    await dropFixture.executeAction('actor-1', 'item-1');

    const updatedActor = dropFixture.entityManager.getEntityInstance('actor-1');
    expect(updatedActor.components['items:inventory'].items).not.toContain('item-1');

    const droppedItem = dropFixture.entityManager.getEntityInstance('item-1');
    expect(droppedItem.components['core:position']).toBeDefined();
    expect(droppedItem.components['core:position'].locationId).toBe(locationId);

    const perceptibleEvent = dropFixture.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent?.payload.perceptionType).toBe('item_dropped');
  });

  it('should dispatch perception events when dropping item', async () => {
    // Verify the descriptionText, actorId, involvedEntities, and locationId fields
    // on the emitted core:perceptible_event payload match the drop scenario.
  });

  it('should handle invalid item gracefully', async () => {
    const locationId = 'test-location';
    const room = new ModEntityBuilder(locationId).asRoom('Test Location').build();
    const actor = buildActor('actor-1', locationId, []);
    dropFixture.reset([room, actor]);

    await dropFixture.executeAction('actor-1', 'missing-item');

    const turnEnded = dropFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEnded).toBeDefined();
    expect(turnEnded.payload.success).toBe(false);
  });
});
```

### Step 3: Pick-Up Item Workflow Tests (15 minutes)

```javascript
describe('Pick-Up Item Workflow', () => {
  let pickupFixture;

  beforeEach(async () => {
    pickupFixture = await ModTestFixture.forAction('items', 'items:pick_up_item');
  });

  afterEach(() => {
    pickupFixture.cleanup();
  });

  it('should move an item from the room into the actor inventory', async () => {
    const locationId = 'test-location';
    const room = new ModEntityBuilder(locationId).asRoom('Test Location').build();
    const item = buildPortableItem('item-1', 5, locationId);
    const actor = buildActor('actor-1', locationId, []);

    pickupFixture.reset([room, actor, item]);

    await pickupFixture.executeAction('actor-1', 'item-1');

    const updatedActor = pickupFixture.entityManager.getEntityInstance('actor-1');
    expect(updatedActor.components['items:inventory'].items).toContain('item-1');

    const itemInstance = pickupFixture.entityManager.getEntityInstance('item-1');
    expect(itemInstance.components['core:position']).toBeUndefined();
  });

  it('should prevent pickup when inventory is at weight capacity', async () => {
    const locationId = 'mine';
    const room = new ModEntityBuilder(locationId).asRoom('Mine').build();
    const heavyItem = buildPortableItem('heavy-rock', 60, locationId);
    const actor = new ModEntityBuilder('actor-1')
      .withName('Miner')
      .atLocation(locationId)
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 50, maxItems: 10 }
      })
      .build();

    pickupFixture.reset([room, actor, heavyItem]);

    await pickupFixture.executeAction('actor-1', 'heavy-rock');

    const updatedActor = pickupFixture.entityManager.getEntityInstance('actor-1');
    expect(updatedActor.components['items:inventory'].items).not.toContain('heavy-rock');

    const itemInstance = pickupFixture.entityManager.getEntityInstance('heavy-rock');
    expect(itemInstance.components['core:position'].locationId).toBe(locationId);

    const failedTurn = pickupFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(failedTurn?.payload.success).toBe(false);

    const uiFailure = pickupFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    );
    expect(uiFailure?.payload.message).toContain('max_weight_exceeded');
  });

  it('should prevent pickup when inventory item count is maxed out', async () => {
    const locationId = 'warehouse';
    const room = new ModEntityBuilder(locationId).asRoom('Warehouse').build();
    const extraItem = buildPortableItem('extra-item', 1, locationId);
    const existingItems = Array.from({ length: 10 }, (_, index) => `item-${index}`);
    const actor = new ModEntityBuilder('actor-1')
      .withName('Collector')
      .atLocation(locationId)
      .asActor()
      .withComponent('items:inventory', {
        items: existingItems,
        capacity: { maxWeight: 50, maxItems: 10 }
      })
      .build();

    pickupFixture.reset([room, actor, extraItem]);

    await pickupFixture.executeAction('actor-1', 'extra-item');

    const updatedActor = pickupFixture.entityManager.getEntityInstance('actor-1');
    expect(updatedActor.components['items:inventory'].items).not.toContain('extra-item');
    expect(updatedActor.components['items:inventory'].items).toHaveLength(10);
  });

  it('should dispatch perception events when picking up item', async () => {
    const locationId = 'test-location';
    const room = new ModEntityBuilder(locationId).asRoom('Test Location').build();
    const item = buildPortableItem('item-1', 5, locationId);
    const actor = buildActor('actor-1', locationId, []);

    pickupFixture.reset([room, actor, item]);

    await pickupFixture.executeAction('actor-1', 'item-1');

    const perceptibleEvents = pickupFixture.events.filter(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents.some((event) => event.payload.perceptionType === 'item_picked_up')).toBe(true);
  });
});
```

### Step 4: Give Item Workflow Tests (15 minutes)

```javascript
describe('Give Item Workflow', () => {
  let giveFixture;

  beforeEach(async () => {
    giveFixture = await ModTestFixture.forAction('items', 'items:give_item');
  });

  afterEach(() => {
    giveFixture.cleanup();
  });

  it('should transfer an item from the giver to the receiver', async () => {
    const locationId = 'camp';
    const room = new ModEntityBuilder(locationId).asRoom('Camp').build();
    const item = buildPortableItem('item-1', 2);
    const giver = buildActor('giver-1', locationId, ['item-1']);
    const receiver = buildActor('receiver-1', locationId, []);

    giveFixture.reset([room, giver, receiver, item]);

    await giveFixture.executeAction('giver-1', 'receiver-1', {
      additionalPayload: { secondaryTargetId: 'item-1' }
    });

    const giverInventory = giveFixture.entityManager.getEntityInstance('giver-1').components['items:inventory'];
    expect(giverInventory.items).not.toContain('item-1');

    const receiverInventory = giveFixture.entityManager.getEntityInstance('receiver-1').components['items:inventory'];
    expect(receiverInventory.items).toContain('item-1');
  });

  it('should prevent giving when receiver inventory is full', async () => {
    const locationId = 'camp';
    const room = new ModEntityBuilder(locationId).asRoom('Camp').build();
    const item = buildPortableItem('item-1', 2);
    const giver = buildActor('giver-1', locationId, ['item-1']);
    const receiver = new ModEntityBuilder('receiver-1')
      .withName('Receiver')
      .atLocation(locationId)
      .asActor()
      .withComponent('items:inventory', {
        items: Array.from({ length: 10 }, (_, index) => `item-${index}`),
        capacity: { maxWeight: 50, maxItems: 10 }
      })
      .build();

    giveFixture.reset([room, giver, receiver, item]);

    await giveFixture.executeAction('giver-1', 'receiver-1', {
      additionalPayload: { secondaryTargetId: 'item-1' }
    });

    const receiverInventory = giveFixture.entityManager.getEntityInstance('receiver-1').components['items:inventory'];
    expect(receiverInventory.items).not.toContain('item-1');
  });

  it('should handle attempts to give items the actor does not own', async () => {
    const locationId = 'camp';
    const room = new ModEntityBuilder(locationId).asRoom('Camp').build();
    const item = buildPortableItem('item-1', 2);
    const giver = buildActor('giver-1', locationId, []);
    const receiver = buildActor('receiver-1', locationId, []);

    giveFixture.reset([room, giver, receiver, item]);

    await giveFixture.executeAction('giver-1', 'receiver-1', {
      additionalPayload: { secondaryTargetId: 'item-1' }
    });

    const failureEvent = giveFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(failureEvent?.payload.success).toBe(false);
  });
});
```

### Step 5: Inventory Capacity Validation Tests (10 minutes)

```javascript
describe('Inventory Capacity Validation', () => {
  let pickupFixture;

  beforeEach(async () => {
    pickupFixture = await ModTestFixture.forAction('items', 'items:pick_up_item');
  });

  afterEach(() => {
    pickupFixture.cleanup();
  });

  it('should expose max weight failures with the correct reason code', async () => {
    const locationId = 'mine';
    const room = new ModEntityBuilder(locationId).asRoom('Mine').build();
    const heavyItem = buildPortableItem('heavy-rock', 60, locationId);
    const actor = buildActor('actor-1', locationId, []);

    pickupFixture.reset([room, actor, heavyItem]);

    await pickupFixture.executeAction('actor-1', 'heavy-rock');

    const failureMessage = pickupFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    )?.payload.message;
    expect(failureMessage).toContain('max_weight_exceeded');
  });

  it('should expose max item count failures with the correct reason code', async () => {
    const locationId = 'warehouse';
    const room = new ModEntityBuilder(locationId).asRoom('Warehouse').build();
    const extraItem = buildPortableItem('extra-item', 1, locationId);
    const actor = new ModEntityBuilder('actor-1')
      .withName('Collector')
      .atLocation(locationId)
      .asActor()
      .withComponent('items:inventory', {
        items: Array.from({ length: 10 }, (_, index) => `item-${index}`),
        capacity: { maxWeight: 50, maxItems: 10 }
      })
      .build();

    pickupFixture.reset([room, actor, extraItem]);

    await pickupFixture.executeAction('actor-1', 'extra-item');

    const failureMessage = pickupFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    )?.payload.message;
    expect(failureMessage).toContain('max_items_exceeded');
  });

  it('should sum existing item weights using the items:weight component', async () => {
    const locationId = 'camp';
    const room = new ModEntityBuilder(locationId).asRoom('Camp').build();
    const existingInventory = ['item-a', 'item-b'];
    const actor = new ModEntityBuilder('actor-1')
      .withName('Carrier')
      .atLocation(locationId)
      .asActor()
      .withComponent('items:inventory', {
        items: existingInventory,
        capacity: { maxWeight: 5, maxItems: 10 }
      })
      .build();
    const existingItemA = buildPortableItem('item-a', 2);
    const existingItemB = buildPortableItem('item-b', 2);
    const newItem = buildPortableItem('item-new', 2, locationId);

    pickupFixture.reset([room, actor, existingItemA, existingItemB, newItem]);

    await pickupFixture.executeAction('actor-1', 'item-new');

    const failureMessage = pickupFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    )?.payload.message;
    expect(failureMessage).toContain('max_weight_exceeded');
  });
});
```

### Step 6: Edge Cases and Error Handling (10 minutes)

```javascript
describe('Edge Cases and Error Handling', () => {
  it('should surface no_weight errors when the item lacks items:weight', async () => {
    const locationId = 'test-location';
    const room = new ModEntityBuilder(locationId).asRoom('Test Location').build();
    const actor = buildActor('actor-1', locationId, []);
    const item = new ModEntityBuilder('item-1')
      .withName('Item 1')
      .atLocation(locationId)
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .build();

    const pickupFixture = await ModTestFixture.forAction('items', 'items:pick_up_item');
    pickupFixture.reset([room, actor, item]);

    await pickupFixture.executeAction('actor-1', 'item-1');

    const failureMessage = pickupFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    )?.payload.message;
    expect(failureMessage).toContain('no_weight');
    pickupFixture.cleanup();
  });

  it('should surface no_inventory errors when the actor lacks items:inventory', async () => {
    const locationId = 'test-location';
    const room = new ModEntityBuilder(locationId).asRoom('Test Location').build();
    const actor = new ModEntityBuilder('actor-1')
      .withName('Actor 1')
      .atLocation(locationId)
      .asActor()
      .build();
    const item = buildPortableItem('item-1', 1, locationId);

    const pickupFixture = await ModTestFixture.forAction('items', 'items:pick_up_item');
    pickupFixture.reset([room, actor, item]);

    await pickupFixture.executeAction('actor-1', 'item-1');

    const failureMessage = pickupFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    )?.payload.message;
    expect(failureMessage).toContain('no_inventory');
    pickupFixture.cleanup();
  });

  it('should ignore actions when provided entity IDs do not exist', async () => {
    const dropFixture = await ModTestFixture.forAction('items', 'items:drop_item');
    dropFixture.reset([]);

    await dropFixture.executeAction('missing-actor', 'missing-item');

    const failureEvent = dropFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(failureEvent?.payload.success).toBe(false);
    dropFixture.cleanup();
  });
});
```

## Files Affected

**New Files**:
- `tests/integration/mods/items/itemSystemWorkflows.integration.test.js`

**Dependencies** (must exist):
- Operation handlers: `dropItemAtLocationHandler.js`, `pickUpItemFromLocationHandler.js`, `transferItemHandler.js`, `validateInventoryCapacityHandler.js`
- Operation schemas: All 4 schemas from RUNERRMIG-004 through RUNERRMIG-007
- Action definitions: `drop_item.action.json`, `pick_up_item.action.json`, `give_item.action.json`
- Rule definitions: `handle_drop_item.rule.json`, `handle_pick_up_item.rule.json`, `handle_give_item.rule.json`

## Acceptance Criteria

- [ ] All drop item workflow tests pass
- [ ] All pick-up item workflow tests pass
- [ ] All give item workflow tests pass
- [ ] Inventory capacity validation tests pass
- [ ] Edge cases and error handling tests pass
- [ ] Perception events verified for all operations
- [ ] State changes verified via `items:inventory` updates and `core:position` components
- [ ] Test coverage for critical paths: 100%
- [ ] No failing tests or console errors

## Testing Requirements

### Test Coverage Goals
- **Critical Paths**: 100% coverage of successful workflows
- **Edge Cases**: 80%+ coverage of failure scenarios
- **Perception Events**: Verification for each operation type
- **State Transitions**: Before/after state validation for all operations

### Test Execution
```bash
# Run integration tests
npm run test:integration

# Run specific test file
npm run test:integration tests/integration/mods/items/itemSystemWorkflows.integration.test.js

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode for development
npm run test:integration -- --watch
```

### Success Criteria
- All tests pass on first run
- No flaky tests (run 3 times to verify)
- Test execution time < 5 seconds for full suite
- No memory leaks detected
- Console clean (no errors or warnings)

## Test Scenarios Checklist

### Drop Item
- [ ] Successfully drop item from inventory to location
- [ ] Inventory updated correctly (`items:inventory` no longer contains item)
- [ ] Item gains `core:position` at the expected location
- [ ] Perception event dispatched
- [ ] Handle invalid item ID
- [ ] Handle missing weight component on item (emits `no_weight`)

### Pick-Up Item
- [ ] Successfully pick up item from location to inventory
- [ ] Inventory updated correctly (`items:inventory` includes item)
- [ ] Item loses `core:position` when added to inventory
- [ ] Prevent pickup when weight capacity exceeded
- [ ] Prevent pickup when count capacity exceeded
- [ ] Perception event dispatched
- [ ] Handle invalid item ID

### Give Item
- [ ] Successfully transfer item between actors
- [ ] Giver inventory updated (`items:inventory` item removed)
- [ ] Receiver inventory updated (`items:inventory` item added)
- [ ] Validate receiver capacity before transfer
- [ ] Prevent giving when receiver capacity exceeded
- [ ] Perception event dispatched
- [ ] Handle giver doesn't own item
- [ ] Handle invalid actor IDs

### Validation
- [ ] Weight capacity validation works correctly (emits `max_weight_exceeded`)
- [ ] Count capacity validation works correctly (emits `max_items_exceeded`)
- [ ] Capacity accounts for existing item weights via `items:weight`
- [ ] Failure messages surface validation reason codes in `core:display_failed_action_result`

## Dependencies

**Blocked By**:
- RUNERRMIG-001 through RUNERRMIG-007 (Sprint 1 must complete first)
- All operation schemas must exist
- All action and rule files must validate

**Blocks**: None (final ticket in sequence)

**Should Test After**:
- RUNERRMIG-008 (Target Required Components) - if completed, include in tests

## References

### Test Patterns
- **Mod Fixture Usage**: `tests/common/mods/ModTestFixture.js`
- **Integration Test Examples**: `tests/integration/mods/items/*.test.js`
- **Action Discovery Testing**: See other mod fixtures using `executeAction`
- **Rule Execution Testing**: Existing mod rule execution tests in the same folder

### Code Under Test
- **Operation Handlers**: `src/logic/operationHandlers/`
  - `dropItemAtLocationHandler.js`
  - `pickUpItemFromLocationHandler.js`
  - `transferItemHandler.js`
  - `validateInventoryCapacityHandler.js`
- **Action Definitions**: `data/mods/items/actions/`
- **Rule Definitions**: `data/mods/items/rules/`

### Documentation
- **Analysis Document**: `reports/runtime-errors-post-migration-analysis.md` (lines 521-540, 578-594)
- **Project Context**: `CLAUDE.md` (testing strategy section)

## Risk Assessment

**Risk Level**: ✅ Low

**Mitigation**:
- Using proven test patterns from existing integration tests
- Testing isolated workflows reduces inter-test dependencies
- Clear arrange-act-assert structure makes tests maintainable
- Comprehensive edge case coverage prevents regressions

## Success Metrics

- ✅ 100% of critical item workflows tested
- ✅ All edge cases covered with tests
- ✅ Perception system integration verified
- ✅ State management validated
- ✅ No regressions in item functionality
- ✅ Test suite executes quickly (<5s)
- ✅ Tests are reliable and non-flaky

## Post-Implementation

After completing this ticket:
1. Run full test suite to ensure no regressions
2. Monitor test execution time for performance issues
3. Document any discovered edge cases or behaviors
4. Consider adding E2E tests for user-facing scenarios
5. Update any developer documentation about item system testing
