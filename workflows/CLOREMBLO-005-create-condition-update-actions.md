# CLOREMBLO-005: Create can-remove-item Condition and Update Actions

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 1-2 hours
**Phase**: 4 - Action Integration

---

## Overview

Create the `can-remove-item` condition that validates item removal is not blocked, and update clothing removal actions to include this condition in their prerequisites. This provides a second layer of validation (in addition to scope filtering) and enables clear error messaging.

---

## Background

The blocking system has two layers of protection:
1. **Scope Filtering** (CLOREMBLO-004): Blocked items don't appear in `topmost_clothing`
2. **Condition Validation** (this ticket): Double-check removal is allowed before execution

This dual approach:
- Prevents blocked items from appearing in action discovery
- Validates removal is still allowed at execution time (in case state changed)
- Provides clear error messages when removal fails
- Follows defense-in-depth principle

---

## Requirements

### Condition Definition

**File**: `data/mods/clothing/conditions/can-remove-item.condition.json`

**Purpose**: Validates that the target clothing item can be removed (not blocked by other equipped items).

**Full Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "clothing:can-remove-item",
  "description": "Validates that the target clothing item can be removed (not blocked by other equipped items)",
  "type": "inline",
  "expression": {
    "!": {
      "isRemovalBlocked": [
        "{actorId}",
        "{targetId}"
      ]
    }
  }
}
```

**Design Rationale**:
- Uses negation (`!`) because operator returns `true` when blocked
- Condition returns `true` when removal is allowed (not blocked)
- Uses `{actorId}` and `{targetId}` placeholders from action context
- Simple inline condition (no separate expression file needed)

---

## Implementation Tasks

### 1. Create Condition File

Create `data/mods/clothing/conditions/can-remove-item.condition.json` with the definition above.

### 2. Update remove_clothing Action

**File**: `data/mods/clothing/actions/remove_clothing.action.json`

**Changes**: Add `can-remove-item` condition to prerequisites.

**Before**:
```json
{
  "prerequisites": [
    {
      "condition_ref": "clothing:event-is-action-remove-clothing"
    }
  ]
}
```

**After**:
```json
{
  "prerequisites": [
    {
      "condition_ref": "clothing:event-is-action-remove-clothing"
    },
    {
      "condition_ref": "clothing:can-remove-item"
    }
  ]
}
```

### 3. Update remove_others_clothing Action

**File**: `data/mods/clothing/actions/remove_others_clothing.action.json`

**Changes**: Add same validation to prerequisites.

**Before**:
```json
{
  "prerequisites": [
    {
      "condition_ref": "clothing:event-is-action-remove-others-clothing"
    }
  ]
}
```

**After**:
```json
{
  "prerequisites": [
    {
      "condition_ref": "clothing:event-is-action-remove-others-clothing"
    },
    {
      "condition_ref": "clothing:can-remove-item"
    }
  ]
}
```

### 4. Create Unit Tests

**File**: `tests/unit/mods/clothing/conditions/canRemoveItem.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('clothing:can-remove-item Condition', () => {
  let testBed;
  let condition;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.loadCondition('clothing:can-remove-item');
    condition = testBed.getCondition('clothing:can-remove-item');
  });

  describe('Schema Validation', () => {
    it('should have valid condition schema', () => {
      expect(condition).toBeDefined();
      expect(condition.id).toBe('clothing:can-remove-item');
      expect(condition.type).toBe('inline');
      expect(condition.expression).toBeDefined();
    });

    it('should use isRemovalBlocked operator with negation', () => {
      expect(condition.expression).toHaveProperty('!');
      expect(condition.expression['!']).toHaveProperty('isRemovalBlocked');
    });
  });

  describe('Evaluation', () => {
    it('should return true when item is not blocked', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const shirt = testBed.createEntity('shirt1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'torso_upper' },
        },
      });

      testBed.equipItem(actor.id, shirt.id);

      // Act
      const result = testBed.evaluateCondition('clothing:can-remove-item', {
        actorId: actor.id,
        targetId: shirt.id,
      });

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when item is blocked', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const belt = testBed.createEntity('belt1', [
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
      const pants = testBed.createEntity('pants1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      });

      testBed.equipItem(actor.id, belt.id);
      testBed.equipItem(actor.id, pants.id);

      // Act
      const result = testBed.evaluateCondition('clothing:can-remove-item', {
        actorId: actor.id,
        targetId: pants.id,
      });

      // Assert
      expect(result).toBe(false);
    });

    it('should return true after blocking item removed', () => {
      // Arrange
      const actor = testBed.createEntity('actor1', ['clothing:equipment']);
      const belt = testBed.createEntity('belt1', [
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
      const pants = testBed.createEntity('pants1', ['clothing:wearable'], {
        'clothing:wearable': {
          layer: 'base',
          equipmentSlots: { primary: 'legs' },
        },
      });

      testBed.equipItem(actor.id, belt.id);
      testBed.equipItem(actor.id, pants.id);

      // Remove belt
      testBed.unequipItem(actor.id, belt.id);

      // Act
      const result = testBed.evaluateCondition('clothing:can-remove-item', {
        actorId: actor.id,
        targetId: pants.id,
      });

      // Assert
      expect(result).toBe(true);
    });
  });
});
```

### 5. Create Integration Tests

**File**: `tests/integration/clothing/removeClothingActionBlocking.integration.test.js`

**Test Coverage**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('Remove Clothing Action - Blocking Integration', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('clothing', 'clothing:remove_clothing');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should prevent remove_clothing action when item is blocked', async () => {
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

    // Act: Try to remove pants
    const result = await fixture.executeAction(actor.id, pants.id);

    // Assert: Action should fail due to blocking
    expect(result.success).toBe(false);
    expect(result.error).toContain('blocked');
  });

  it('should allow remove_clothing action when item is not blocked', async () => {
    // Arrange
    const actor = fixture.createStandardActor('John');
    const shirt = fixture.createEntity('shirt', ['clothing:wearable'], {
      'clothing:wearable': {
        layer: 'base',
        equipmentSlots: { primary: 'torso_upper' },
      },
    });

    fixture.equipItem(actor.id, shirt.id);

    // Act: Remove shirt
    const result = await fixture.executeAction(actor.id, shirt.id);

    // Assert: Action should succeed
    expect(result.success).toBe(true);
  });

  it('should allow removal after blocking item removed', async () => {
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

    // Act: Remove belt first
    const beltResult = await fixture.executeAction(actor.id, belt.id);

    // Then remove pants
    const pantsResult = await fixture.executeAction(actor.id, pants.id);

    // Assert
    expect(beltResult.success).toBe(true);
    expect(pantsResult.success).toBe(true);
  });
});

describe('Remove Others Clothing Action - Blocking Integration', () => {
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

  it('should prevent removing others clothing when blocked', async () => {
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

    // Act: John tries to remove Jane's pants (blocked by belt)
    const result = await fixture.executeAction(actor.id, target.id, pants.id);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('blocked');
  });
});
```

### 6. Run Tests

```bash
# Unit tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/clothing/conditions/canRemoveItem.test.js

# Integration tests
NODE_ENV=test npm run test:integration -- tests/integration/clothing/removeClothingActionBlocking.integration.test.js
```

---

## Validation

### Schema Validation

```bash
npm run validate
```

Expected: All schemas valid, including new condition.

### Unit Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/mods/clothing/conditions/canRemoveItem.test.js
```

Expected: All tests pass.

### Integration Tests

```bash
NODE_ENV=test npm run test:integration -- tests/integration/clothing/removeClothingActionBlocking.integration.test.js
```

Expected: All tests pass.

### Type Checking

```bash
npm run typecheck
```

Expected: No errors.

### Full Test Suite

```bash
npm run test:ci
```

Expected: No regressions, all tests pass.

---

## Acceptance Criteria

- [ ] `can-remove-item` condition created with correct schema
- [ ] Condition uses `isRemovalBlocked` operator with negation
- [ ] Condition validates successfully
- [ ] `remove_clothing` action updated with new prerequisite
- [ ] `remove_others_clothing` action updated with new prerequisite
- [ ] Actions validate successfully
- [ ] Unit tests created and passing
- [ ] Integration tests created and passing
- [ ] Schema validation passes
- [ ] Type checking passes
- [ ] No regressions in existing tests

---

## Notes

### Why Both Scope Filtering AND Condition Validation?

1. **Scope Filtering** (Primary): Prevents blocked items from appearing in UI
2. **Condition Validation** (Secondary): Safety check at execution time

**Benefits of Dual Approach**:
- **Defense in Depth**: Two layers of protection
- **State Changes**: Validates blocking hasn't changed between discovery and execution
- **Clear Errors**: Condition provides specific error messages
- **Fail-Safe**: If scope filtering fails, condition still prevents invalid removal

### Placeholder Mapping

The condition uses these placeholders:
- `{actorId}`: Resolved from action context (actor performing action)
- `{targetId}`: Resolved from action context (item being removed)

These are automatically populated by the action execution system.

### Error Handling

When the condition fails (returns `false`):
- Action execution is blocked
- Error message should indicate blocking (implementation in action executor)
- Player sees clear feedback about why removal failed

---

## Common Pitfalls

**Pitfall**: Forgetting negation operator
**Solution**: Condition must use `!` because operator returns `true` when blocked

**Pitfall**: Wrong placeholder names
**Solution**: Use exactly `{actorId}` and `{targetId}` to match action context

**Pitfall**: Not updating both actions
**Solution**: Update both `remove_clothing` and `remove_others_clothing`

**Pitfall**: Breaking existing prerequisites
**Solution**: Add new condition to array, don't replace existing ones

---

## Example Action Discovery Flow

### Before This Implementation

```
1. Actor wearing: belt, pants
2. topmost_clothing scope resolves to: [belt, pants]
3. Actions discovered: remove belt, remove pants
4. Player can attempt to remove pants (blocked at scope level in CLOREMBLO-004)
```

### After This Implementation

```
1. Actor wearing: belt, pants
2. topmost_clothing scope resolves to: [belt] (pants filtered by CLOREMBLO-004)
3. Actions discovered: remove belt only
4. Condition also validates: if somehow pants action executed, condition blocks it
```

**Result**: Belt must be removed before pants appear as removable.

---

## Related Tickets

- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (prerequisite)
- **CLOREMBLO-003**: Register operator in DI container (prerequisite)
- **CLOREMBLO-004**: Integrate blocking into scope resolver (complementary)
- **CLOREMBLO-006**: Update belt entities (uses this validation)
- **CLOREMBLO-007**: Create comprehensive test suite (validates this)
