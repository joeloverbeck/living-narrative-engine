# ANAGRAGENARCANA-005: Create Slot Key Uniqueness Validator

## Metadata
- **ID**: ANAGRAGENARCANA-005
- **Priority**: MEDIUM
- **Severity**: P5
- **Effort**: Medium
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R6
- **Related Issue**: HIGH-01 (No Duplicate Slot Key Validation)
- **Status**: COMPLETED

---

## Assumptions Corrected (2025-12-02)

This ticket's original assumptions about the codebase were incorrect. The following corrections were made before implementation:

| Original Assumption | Actual State | Correction Applied |
|---------------------|--------------|-------------------|
| `BaseRecipeValidator` class exists | Does NOT exist | Use `BaseValidator` |
| `createResult(isValid, errors, warnings)` method | Does NOT exist | Use `builder.addError()`, `builder.addWarning()`, `builder.addPassed()` pattern |
| Static getters `validatorName`, `priority` | Not the pattern | Pass via constructor `super({name, priority, failFast, logger})` |
| `_generatedSlots` tracking exists | Does NOT exist | Added to `blueprintLoader.js` |
| Validator registration: `[..., SlotKeyUniquenessValidator]` | Uses instances | Use `new SlotKeyUniquenessValidator({...})` |
| Recipe validation context has `blueprint` property | Incorrect | Validators receive `recipe`, must fetch blueprint via repository |

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
| `src/anatomy/validation/validators/SlotKeyUniquenessValidator.js` | New file | Create new validator |
| `src/anatomy/validation/RecipeValidationRunner.js` | ~250-265 | Register new validator |
| `src/anatomy/bodyBlueprintFactory/blueprintLoader.js` | 156 | Add `_generatedSlots` tracking |

---

## Implementation Steps (Corrected)

### Step 1: Create SlotKeyUniquenessValidator Class

Create a new validator file:

**File**: `src/anatomy/validation/validators/SlotKeyUniquenessValidator.js`

```javascript
/**
 * @file SlotKeyUniquenessValidator.js
 * @description Validates that slot keys are unique within a blueprint,
 *              detecting accidental overwrites from additionalSlots.
 */

import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates slot key uniqueness in V2 blueprints.
 * Detects when additionalSlots accidentally overwrites generated slots.
 */
export class SlotKeyUniquenessValidator extends BaseValidator {
  #anatomyBlueprintRepository;
  #slotGenerator;
  #dataRegistry;
  #logger;

  constructor({ logger, anatomyBlueprintRepository, slotGenerator, dataRegistry }) {
    super({
      name: 'slot-key-uniqueness',
      priority: 15, // After BlueprintExistenceValidator (10), before socket validators
      failFast: false, // Collect all issues, don't stop early
      logger,
    });

    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint'],
    });
    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: ['generateBlueprintSlots'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });

    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#slotGenerator = slotGenerator;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  async performValidation(recipe, _options, builder) {
    const blueprintId = recipe.blueprintId;
    if (!blueprintId) {
      return; // No blueprint to validate
    }

    const blueprint = this.#anatomyBlueprintRepository.getBlueprint(blueprintId);
    if (!blueprint) {
      return; // Blueprint doesn't exist (handled by BlueprintExistenceValidator)
    }

    // Only validate V2 blueprints with structure templates
    if (blueprint.schemaVersion !== '2.0' || !blueprint.structureTemplate) {
      builder.addPassed('V1 blueprint or no structure template - slot key uniqueness not applicable', {
        check: 'SLOT_KEY_UNIQUENESS_SKIP',
      });
      return;
    }

    // Generate slots from template
    const template = this.#dataRegistry.get('anatomyStructureTemplates', blueprint.structureTemplate);
    if (!template) {
      this.#logger.debug(`SlotKeyUniquenessValidator: Template '${blueprint.structureTemplate}' not found`);
      return;
    }

    const generatedSlots = this.#slotGenerator.generateBlueprintSlots(template) || {};
    const additionalSlots = blueprint.additionalSlots || {};

    // Find conflicting keys
    const generatedSlotKeys = new Set(Object.keys(generatedSlots));
    const collisions = Object.keys(additionalSlots).filter(key => generatedSlotKeys.has(key));

    if (collisions.length === 0) {
      builder.addPassed('No slot key collisions detected', {
        check: 'SLOT_KEY_UNIQUENESS_PASS',
        generatedCount: generatedSlotKeys.size,
        additionalCount: Object.keys(additionalSlots).length,
      });
      return;
    }

    // Categorize collisions
    for (const key of collisions) {
      const generatedSlot = generatedSlots[key];
      const additionalSlot = additionalSlots[key];

      const isIntentional = this.#isIntentionalOverride(generatedSlot, additionalSlot);

      if (isIntentional) {
        builder.addWarning(
          'INTENTIONAL_SLOT_OVERRIDE',
          `Slot '${key}' from additionalSlots overrides generated slot with different parent. ` +
          `This appears intentional.`,
          {
            slotKey: key,
            generatedParent: generatedSlot?.parent,
            overrideParent: additionalSlot?.parent,
          }
        );
      } else {
        builder.addError(
          'UNINTENTIONAL_SLOT_DUPLICATE',
          `Slot key '${key}' appears in both generated slots and additionalSlots with same parent. ` +
          `The additionalSlots version will overwrite the generated one. ` +
          `If intentional, specify a different parent to clarify intent.`,
          {
            slotKey: key,
            parent: generatedSlot?.parent || additionalSlot?.parent,
          }
        );
      }
    }

    // Check for duplicate parent:socket combinations
    this.#checkForDuplicateParentReferences(generatedSlots, additionalSlots, builder);
  }

  #isIntentionalOverride(generatedSlot, additionalSlot) {
    // Different parent = intentional restructuring
    if (generatedSlot?.parent !== additionalSlot?.parent) {
      return true;
    }
    return false;
  }

  #checkForDuplicateParentReferences(generatedSlots, additionalSlots, builder) {
    const allSlots = { ...generatedSlots, ...additionalSlots };
    const parentSocketCombos = new Map();

    for (const [key, slot] of Object.entries(allSlots)) {
      if (!slot?.parent || !slot?.socket) continue;

      const combo = `${slot.parent}:${slot.socket}`;

      if (parentSocketCombos.has(combo)) {
        builder.addWarning(
          'DUPLICATE_PARENT_SOCKET',
          `Slots '${parentSocketCombos.get(combo)}' and '${key}' both attach to ` +
          `parent '${slot.parent}' via socket '${slot.socket}'. ` +
          `Only one child can occupy each socket.`,
          {
            slotKeys: [parentSocketCombos.get(combo), key],
            parent: slot.parent,
            socket: slot.socket,
          }
        );
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
// In RecipeValidationRunner.js - add import
import { SlotKeyUniquenessValidator } from './validators/SlotKeyUniquenessValidator.js';

// In #createValidatorRegistry() - add to validatorInstances array
validators.slotKeyUniqueness ??
  new SlotKeyUniquenessValidator({
    logger: this.#logger,
    anatomyBlueprintRepository,
    slotGenerator,
    dataRegistry,
  }),
```

### Step 3: Add Generated Slots Tracking to Blueprint Loader

Update `blueprintLoader.js` to track generated slots for debugging:

```javascript
// In processV2Blueprint() return statement (line ~156)
return {
  ...blueprint,
  slots: { ...generatedSlots, ...additionalSlots },
  _generatedSockets: generatedSockets,
  _generatedSlots: generatedSlots,  // NEW: Track for validation/debugging
};
```

---

## Testing Requirements

### Unit Tests

Create tests in `tests/unit/anatomy/validation/validators/SlotKeyUniquenessValidator.test.js`:

1. **Test: Constructor validation** - Throws on missing dependencies
2. **Test: Skip V1 blueprints** - Returns valid with passed message
3. **Test: Pass unique slots** - No errors when all slot keys unique
4. **Test: Error on unintentional duplicate** - Same parent = error
5. **Test: Warning on intentional override** - Different parent = warning only
6. **Test: Detect duplicate parent:socket combinations** - Warning produced
7. **Test: Handle missing template gracefully**
8. **Test: Handle empty additionalSlots**

### Integration Tests

1. **Test: End-to-end validation catches duplicate slot keys**
   - Create a V2 recipe with duplicate slot keys
   - Run through validation pipeline
   - Verify appropriate error/warning produced

---

## Acceptance Criteria

- [x] `SlotKeyUniquenessValidator` class created following project patterns
- [x] Validator registered in `RecipeValidationRunner`
- [x] Detects unintentional duplicate slot keys (same parent) as errors
- [x] Detects intentional overrides (different parent) as warnings
- [x] Detects duplicate parent:socket combinations
- [x] V1 blueprints gracefully skipped
- [x] Blueprint loader tracks `_generatedSlots` for V2 blueprints
- [x] Unit tests cover all scenarios
- [x] All existing tests pass

---

## Dependencies

- ANAGRAGENARCANA-001 and ANAGRAGENARCANA-002 (conceptually related, but can be implemented independently)

---

## Notes

- This validator provides early detection during recipe validation
- Works in conjunction with runtime checks in ANAGRAGENARCANA-001 and ANAGRAGENARCANA-002
- The intentional vs. unintentional distinction helps modders who legitimately need to override
- Consider adding CLI flag to treat warnings as errors for strict validation

---

## Outcome (2025-12-02)

### What Was Actually Changed vs Originally Planned

| Planned | Actual | Notes |
|---------|--------|-------|
| Create `SlotKeyUniquenessValidator` class | ✅ Created | Follows `BaseValidator` pattern (ticket corrected) |
| Register in `RecipeValidationRunner` | ✅ Registered | Lines 22, 234-240 |
| Add `_generatedSlots` tracking to `blueprintLoader.js` | ✅ Added | Line 157 |
| Create unit tests | ✅ Created | 24 tests in `SlotKeyUniquenessValidator.test.js` |

### Implementation Details

**Files Created:**
- `src/anatomy/validation/validators/SlotKeyUniquenessValidator.js` (203 lines)
- `tests/unit/anatomy/validation/validators/SlotKeyUniquenessValidator.test.js` (557 lines)

**Files Modified:**
- `src/anatomy/validation/RecipeValidationRunner.js` (+8 lines: import and registration)
- `src/anatomy/bodyBlueprintFactory/blueprintLoader.js` (+1 line: `_generatedSlots` tracking)

### Bug Fix During Implementation

During test development, discovered that `#checkForDuplicateParentReferences` was not being called when there were no key collisions (early return at line 113). Fixed by adding the check before the early return.

### Test Coverage

- 24 unit tests covering:
  - Constructor validation (5 tests)
  - Skip conditions (5 tests)
  - Unique slot key pass scenarios (3 tests)
  - Unintentional duplicate detection (2 tests)
  - Intentional override detection (2 tests)
  - Duplicate parent:socket detection (3 tests)
  - Edge cases (2 tests)
  - Error message quality (2 tests)

### Verification

- All 24 new tests pass
- All 699 existing anatomy validation tests pass
- All 3721 anatomy unit tests pass
- ESLint: 0 errors (2 minor JSDoc warnings matching existing validators)
