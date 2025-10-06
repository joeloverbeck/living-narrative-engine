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

Basic structure:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Item System - Integration Workflows', () => {
  let testBed;
  let entityManager;
  let actionDiscovery;
  let ruleEngine;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.get('IEntityManager');
    actionDiscovery = testBed.get('IActionDiscoveryService');
    ruleEngine = testBed.get('IRuleEngine');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Test suites here
});
```

### Step 2: Drop Item Workflow Tests (15 minutes)

```javascript
describe('Drop Item Workflow', () => {
  it('should successfully drop item from inventory to location', async () => {
    // Arrange: Create actor with item in inventory
    const actorId = testBed.createEntity('actor');
    const itemId = testBed.createEntity('item');
    const locationId = 'test-location';

    testBed.addComponent(actorId, 'core:inventory', {
      items: [itemId],
      capacity: { weight: 100, count: 10 }
    });
    testBed.addComponent(itemId, 'items:portable', { weight: 5 });

    // Act: Execute drop item action
    const action = await actionDiscovery.findAction('items:drop_item');
    const result = await ruleEngine.executeRule(
      action.ruleId,
      { actorId, primaryTarget: itemId, locationId }
    );

    // Assert: Item removed from inventory and placed at location
    expect(result.success).toBe(true);
    const inventory = entityManager.getComponent(actorId, 'core:inventory');
    expect(inventory.items).not.toContain(itemId);

    const locationItems = testBed.getLocationItems(locationId);
    expect(locationItems).toContain(itemId);
  });

  it('should dispatch perception events when dropping item', async () => {
    // Test perception event dispatching
  });

  it('should handle invalid item gracefully', async () => {
    // Test error handling
  });
});
```

### Step 3: Pick-Up Item Workflow Tests (15 minutes)

```javascript
describe('Pick-Up Item Workflow', () => {
  it('should successfully pick up item from location to inventory', async () => {
    // Test picking up item
  });

  it('should prevent pickup when inventory is full (weight)', async () => {
    // Arrange: Actor at weight capacity
    const actorId = testBed.createEntity('actor');
    const itemId = testBed.createEntity('item');

    testBed.addComponent(actorId, 'core:inventory', {
      items: [],
      capacity: { weight: 10, count: 10 },
      currentWeight: 9
    });
    testBed.addComponent(itemId, 'items:portable', { weight: 5 });

    // Act: Attempt to pick up item
    const result = await ruleEngine.executeRule(
      'items:handle_pick_up_item',
      { actorId, primaryTarget: itemId }
    );

    // Assert: Pickup fails due to capacity
    expect(result.success).toBe(false);
    expect(result.reason).toContain('capacity');
  });

  it('should prevent pickup when inventory is full (count)', async () => {
    // Test count-based capacity limit
  });

  it('should dispatch perception events when picking up item', async () => {
    // Test perception events
  });
});
```

### Step 4: Give Item Workflow Tests (15 minutes)

```javascript
describe('Give Item Workflow', () => {
  it('should successfully transfer item between actors', async () => {
    // Arrange: Two actors, giver has item
    const giverId = testBed.createEntity('giver');
    const receiverId = testBed.createEntity('receiver');
    const itemId = testBed.createEntity('item');

    testBed.addComponent(giverId, 'core:inventory', {
      items: [itemId],
      capacity: { weight: 100, count: 10 }
    });
    testBed.addComponent(receiverId, 'core:inventory', {
      items: [],
      capacity: { weight: 100, count: 10 }
    });
    testBed.addComponent(itemId, 'items:portable', { weight: 5 });

    // Act: Execute give item action
    const result = await ruleEngine.executeRule(
      'items:handle_give_item',
      { actorId: giverId, primaryTarget: itemId, secondaryTarget: receiverId }
    );

    // Assert: Item transferred correctly
    expect(result.success).toBe(true);

    const giverInventory = entityManager.getComponent(giverId, 'core:inventory');
    expect(giverInventory.items).not.toContain(itemId);

    const receiverInventory = entityManager.getComponent(receiverId, 'core:inventory');
    expect(receiverInventory.items).toContain(itemId);
  });

  it('should prevent giving item when receiver inventory is full', async () => {
    // Test capacity validation for receiver
  });

  it('should handle giving item actor does not own', async () => {
    // Test error handling for invalid state
  });
});
```

### Step 5: Inventory Capacity Validation Tests (10 minutes)

```javascript
describe('Inventory Capacity Validation', () => {
  it('should validate weight capacity correctly', async () => {
    // Test VALIDATE_INVENTORY_CAPACITY operation
  });

  it('should validate count capacity correctly', async () => {
    // Test count-based limits
  });

  it('should account for existing items in capacity check', async () => {
    // Test capacity calculation with existing items
  });
});
```

### Step 6: Edge Cases and Error Handling (10 minutes)

```javascript
describe('Edge Cases and Error Handling', () => {
  it('should handle missing portable component on item', async () => {
    // Test handling of items without portable component
  });

  it('should handle missing inventory component on actor', async () => {
    // Test graceful handling of missing components
  });

  it('should handle invalid entity IDs', async () => {
    // Test error handling for non-existent entities
  });

  it('should handle concurrent inventory modifications', async () => {
    // Test race condition handling (if applicable)
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
- [ ] State changes verified (inventory, location items)
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
- [ ] Inventory updated correctly (item removed)
- [ ] Location items updated correctly (item added)
- [ ] Perception event dispatched
- [ ] Handle invalid item ID
- [ ] Handle missing portable component

### Pick-Up Item
- [ ] Successfully pick up item from location to inventory
- [ ] Inventory updated correctly (item added)
- [ ] Location items updated correctly (item removed)
- [ ] Prevent pickup when weight capacity exceeded
- [ ] Prevent pickup when count capacity exceeded
- [ ] Perception event dispatched
- [ ] Handle invalid item ID

### Give Item
- [ ] Successfully transfer item between actors
- [ ] Giver inventory updated (item removed)
- [ ] Receiver inventory updated (item added)
- [ ] Validate receiver capacity before transfer
- [ ] Prevent giving when receiver capacity exceeded
- [ ] Perception event dispatched
- [ ] Handle giver doesn't own item
- [ ] Handle invalid actor IDs

### Validation
- [ ] Weight capacity validation works correctly
- [ ] Count capacity validation works correctly
- [ ] Capacity accounts for existing items
- [ ] Validation result stored in correct variable

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
- **Test Bed Usage**: `tests/common/testBed.js`
- **Integration Test Examples**: `tests/integration/mods/*/` directories
- **Action Discovery Testing**: Similar tests in other mod integration tests
- **Rule Execution Testing**: Existing rule engine integration tests

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
