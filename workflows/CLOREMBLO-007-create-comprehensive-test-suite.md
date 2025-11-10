# CLOREMBLO-007: Create Comprehensive Test Suite

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 3-4 hours
**Phase**: 6 - Testing & Documentation

---

## Overview

Create comprehensive unit, integration, and end-to-end tests for the clothing removal blocking system. This ensures the system works correctly across all scenarios, edge cases, and integration points.

---

## Background

Testing requirements for the blocking system:
- **Unit Tests**: Individual component validation (operator, resolver helpers, condition)
- **Integration Tests**: Cross-component behavior (scope + action + operator)
- **E2E Tests**: Complete workflows from action discovery to execution
- **Performance Tests**: Verify blocking checks don't degrade performance
- **Edge Case Tests**: Unusual scenarios, error conditions, boundary cases

All tests must achieve:
- ≥ 80% branch coverage
- ≥ 90% function/line coverage
- 100% pass rate
- < 100ms execution time per test (performance tests excluded)

---

## Test Categories

### 1. Unit Tests

**Already created in previous tickets**:
- `tests/unit/logic/operators/isRemovalBlockedOperator.test.js` (CLOREMBLO-002)
- `tests/unit/scopeDsl/nodes/slotAccessResolverBlocking.test.js` (CLOREMBLO-004)
- `tests/unit/mods/clothing/components/blocksRemoval.test.js` (CLOREMBLO-001)
- `tests/unit/mods/clothing/conditions/canRemoveItem.test.js` (CLOREMBLO-005)

**Additional unit tests needed**:
- Blocking dependency validator (circular dependency detection)
- Edge case combinations

### 2. Integration Tests

**Already created in previous tickets**:
- `tests/integration/logic/operators/isRemovalBlockedOperatorDI.integration.test.js` (CLOREMBLO-003)
- `tests/integration/clothing/topmostClothingBlocking.integration.test.js` (CLOREMBLO-004)
- `tests/integration/clothing/removeClothingActionBlocking.integration.test.js` (CLOREMBLO-005)
- `tests/integration/clothing/beltBlockingEntities.integration.test.js` (CLOREMBLO-006)

**Additional integration tests needed**:
- Complex multi-item blocking scenarios
- Cross-mod blocking (if applicable)
- State transitions (equipment changes)

### 3. E2E Tests

**New tests needed**:
- Complete clothing removal workflow
- Multi-actor scenarios
- Error messaging and user feedback

---

## Implementation Tasks

### Task 1: Create E2E Workflow Tests

**File**: `tests/e2e/clothing/completeRemovalWorkflow.e2e.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Complete Clothing Removal Workflow - E2E', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should enforce removal order in full outfit', async () => {
    // Arrange: Actor wearing jacket, shirt, belt, pants
    const actor = fixture.createStandardActor('John');

    const jacket = fixture.createEntity('jacket', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'outer',
        equipmentSlots: { primary: 'torso_upper' },
      },
    });

    const shirt = fixture.createEntity('shirt', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      },
    });

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, jacket.id);
    fixture.equipItem(actor.id, shirt.id);
    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act & Assert: Validate removal sequence
    let topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Initially: jacket, shirt, belt removable (pants blocked)
    expect(topmost).toContain(jacket.id);
    expect(topmost).toContain(shirt.id);
    expect(topmost).toContain(belt.id);
    expect(topmost).not.toContain(pants.id);

    // Remove jacket
    await fixture.executeAction(actor.id, jacket.id);

    topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Now: shirt, belt removable (pants still blocked)
    expect(topmost).not.toContain(jacket.id);
    expect(topmost).toContain(shirt.id);
    expect(topmost).toContain(belt.id);
    expect(topmost).not.toContain(pants.id);

    // Remove belt
    await fixture.executeAction(actor.id, belt.id);

    topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Now: shirt, pants removable (belt removed)
    expect(topmost).not.toContain(jacket.id);
    expect(topmost).toContain(shirt.id);
    expect(topmost).not.toContain(belt.id);
    expect(topmost).toContain(pants.id);

    // Remove pants
    await fixture.executeAction(actor.id, pants.id);

    topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Now: only shirt removable
    expect(topmost).not.toContain(jacket.id);
    expect(topmost).toContain(shirt.id);
    expect(topmost).not.toContain(belt.id);
    expect(topmost).not.toContain(pants.id);
  });

  it('should show appropriate error messages for blocked removal', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
            reason: 'Belt secures pants at waist',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act: Attempt to remove pants (should fail if forced)
    // Note: Normally pants wouldn't appear in actions, but test direct execution
    const result = await fixture.tryExecuteAction(actor.id, pants.id);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Error message should reference blocking or belt
    expect(result.error.toLowerCase()).toMatch(/block|belt|secur/);
  });

  it('should update available actions after each removal', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Act: Get available actions before removal
    const actionsBefore = fixture.discoverActions(actor.id);

    // Should have remove_clothing action for belt only
    const beltRemovalActions = actionsBefore.filter(
      (a) => a.actionId === 'clothing:remove_clothing' && a.targetId === belt.id
    );
    const pantsRemovalActions = actionsBefore.filter(
      (a) => a.actionId === 'clothing:remove_clothing' && a.targetId === pants.id
    );

    expect(beltRemovalActions).toHaveLength(1);
    expect(pantsRemovalActions).toHaveLength(0);

    // Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Get available actions after removal
    const actionsAfter = fixture.discoverActions(actor.id);

    // Should now have remove_clothing action for pants
    const pantsRemovalAfter = actionsAfter.filter(
      (a) => a.actionId === 'clothing:remove_clothing' && a.targetId === pants.id
    );

    expect(pantsRemovalAfter).toHaveLength(1);
  });
});

describe('Multi-Actor Clothing Removal - E2E', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_others_clothing'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should enforce blocking when one actor removes anothers clothing', async () => {
    // Arrange
    const [actor, target] = fixture.createStandardActorTarget(['John', 'Jane']);

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(target.id, belt.id);
    fixture.equipItem(target.id, pants.id);

    // Act: John discovers actions for Jane
    const availableActions = fixture.discoverActionsForTarget(actor.id, target.id);

    const pantsRemovalActions = availableActions.filter(
      (a) =>
        a.actionId === 'clothing:remove_others_clothing' && a.targetId === pants.id
    );

    // Assert: Pants removal should not be available
    expect(pantsRemovalActions).toHaveLength(0);

    // Act: John removes Jane's belt first
    await fixture.executeAction(actor.id, target.id, belt.id);

    // Discover actions again
    const actionsAfterBelt = fixture.discoverActionsForTarget(actor.id, target.id);

    const pantsRemovalAfter = actionsAfterBelt.filter(
      (a) =>
        a.actionId === 'clothing:remove_others_clothing' && a.targetId === pants.id
    );

    // Assert: Pants removal should now be available
    expect(pantsRemovalAfter).toHaveLength(1);
  });
});
```

### Task 2: Create Complex Scenario Tests

**File**: `tests/integration/clothing/complexBlockingScenarios.integration.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Complex Blocking Scenarios', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should handle multiple items blocking the same target', async () => {
    // Arrange: Belt AND suspenders both block pants
    const actor = fixture.createStandardActor('John');

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const suspenders = fixture.createEntity('suspenders', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_upper' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, suspenders.id);
    fixture.equipItem(actor.id, pants.id);

    // Act: Check topmost clothing
    let topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Pants blocked by both items
    expect(topmost).toContain(belt.id);
    expect(topmost).toContain(suspenders.id);
    expect(topmost).not.toContain(pants.id);

    // Remove only belt
    await fixture.executeAction(actor.id, belt.id);

    topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Pants still blocked by suspenders
    expect(topmost).not.toContain(belt.id);
    expect(topmost).toContain(suspenders.id);
    expect(topmost).not.toContain(pants.id);

    // Remove suspenders
    await fixture.executeAction(actor.id, suspenders.id);

    topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Pants now unblocked
    expect(topmost).not.toContain(belt.id);
    expect(topmost).not.toContain(suspenders.id);
    expect(topmost).toContain(pants.id);
  });

  it('should handle armor blocking multiple layers', async () => {
    // Arrange: Armor blocks both base and underwear layers
    const actor = fixture.createStandardActor('John');

    const armor = fixture.createEntity('cuirass', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'outer',
        equipmentSlots: { primary: 'torso_upper' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'torso_upper',
            layers: ['base', 'underwear'],
            blockType: 'full_block',
          },
        ],
      },
    });

    const shirt = fixture.createEntity('shirt', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      },
    });

    const undershirt = fixture.createEntity('undershirt', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'underwear',
        equipmentSlots: { primary: 'torso_upper' },
      },
    });

    fixture.equipItem(actor.id, armor.id);
    fixture.equipItem(actor.id, shirt.id);
    fixture.equipItem(actor.id, undershirt.id);

    // Act
    const topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Only armor removable
    expect(topmost).toContain(armor.id);
    expect(topmost).not.toContain(shirt.id);
    expect(topmost).not.toContain(undershirt.id);
  });

  it('should handle explicit item ID blocking', async () => {
    // Arrange: Cursed ring blocks specific artifact
    const actor = fixture.createStandardActor('John');

    const cursedRing = fixture.createEntity('cursed_ring', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'hands' },
      },
      'clothing:blocks_removal': {
        blocksRemovalOf: ['artifact_glove'],
      },
    });

    const artifactGlove = fixture.createEntity('artifact_glove', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'hands' },
      },
    });

    const regularGlove = fixture.createEntity('regular_glove', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'hands' },
      },
    });

    fixture.equipItem(actor.id, cursedRing.id);
    fixture.equipItem(actor.id, artifactGlove.id);

    // Act
    let topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Artifact glove blocked, regular glove not blocked
    expect(topmost).toContain(cursedRing.id);
    expect(topmost).not.toContain(artifactGlove.id);

    // Equip regular glove on other hand
    fixture.equipItem(actor.id, regularGlove.id);

    topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Regular glove not blocked (not in blocksRemovalOf list)
    expect(topmost).toContain(regularGlove.id);
  });
});
```

### Task 3: Create Edge Case Tests

**File**: `tests/integration/clothing/blockingEdgeCases.integration.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Blocking System Edge Cases', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should not allow item to block itself', async () => {
    // Arrange: Belt with self-referential blocking (should be ignored)
    const actor = fixture.createStandardActor('John');

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'torso_lower',
            layers: ['accessories'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    fixture.equipItem(actor.id, belt.id);

    // Act
    const topmost = fixture.resolveScope('clothing:topmost_clothing', {
      entityId: actor.id,
    });

    // Assert: Belt should still be removable (not blocking itself)
    expect(topmost).toContain(belt.id);
  });

  it('should handle empty equipment gracefully', async () => {
    // Arrange: Actor with no clothing
    const actor = fixture.createStandardActor('John');

    // Act & Assert: Should not throw
    expect(() => {
      fixture.resolveScope('clothing:topmost_clothing', {
        entityId: actor.id,
      });
    }).not.toThrow();
  });

  it('should handle malformed blocking component', async () => {
    // Arrange: Item with missing fields in blocking component
    const actor = fixture.createStandardActor('John');

    const item = fixture.createEntity('item', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [], // Empty array (invalid but handle gracefully)
      },
    });

    // Act & Assert: Should not throw
    expect(() => {
      fixture.equipItem(actor.id, item.id);
      fixture.resolveScope('clothing:topmost_clothing', {
        entityId: actor.id,
      });
    }).not.toThrow();
  });

  it('should handle state changes between discovery and execution', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');

    const belt = fixture.createEntity('belt', [
      'clothing:wearable',
      'clothing:blocks_removal',
    ], {
      'clothing:wearable': {
        layer: 'accessories',
        equipmentSlots: { primary: 'torso_lower' },
      },
      'clothing:blocks_removal': {
        blockedSlots: [
          {
            slot: 'legs',
            layers: ['base'],
            blockType: 'must_remove_first',
          },
        ],
      },
    });

    const pants = fixture.createEntity('pants', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'legs' },
      },
    });

    fixture.equipItem(actor.id, belt.id);
    fixture.equipItem(actor.id, pants.id);

    // Discover actions
    const actions = fixture.discoverActions(actor.id);

    // Belt removal action should be available
    const beltAction = actions.find(
      (a) => a.actionId === 'clothing:remove_clothing' && a.targetId === belt.id
    );

    expect(beltAction).toBeDefined();

    // Simulate: Another actor removes belt during AI turn
    fixture.unequipItem(actor.id, belt.id);

    // Act: Try to execute belt removal action (should fail gracefully)
    const result = await fixture.tryExecuteAction(actor.id, belt.id);

    // Assert: Should fail with appropriate error
    expect(result.success).toBe(false);
  });
});
```

### Task 4: Run All Tests

Create a test script to run all blocking-related tests:

**File**: `scripts/test-blocking-system.sh` (new, optional)

```bash
#!/bin/bash

echo "Running Clothing Removal Blocking System Tests..."
echo "=================================================="

echo ""
echo "Unit Tests:"
echo "-----------"
NODE_ENV=test npm run test:unit -- \
  tests/unit/logic/operators/isRemovalBlockedOperator.test.js \
  tests/unit/scopeDsl/nodes/slotAccessResolverBlocking.test.js \
  tests/unit/mods/clothing/components/blocksRemoval.test.js \
  tests/unit/mods/clothing/conditions/canRemoveItem.test.js

echo ""
echo "Integration Tests:"
echo "------------------"
NODE_ENV=test npm run test:integration -- \
  tests/integration/logic/operators/isRemovalBlockedOperatorDI.integration.test.js \
  tests/integration/clothing/topmostClothingBlocking.integration.test.js \
  tests/integration/clothing/removeClothingActionBlocking.integration.test.js \
  tests/integration/clothing/beltBlockingEntities.integration.test.js \
  tests/integration/clothing/complexBlockingScenarios.integration.test.js \
  tests/integration/clothing/blockingEdgeCases.integration.test.js

echo ""
echo "E2E Tests:"
echo "----------"
NODE_ENV=test npm run test:e2e -- \
  tests/e2e/clothing/completeRemovalWorkflow.e2e.test.js

echo ""
echo "Test Summary:"
echo "-------------"
echo "All blocking system tests completed."
```

Make executable:
```bash
chmod +x scripts/test-blocking-system.sh
```

### Task 5: Generate Coverage Report

```bash
NODE_ENV=test npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operators/isRemovalBlockedOperator.js' --collectCoverageFrom='src/scopeDsl/nodes/slotAccessResolver.js'
```

Target: ≥ 80% branch coverage, ≥ 90% function/line coverage.

---

## Validation

### All Unit Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/logic/operators/isRemovalBlockedOperator.test.js tests/unit/scopeDsl/nodes/slotAccessResolverBlocking.test.js tests/unit/mods/clothing/components/blocksRemoval.test.js tests/unit/mods/clothing/conditions/canRemoveItem.test.js
```

Expected: All pass.

### All Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/clothing/
```

Expected: All pass.

### All E2E Tests

```bash
NODE_ENV=test npm run test:e2e -- tests/e2e/clothing/completeRemovalWorkflow.e2e.test.js
```

Expected: All pass.

### Full Test Suite

```bash
npm run test:ci
```

Expected: All tests pass, no regressions.

### Coverage Report

```bash
npm run test:unit -- --coverage
```

Expected: ≥ 80% branch coverage for new code.

---

## Acceptance Criteria

- [ ] E2E workflow tests created and passing
- [ ] Complex scenario tests created and passing
- [ ] Edge case tests created and passing
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Test coverage ≥ 80% branch, ≥ 90% function/line
- [ ] No test timeouts (all < 100ms except performance)
- [ ] No test flakiness (100% pass rate on multiple runs)
- [ ] Test script created for easy execution
- [ ] Coverage report generated and reviewed
- [ ] No regressions in existing tests

---

## Notes

### Test Organization

- **Unit Tests**: Fast, isolated, mock dependencies
- **Integration Tests**: Test component interactions, real dependencies
- **E2E Tests**: Complete workflows, full system integration

### Test Data

Use test fixtures from previous tickets:
- Belt entities with blocking
- Pants entities without blocking
- Armor entities with full_block

### Performance

Tests should execute quickly:
- Unit tests: < 10ms each
- Integration tests: < 100ms each
- E2E tests: < 500ms each

### Coverage Goals

Focus coverage on:
- `isRemovalBlockedOperator.js`: 100%
- `slotAccessResolver.js` blocking methods: 100%
- Condition evaluation: 100%

---

## Common Pitfalls

**Pitfall**: Tests passing locally but failing in CI
**Solution**: Ensure proper cleanup in `afterEach`, avoid global state

**Pitfall**: Flaky tests due to timing
**Solution**: Use proper async/await, avoid setTimeout

**Pitfall**: Low coverage due to error handling branches
**Solution**: Test error scenarios explicitly

**Pitfall**: Tests too slow
**Solution**: Mock external dependencies, use minimal fixtures

---

## Related Tickets

- **CLOREMBLO-001**: Create blocks_removal component (tested here)
- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (tested here)
- **CLOREMBLO-003**: Register operator in DI (tested here)
- **CLOREMBLO-004**: Integrate into scope resolver (tested here)
- **CLOREMBLO-005**: Create condition and update actions (tested here)
- **CLOREMBLO-006**: Update belt entities (tested here)
- **CLOREMBLO-008**: Write documentation (uses test examples)
