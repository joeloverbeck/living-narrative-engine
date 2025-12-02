# ANAGRAGENARCANA-005: Create Slot Key Uniqueness Validator

## Metadata
- **ID**: ANAGRAGENARCANA-005
- **Priority**: MEDIUM
- **Severity**: P5
- **Effort**: Medium
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R6
- **Related Issue**: HIGH-01 (No Duplicate Slot Key Validation)

---

## Problem Statement

The blueprint slot dependency sorter and processing pipeline don't detect or warn about duplicate slot keys. When `additionalSlots` in a V2 blueprint accidentally duplicates a generated slot key, the duplicate silently takes precedence.

### Current Behavior

```javascript
// sortSlotsByDependency in slotResolutionOrchestrator.js
export function sortSlotsByDependency(slots) {
  const sorted = [];
  const visited = new Set();
  // No check for duplicate keys in slots object
  for (const [key, slot] of Object.entries(slots)) {
    visit(key, slot);
  }
  return sorted;
}
```

### Problem Scenarios

1. **Unintentional Override**: V2 blueprint's `additionalSlots` uses same key as template-generated slot
2. **Typo Collision**: Similar slot names accidentally match (e.g., `left_leg` and `leftleg`)
3. **Copy-Paste Error**: Duplicated slot definition with same key

---

## Affected Files

| File | Line(s) | Change Type |
|------|---------|-------------|
| `src/anatomy/validation/validators/` | New file | Create new validator |
| `src/anatomy/validation/RecipeValidationRunner.js` | Registration | Register new validator |

---

## Implementation Steps

### Step 1: Create SlotKeyUniquenessValidator Class

Create a new validator file:

**File**: `src/anatomy/validation/validators/SlotKeyUniquenessValidator.js`

```javascript
/**
 * @file SlotKeyUniquenessValidator.js
 * @description Validates that slot keys are unique within a blueprint,
 *              detecting accidental overwrites from additionalSlots.
 */

import { BaseRecipeValidator } from './BaseRecipeValidator.js';
import { ValidationError } from '../../../errors/validationError.js';

/**
 * Validates slot key uniqueness in V2 blueprints.
 * Detects when additionalSlots accidentally overwrites generated slots.
 */
export class SlotKeyUniquenessValidator extends BaseRecipeValidator {
  /** @type {string} */
  static get validatorName() {
    return 'SlotKeyUniquenessValidator';
  }

  /** @type {number} */
  static get priority() {
    return 20; // Run early in validation pipeline
  }

  /**
   * Validates that no slot keys are duplicated between generated and additional slots.
   *
   * @param {Object} context - Validation context
   * @param {Object} context.blueprint - The processed blueprint
   * @param {Object} context.recipe - The recipe being validated
   * @param {Object} context.dataRegistry - Data registry for lookups
   * @returns {Promise<Object>} Validation result
   */
  async validate(context) {
    const { blueprint, recipe } = context;
    const errors = [];
    const warnings = [];

    // Only applicable to V2 blueprints with structure templates
    if (blueprint.schemaVersion !== '2.0' || !blueprint._generatedSlots) {
      return this.createResult(true, [], []);
    }

    const generatedSlotKeys = new Set(Object.keys(blueprint._generatedSlots || {}));
    const additionalSlotKeys = Object.keys(blueprint.additionalSlots || {});

    // Check for collisions
    const collisions = additionalSlotKeys.filter(key => generatedSlotKeys.has(key));

    for (const key of collisions) {
      const generatedSlot = blueprint._generatedSlots[key];
      const additionalSlot = blueprint.additionalSlots[key];

      // Determine if this is an intentional override
      const isIntentionalOverride = this.#isIntentionalOverride(
        generatedSlot,
        additionalSlot
      );

      if (isIntentionalOverride) {
        warnings.push({
          type: 'intentional_override',
          slotKey: key,
          message: `Slot '${key}' from additionalSlots overrides generated slot. ` +
                   `This appears intentional (different parent specified).`
        });
      } else {
        errors.push({
          type: 'unintentional_duplicate',
          slotKey: key,
          message: `Slot key '${key}' appears in both generated slots and additionalSlots. ` +
                   `The additionalSlots version will overwrite the generated one. ` +
                   `If this is intentional, specify a different parent to clarify intent.`
        });
      }
    }

    // Also check for duplicate keys within additionalSlots (shouldn't happen with objects, but defensive)
    this.#checkForDuplicateParentReferences(blueprint, warnings);

    const isValid = errors.length === 0;
    return this.createResult(isValid, errors, warnings);
  }

  /**
   * Determines if an override appears intentional based on slot properties.
   * Intentional overrides typically change the parent relationship.
   */
  #isIntentionalOverride(generatedSlot, additionalSlot) {
    // If the parent is different, it's likely intentional restructuring
    if (generatedSlot.parent !== additionalSlot.parent) {
      return true;
    }

    // Same parent but different properties - less clear intent
    return false;
  }

  /**
   * Checks for slots that might be duplicated due to copy-paste errors.
   */
  #checkForDuplicateParentReferences(blueprint, warnings) {
    const slots = blueprint.slots || {};
    const parentSocketCombos = new Map();

    for (const [key, slot] of Object.entries(slots)) {
      if (!slot.parent || !slot.socket) continue;

      const combo = `${slot.parent}:${slot.socket}`;

      if (parentSocketCombos.has(combo)) {
        warnings.push({
          type: 'duplicate_parent_socket',
          slotKeys: [parentSocketCombos.get(combo), key],
          message: `Slots '${parentSocketCombos.get(combo)}' and '${key}' both attach to ` +
                   `parent '${slot.parent}' via socket '${slot.socket}'. ` +
                   `Only one child can occupy each socket.`
        });
      } else {
        parentSocketCombos.set(combo, key);
      }
    }
  }
}

export default SlotKeyUniquenessValidator;
```

### Step 2: Register Validator in RecipeValidationRunner

Add the new validator to the validation pipeline:

```javascript
// In RecipeValidationRunner.js
import { SlotKeyUniquenessValidator } from './validators/SlotKeyUniquenessValidator.js';

// Add to validators array
const validators = [
  // ... existing validators
  SlotKeyUniquenessValidator,
  // ... other validators
];
```

### Step 3: Add Generated Slots Tracking to Blueprint Loader

Ensure V2 blueprint processing tracks which slots were generated vs. additional:

```javascript
// In blueprintLoader.js or BlueprintProcessorService.js
const processedBlueprint = {
  ...blueprint,
  slots: { ...generatedSlots, ...additionalSlots },
  _generatedSlots: generatedSlots,  // Track for validation
  _additionalSlots: additionalSlots
};
```

---

## Testing Requirements

### Unit Tests

Create tests in `tests/unit/anatomy/validation/validators/SlotKeyUniquenessValidator.test.js`:

1. **Test: Should pass when no duplicate slot keys**
```javascript
it('should pass validation when all slot keys are unique', async () => {
  const context = {
    blueprint: {
      schemaVersion: '2.0',
      _generatedSlots: { head: {}, torso: {} },
      additionalSlots: { custom_part: {} },
      slots: { head: {}, torso: {}, custom_part: {} }
    }
  };

  const result = await validator.validate(context);

  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});
```

2. **Test: Should detect unintentional duplicate slot keys**
```javascript
it('should error on unintentional duplicate slot keys', async () => {
  const context = {
    blueprint: {
      schemaVersion: '2.0',
      _generatedSlots: {
        left_arm: { parent: 'torso', socket: 'shoulder_left' }
      },
      additionalSlots: {
        left_arm: { parent: 'torso', socket: 'shoulder_left' } // Unintentional duplicate
      }
    }
  };

  const result = await validator.validate(context);

  expect(result.isValid).toBe(false);
  expect(result.errors[0].type).toBe('unintentional_duplicate');
  expect(result.errors[0].slotKey).toBe('left_arm');
});
```

3. **Test: Should warn on intentional override (different parent)**
```javascript
it('should warn when override appears intentional', async () => {
  const context = {
    blueprint: {
      schemaVersion: '2.0',
      _generatedSlots: {
        arm: { parent: 'torso' }
      },
      additionalSlots: {
        arm: { parent: 'shoulder' } // Different parent = intentional
      }
    }
  };

  const result = await validator.validate(context);

  expect(result.isValid).toBe(true); // Warning, not error
  expect(result.warnings[0].type).toBe('intentional_override');
});
```

4. **Test: Should skip V1 blueprints**
```javascript
it('should skip validation for V1 blueprints', async () => {
  const context = {
    blueprint: {
      schemaVersion: '1.0',
      slots: { /* V1 format */ }
    }
  };

  const result = await validator.validate(context);

  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
});
```

### Integration Tests

1. **Test: End-to-end validation catches duplicate slot keys**
   - Create a V2 recipe with duplicate slot keys
   - Run through validation pipeline
   - Verify appropriate error/warning produced

---

## Acceptance Criteria

- [ ] `SlotKeyUniquenessValidator` class created following project patterns
- [ ] Validator registered in `RecipeValidationRunner`
- [ ] Detects unintentional duplicate slot keys (same parent) as errors
- [ ] Detects intentional overrides (different parent) as warnings
- [ ] Detects duplicate parent:socket combinations
- [ ] V1 blueprints gracefully skipped
- [ ] Blueprint loader tracks `_generatedSlots` for V2 blueprints
- [ ] Unit tests cover all scenarios
- [ ] Integration test verifies pipeline behavior
- [ ] All existing tests pass

---

## Dependencies

- ANAGRAGENARCANA-001 and ANAGRAGENARCANA-002 (conceptually related, but can be implemented independently)

---

## Notes

- This validator provides early detection during recipe validation
- Works in conjunction with runtime checks in ANAGRAGENARCANA-001 and ANAGRAGENARCANA-002
- The intentional vs. unintentional distinction helps modders who legitimately need to override
- Consider adding CLI flag to treat warnings as errors for strict validation
