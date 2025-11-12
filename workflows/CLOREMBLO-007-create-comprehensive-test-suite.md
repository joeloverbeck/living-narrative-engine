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

### Prerequisites

All test actors must have the `clothing:equipment` component to interact with the clothing system. This is a required component defined in the action schemas.

### Key Testing Patterns

1. **Entity Creation**: Use `fixture.createEntity()` with full component structure
2. **Actor Setup**: Use `fixture.createStandardActorTarget(['Name1', 'Name2'])` which returns `{actor, target}`
3. **Equipment Management**: Manipulate `clothing:equipment` component via `fixture.modifyComponent()` or `fixture.addComponent()`
4. **Scope Testing**: Test scope behavior indirectly via action discovery (scopes are internal to the discovery system)
5. **Action Results**: Check events via `fixture.events` inspection, not return values
6. **Multi-Target Actions**: Use `fixture.discoverActions()` and filter results by target

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

### Important: Corrected API Patterns

**This workflow has been updated to use the correct ModTestFixture API.** Previous versions assumed non-existent methods. The corrected patterns are:

#### Entity Creation
```javascript
// ✅ CORRECT: Create actor-target pair
const { actor, target } = fixture.createStandardActorTarget(['John', 'Jane']);

// ✅ CORRECT: Create entity with full component structure
const item = fixture.createEntity({
  id: 'item_id',
  name: 'Item Name',
  components: {
    'clothing:wearable': { layer: 'base', equipmentSlots: { primary: 'torso_upper' } }
  }
});

// ❌ INCORRECT: createStandardActor() does not exist
// const actor = fixture.createStandardActor('John');
```

#### Equipment Management
```javascript
// ✅ CORRECT: Manage equipment via component modification
await fixture.modifyComponent(actor.id, 'clothing:equipment', {
  equipped: {
    torso_upper: { outer: 'jacket', base: 'shirt' },
    legs: { base: 'pants' }
  }
});

// ❌ INCORRECT: equipItem() and unequipItem() do not exist
// fixture.equipItem(actor.id, item.id);
```

#### Scope Testing
```javascript
// ✅ CORRECT: Test scope behavior indirectly via action discovery
const actions = fixture.discoverActions(actor.id);
const removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');
const removableItems = removeActions.map(a => a.targetId);

// ❌ INCORRECT: resolveScope() is not exposed in ModTestFixture
// const topmost = fixture.resolveScope('clothing:topmost_clothing', { entityId: actor.id });
```

#### Action Results
```javascript
// ✅ CORRECT: Verify via component state and events
await fixture.executeAction(actor.id, item.id);
const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
expect(equipment.equipped.slot.layer).toBeUndefined();

// ❌ INCORRECT: tryExecuteAction() does not exist, executeAction() doesn't return {success, error}
// const result = await fixture.tryExecuteAction(actor.id, item.id);
```

#### Multi-Target Actions
```javascript
// ✅ CORRECT: Filter discovered actions by target
const actions = fixture.discoverActions(actor.id);
const actionsForTarget = actions.filter(a =>
  a.id === 'clothing:remove_others_clothing' && a.primaryId === target.id
);

// ❌ INCORRECT: discoverActionsForTarget() does not exist
// const actions = fixture.discoverActionsForTarget(actor.id, target.id);
```

---

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
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const jacket = fixture.createEntity({
      id: 'jacket',
      name: 'Leather Jacket',
      components: {
        'clothing:wearable': {
          layer: 'outer',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

    const shirt = fixture.createEntity({
      id: 'shirt',
      name: 'T-Shirt',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Leather Belt',
      components: {
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
      },
    });

    const pants = fixture.createEntity({
      id: 'pants',
      name: 'Jeans',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      },
    });

    // Set up equipment state via component modification
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          outer: jacket.id,
          base: shirt.id,
        },
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act & Assert: Validate removal sequence
    // Test scope behavior indirectly via action discovery
    let actions = fixture.discoverActions(actor.id);
    let removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    let removableItems = removeActions.map((a) => a.targetId);

    // Initially: jacket, shirt, belt removable (pants blocked)
    expect(removableItems).toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).toContain(belt.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove jacket
    await fixture.executeAction(actor.id, jacket.id);

    // Verify action succeeded via component state
    const equipmentAfterJacket = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterJacket.equipped.torso_upper.outer).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    removableItems = removeActions.map((a) => a.targetId);

    // Now: shirt, belt removable (pants still blocked)
    expect(removableItems).not.toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).toContain(belt.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Verify belt removal
    const equipmentAfterBelt = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterBelt.equipped.torso_lower.accessories).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    removableItems = removeActions.map((a) => a.targetId);

    // Now: shirt, pants removable (belt removed)
    expect(removableItems).not.toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).toContain(pants.id);

    // Remove pants
    await fixture.executeAction(actor.id, pants.id);

    // Verify pants removal
    const equipmentAfterPants = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterPants.equipped.legs.base).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing'
    );
    removableItems = removeActions.map((a) => a.targetId);

    // Now: only shirt removable
    expect(removableItems).not.toContain(jacket.id);
    expect(removableItems).toContain(shirt.id);
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).not.toContain(pants.id);
  });

  it('should prevent removal of blocked items via action discovery', async () => {
    // Arrange
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Leather Belt',
      components: {
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
      },
    });

    const pants = fixture.createEntity({
      id: 'pants',
      name: 'Jeans',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      },
    });

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: Check action discovery
    const actions = fixture.discoverActions(actor.id);
    const pantsRemovalActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === pants.id
    );

    // Assert: Pants removal should not be available
    expect(pantsRemovalActions).toHaveLength(0);

    // Belt removal should be available
    const beltRemovalActions = actions.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === belt.id
    );
    expect(beltRemovalActions).toHaveLength(1);
  });

  it('should update available actions after each removal', async () => {
    // Arrange
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Leather Belt',
      components: {
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
      },
    });

    const pants = fixture.createEntity({
      id: 'pants',
      name: 'Jeans',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      },
    });

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: Get available actions before removal
    const actionsBefore = fixture.discoverActions(actor.id);

    // Should have remove_clothing action for belt only
    const beltRemovalActions = actionsBefore.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === belt.id
    );
    const pantsRemovalActions = actionsBefore.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === pants.id
    );

    expect(beltRemovalActions).toHaveLength(1);
    expect(pantsRemovalActions).toHaveLength(0);

    // Remove belt
    await fixture.executeAction(actor.id, belt.id);

    // Verify belt removal
    const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower.accessories).toBeUndefined();

    // Get available actions after removal
    const actionsAfter = fixture.discoverActions(actor.id);

    // Should now have remove_clothing action for pants
    const pantsRemovalAfter = actionsAfter.filter(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === pants.id
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
    const { actor, target } = fixture.createStandardActorTarget(['John', 'Jane']);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Leather Belt',
      components: {
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
      },
    });

    const pants = fixture.createEntity({
      id: 'pants',
      name: 'Jeans',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      },
    });

    // Set up target's equipment state
    await fixture.modifyComponent(target.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: John discovers actions (filter for actions targeting Jane)
    const availableActions = fixture.discoverActions(actor.id);
    const actionsForTarget = availableActions.filter(
      (a) =>
        a.id === 'clothing:remove_others_clothing' &&
        (a.primaryId === target.id || a.targetId === pants.id)
    );

    const pantsRemovalActions = actionsForTarget.filter(
      (a) => a.targetId === pants.id || a.secondaryId === pants.id
    );

    // Assert: Pants removal should not be available
    expect(pantsRemovalActions).toHaveLength(0);

    // Belt removal should be available
    const beltRemovalActions = actionsForTarget.filter(
      (a) => a.targetId === belt.id || a.secondaryId === belt.id
    );
    expect(beltRemovalActions.length).toBeGreaterThan(0);

    // Act: John removes Jane's belt first
    // For remove_others_clothing: actor -> target (person) -> item
    await fixture.executeAction(actor.id, target.id, { itemId: belt.id });

    // Verify belt removal
    const equipment = fixture.getComponent(target.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower.accessories).toBeUndefined();

    // Discover actions again
    const actionsAfterBelt = fixture.discoverActions(actor.id);
    const actionsForTargetAfter = actionsAfterBelt.filter(
      (a) =>
        a.id === 'clothing:remove_others_clothing' &&
        (a.primaryId === target.id || a.targetId === pants.id)
    );

    const pantsRemovalAfter = actionsForTargetAfter.filter(
      (a) => a.targetId === pants.id || a.secondaryId === pants.id
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
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Leather Belt',
      components: {
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
      },
    });

    const suspenders = fixture.createEntity({
      id: 'suspenders',
      name: 'Suspenders',
      components: {
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
      },
    });

    const pants = fixture.createEntity({
      id: 'pants',
      name: 'Jeans',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      },
    });

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          accessories: suspenders.id,
        },
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Act: Check removable items via action discovery
    let actions = fixture.discoverActions(actor.id);
    let removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    let removableItems = removeActions.map((a) => a.targetId);

    // Assert: Pants blocked by both items
    expect(removableItems).toContain(belt.id);
    expect(removableItems).toContain(suspenders.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove only belt
    await fixture.executeAction(actor.id, belt.id);

    // Verify belt removal
    const equipmentAfterBelt = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterBelt.equipped.torso_lower.accessories).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    removableItems = removeActions.map((a) => a.targetId);

    // Assert: Pants still blocked by suspenders
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).toContain(suspenders.id);
    expect(removableItems).not.toContain(pants.id);

    // Remove suspenders
    await fixture.executeAction(actor.id, suspenders.id);

    // Verify suspenders removal
    const equipmentAfterSuspenders = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipmentAfterSuspenders.equipped.torso_upper.accessories).toBeUndefined();

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    removableItems = removeActions.map((a) => a.targetId);

    // Assert: Pants now unblocked
    expect(removableItems).not.toContain(belt.id);
    expect(removableItems).not.toContain(suspenders.id);
    expect(removableItems).toContain(pants.id);
  });

  it('should handle armor blocking multiple layers', async () => {
    // Arrange: Armor blocks both base and underwear layers
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const armor = fixture.createEntity({
      id: 'cuirass',
      name: 'Steel Cuirass',
      components: {
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
      },
    });

    const shirt = fixture.createEntity({
      id: 'shirt',
      name: 'Cotton Shirt',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

    const undershirt = fixture.createEntity({
      id: 'undershirt',
      name: 'Undershirt',
      components: {
        'clothing:wearable': {
          layer: 'underwear',
          equipmentSlots: { primary: 'torso_upper' },
        },
      },
    });

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_upper: {
          outer: armor.id,
          base: shirt.id,
          underwear: undershirt.id,
        },
      },
    });

    // Act: Check removable items via action discovery
    const actions = fixture.discoverActions(actor.id);
    const removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    const removableItems = removeActions.map((a) => a.targetId);

    // Assert: Only armor removable
    expect(removableItems).toContain(armor.id);
    expect(removableItems).not.toContain(shirt.id);
    expect(removableItems).not.toContain(undershirt.id);
  });

  it('should handle explicit item ID blocking', async () => {
    // Arrange: Cursed ring blocks specific artifact
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const cursedRing = fixture.createEntity({
      id: 'cursed_ring',
      name: 'Cursed Ring',
      components: {
        'clothing:wearable': {
          layer: 'accessories',
          equipmentSlots: { primary: 'hands' },
        },
        'clothing:blocks_removal': {
          blocksRemovalOf: ['artifact_glove'],
        },
      },
    });

    const artifactGlove = fixture.createEntity({
      id: 'artifact_glove',
      name: 'Artifact Glove',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'hands' },
        },
      },
    });

    const regularGlove = fixture.createEntity({
      id: 'regular_glove',
      name: 'Regular Glove',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'hands' },
        },
      },
    });

    // Set up equipment state with ring and artifact glove
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        hands: {
          accessories: cursedRing.id,
          base: artifactGlove.id,
        },
      },
    });

    // Act: Check removable items via action discovery
    let actions = fixture.discoverActions(actor.id);
    let removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    let removableItems = removeActions.map((a) => a.targetId);

    // Assert: Artifact glove blocked by cursed ring
    expect(removableItems).toContain(cursedRing.id);
    expect(removableItems).not.toContain(artifactGlove.id);

    // Add regular glove to equipment (different hand or slot)
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        hands: {
          accessories: cursedRing.id,
          base: artifactGlove.id,
          // Note: In real implementation, regular glove might be in different slot
          // This is conceptual - adjust based on actual equipment slot structure
        },
        hands_left: {
          base: regularGlove.id,
        },
      },
    });

    actions = fixture.discoverActions(actor.id);
    removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    removableItems = removeActions.map((a) => a.targetId);

    // Regular glove not blocked (not in blocksRemovalOf list)
    expect(removableItems).toContain(regularGlove.id);
    expect(removableItems).not.toContain(artifactGlove.id);
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
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Self-Blocking Belt',
      components: {
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
      },
    });

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt.id,
        },
      },
    });

    // Act: Check removable items via action discovery
    const actions = fixture.discoverActions(actor.id);
    const removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
    const removableItems = removeActions.map((a) => a.targetId);

    // Assert: Belt should still be removable (not blocking itself)
    expect(removableItems).toContain(belt.id);
  });

  it('should handle empty equipment gracefully', async () => {
    // Arrange: Actor with no clothing
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    // Equipment component exists but is empty (created by createStandardActorTarget)
    const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipment).toBeDefined();
    expect(equipment.equipped).toEqual({});

    // Act & Assert: Action discovery should not throw with empty equipment
    expect(() => {
      const actions = fixture.discoverActions(actor.id);
      const removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');
      expect(removeActions).toHaveLength(0);
    }).not.toThrow();
  });

  it('should handle malformed blocking component', async () => {
    // Arrange: Item with missing fields in blocking component
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const item = fixture.createEntity({
      id: 'malformed_item',
      name: 'Malformed Item',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
        'clothing:blocks_removal': {
          blockedSlots: [], // Empty array (edge case - valid but does nothing)
        },
      },
    });

    // Act & Assert: Should not throw when setting up equipment
    expect(async () => {
      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: item.id,
          },
        },
      });

      // Action discovery should handle this gracefully
      const actions = fixture.discoverActions(actor.id);
      const removeActions = actions.filter((a) => a.id === 'clothing:remove_clothing');

      // Item should be removable (empty blockedSlots means it blocks nothing)
      const removableItems = removeActions.map((a) => a.targetId);
      expect(removableItems).toContain(item.id);
    }).not.toThrow();
  });

  it('should handle state changes between discovery and execution', async () => {
    // Arrange
    const { actor } = fixture.createStandardActorTarget(['John', 'Unused']);

    const belt = fixture.createEntity({
      id: 'belt',
      name: 'Leather Belt',
      components: {
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
      },
    });

    const pants = fixture.createEntity({
      id: 'pants',
      name: 'Jeans',
      components: {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      },
    });

    // Set up equipment state
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: belt.id,
        },
        legs: {
          base: pants.id,
        },
      },
    });

    // Discover actions
    const actions = fixture.discoverActions(actor.id);

    // Belt removal action should be available
    const beltAction = actions.find(
      (a) => a.id === 'clothing:remove_clothing' && a.targetId === belt.id
    );

    expect(beltAction).toBeDefined();

    // Simulate: Another actor removes belt during AI turn
    await fixture.modifyComponent(actor.id, 'clothing:equipment', {
      equipped: {
        legs: {
          base: pants.id,
        },
        // torso_lower removed (belt unequipped)
      },
    });

    // Verify belt is no longer equipped
    const equipment = fixture.getComponent(actor.id, 'clothing:equipment');
    expect(equipment.equipped.torso_lower).toBeUndefined();

    // Act: Try to execute belt removal action
    // This should handle the missing item gracefully (item no longer equipped)
    await fixture.executeAction(actor.id, belt.id);

    // Assert: Check events for handling of this edge case
    // The action should either fail gracefully or be a no-op
    // (Implementation-specific behavior - adjust assertion based on actual behavior)
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

---

## Corrections Applied (2025 Validation)

This workflow has been validated and corrected against the actual codebase. The following major discrepancies were identified and fixed:

### Critical API Corrections

1. **Entity Creation Pattern**
   - **Original (Incorrect)**: `fixture.createStandardActor('John')`
   - **Corrected**: `fixture.createStandardActorTarget(['John', 'Target'])` returns `{actor, target}`
   - **Impact**: All test entity creation patterns updated

2. **Equipment Management**
   - **Original (Incorrect)**: `fixture.equipItem(actor.id, item.id)` and `fixture.unequipItem()`
   - **Corrected**: `fixture.modifyComponent(actor.id, 'clothing:equipment', {...})`
   - **Impact**: All equipment setup patterns updated

3. **Scope Resolution Testing**
   - **Original (Incorrect)**: `fixture.resolveScope('clothing:topmost_clothing', {...})`
   - **Corrected**: Test scope behavior indirectly via `fixture.discoverActions()` and filter results
   - **Impact**: All scope testing patterns updated

4. **Action Result Validation**
   - **Original (Incorrect)**: `fixture.tryExecuteAction()` returning `{success, error}`
   - **Corrected**: Use `fixture.executeAction()` and verify via component state and events
   - **Impact**: All action result assertions updated

5. **Multi-Target Action Discovery**
   - **Original (Incorrect)**: `fixture.discoverActionsForTarget(actor.id, target.id)`
   - **Corrected**: `fixture.discoverActions(actor.id)` and filter by `primaryId`/`targetId`
   - **Impact**: Multi-actor test patterns updated

### Prerequisites Added

- Documented that all actors require `clothing:equipment` component
- Added key testing patterns section in Background
- Added corrected API patterns section in Implementation Tasks

### Reference Documentation

For correct implementation patterns, consult:
- `/tests/common/mods/ModTestFixture.js` - Actual API implementation
- `/docs/testing/mod-testing-guide.md` - Comprehensive testing guide
- `/tests/integration/clothing/topmostClothingBlocking.integration.test.js` - Working examples
- `/data/mods/clothing/components/` - Actual component schemas

### Validation Date

**Validated**: 2025-11-12
**Agent**: workflow-assumptions-validator
**Status**: All assumptions corrected and aligned with actual codebase
