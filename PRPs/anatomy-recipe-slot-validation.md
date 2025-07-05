name: "Anatomy Recipe Slot Validation - Fix Silent Failures"
description: |

## Purpose
Fix a critical bug in the anatomy system where recipe slot overrides fail silently when they reference non-existent blueprint slots. This PRP provides comprehensive context for implementing validation that ensures recipe slots match blueprint slots and throws appropriate errors when mismatches occur.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Implement validation in the anatomy recipe processing system to detect when recipe slot overrides reference non-existent blueprint slots, throw ValidationError with clear messaging, and dispatch SYSTEM_ERROR_OCCURRED_ID events. Currently, these mismatches fail silently, leading to unexpected behavior where recipe overrides are ignored without warning.

## Why
- **Developer Experience**: Recipe authors get immediate feedback when they make typos or use incorrect slot keys
- **Debugging**: Silent failures make it extremely difficult to understand why recipe overrides aren't working
- **Data Integrity**: Ensures all recipe data is valid and references correct blueprint slots
- **System Reliability**: Prevents unexpected anatomy generation results due to ignored overrides

## What
When a recipe defines slot overrides, the system must validate that each slot key in the recipe exists in the corresponding blueprint. If any slot key doesn't exist, the system should:
1. Throw a ValidationError with a clear message indicating which slot key is invalid
2. Dispatch a SYSTEM_ERROR_OCCURRED_ID event with detailed context
3. Prevent anatomy generation from proceeding with invalid data

### Success Criteria
- [ ] Recipe slot keys are validated against blueprint slots before processing
- [ ] Invalid slot keys throw ValidationError with descriptive messages
- [ ] SYSTEM_ERROR_OCCURRED_ID events are dispatched with full context
- [ ] Integration tests prove the validation behavior
- [ ] All existing tests continue to pass

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: src/anatomy/bodyBlueprintFactory.js
  why: Main file where recipes are applied to blueprints - this is where validation should be added
  critical: Look at #processBlueprintSlots() method line 244 and #loadBlueprint() method line 226
  
- file: src/anatomy/recipeProcessor.js
  why: Handles recipe loading and processing - understand the data flow
  critical: mergeSlotRequirements() at line 124 shows how recipe slots override blueprint requirements
  
- file: data/schemas/anatomy.blueprint.schema.json
  why: Blueprint schema showing that slots are keyed by slot name (not socket name)
  critical: Blueprint slots object at line 21-27 contains the valid slot keys
  
- file: data/schemas/anatomy.recipe.schema.json  
  why: Recipe schema showing how slots are defined
  critical: Recipe slots object at line 21-27 must have keys matching blueprint slots

- file: tests/integration/anatomy/errorHandling.integration.test.js
  why: Existing error handling test patterns to follow
  critical: Shows how to test for ValidationError and proper error messages

- file: src/constants/systemEventIds.js
  why: Contains SYSTEM_ERROR_OCCURRED_ID constant
  critical: Use exactly: SYSTEM_ERROR_OCCURRED_ID = 'core:system_error_occurred'

- example_issue: .private/data/mods/p_erotica/recipes/amaia_castillo.recipe.json
  why: Recipe that expects "scalp" slot but blueprint has "hair" slot
  critical: This demonstrates the exact bug - recipe uses wrong slot key

- example_blueprint: data/mods/anatomy/blueprints/human_female.blueprint.json
  why: Shows actual blueprint slot structure
  critical: Line 89-96 shows slot key is "hair" (not "scalp") attached to socket "scalp"
```

### Current Codebase tree (relevant parts)
```bash
src/
├── anatomy/
│   ├── bodyBlueprintFactory.js         # Main file to modify
│   ├── recipeProcessor.js               # Understand recipe data flow
│   └── ...
├── constants/
│   └── systemEventIds.js                # Has SYSTEM_ERROR_OCCURRED_ID
└── errors/
    └── validationError.js               # Error type to throw

tests/
└── integration/
    └── anatomy/
        ├── errorHandling.integration.test.js  # Test pattern to follow
        └── ...
```

### Desired Codebase tree with files to be added
```bash
tests/
└── integration/
    └── anatomy/
        ├── recipeSlotValidation.integration.test.js  # New test file
        └── ...
```

### Known Gotchas of our codebase & Library Quirks
```javascript
// CRITICAL: Blueprint slot keys are NOT the same as socket names!
// Example: slot key "hair" attaches to socket "scalp" on the head
// Recipe authors often confuse these

// CRITICAL: Recipe processing happens in two places:
// 1. recipeProcessor.processRecipe() - expands patterns but doesn't validate slots
// 2. bodyBlueprintFactory.#processBlueprintSlots() - applies recipe to blueprint

// CRITICAL: Error handling pattern must include eventDispatcher
// Always dispatch SYSTEM_ERROR_OCCURRED_ID before throwing
```

## Implementation Blueprint

### Data models and structure
The validation needs to check that all keys in `recipe.slots` exist as keys in `blueprint.slots`.

### List of tasks to be completed in order

```yaml
Task 1: Add recipe slot validation method to BodyBlueprintFactory
MODIFY src/anatomy/bodyBlueprintFactory.js:
  - ADD new private method #validateRecipeSlots(recipe, blueprint) after line 217
  - Method should iterate through recipe.slots keys
  - Check each key exists in blueprint.slots
  - Collect all invalid keys
  - If any invalid keys found, dispatch error event and throw ValidationError

Task 2: Call validation in createAnatomyGraph method
MODIFY src/anatomy/bodyBlueprintFactory.js:
  - FIND line 134 where processedRecipe is created
  - ADD validation call after recipe is processed but before context initialization
  - Pass both processedRecipe and blueprint to validation method

Task 3: Create integration test suite for recipe slot validation
CREATE tests/integration/anatomy/recipeSlotValidation.integration.test.js:
  - MIRROR pattern from: tests/integration/anatomy/errorHandling.integration.test.js
  - Test invalid slot key throws ValidationError
  - Test valid recipes continue to work
  - Test error message contains specific invalid keys
  - Test SYSTEM_ERROR_OCCURRED_ID is dispatched

Task 4: Update existing tests if needed
CHECK tests/integration/anatomy/:
  - Run all anatomy integration tests
  - Fix any that fail due to new validation
  - Some test recipes might have invalid slots that need fixing
```

### Per task pseudocode

#### Task 1 Pseudocode:
```javascript
// Add after line 217 in bodyBlueprintFactory.js
#validateRecipeSlots(recipe, blueprint) {
  // Skip if no slots in recipe
  if (!recipe.slots || Object.keys(recipe.slots).length === 0) return;
  
  // Collect invalid slot keys
  const invalidSlotKeys = [];
  for (const slotKey of Object.keys(recipe.slots)) {
    if (!blueprint.slots || !blueprint.slots[slotKey]) {
      invalidSlotKeys.push(slotKey);
    }
  }
  
  // If any invalid keys, dispatch error and throw
  if (invalidSlotKeys.length > 0) {
    const errorMessage = `Recipe '${recipe.recipeId}' contains invalid slot keys that don't exist in blueprint '${blueprint.id}': ${invalidSlotKeys.join(', ')}`;
    
    // Dispatch system error with full context
    this.#eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: errorMessage,
      details: {
        raw: JSON.stringify({
          recipeId: recipe.recipeId,
          blueprintId: blueprint.id,
          invalidSlotKeys,
          validSlotKeys: Object.keys(blueprint.slots || {}),
          context: 'BodyBlueprintFactory.validateRecipeSlots'
        })
      }
    });
    
    throw new ValidationError(errorMessage);
  }
}
```

#### Task 2 Pseudocode:
```javascript
// In createAnatomyGraph method, after line 134
const processedRecipe = this.#recipeProcessor.processRecipe(recipe);

// Add validation here
this.#validateRecipeSlots(processedRecipe, blueprint);

// Then continue with context initialization...
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors in the files you've modified before proceeding
npm run lint # Auto-fix what's possible

# Expected: No errors in the files you've modified. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```bash
# Run ALL tests to ensure nothing broke:
npm run test

# Run specific anatomy integration tests:
npm test -- tests/integration/anatomy/

# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Verify the fix works
```bash
# Test with the problematic recipe that has "scalp" instead of "hair"
# This should now throw a clear error instead of failing silently
```

## Final validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors in modified files: `npm run lint`
- [ ] New validation catches invalid slot keys and throws clear errors
- [ ] SYSTEM_ERROR_OCCURRED_ID events are dispatched with full context
- [ ] Error messages clearly indicate which slot keys are invalid
- [ ] Integration tests prove the validation behavior

---

## Anti-Patterns to Avoid
- ❌ Don't validate in recipeProcessor - it doesn't have blueprint context
- ❌ Don't modify recipe data - only validate and throw errors
- ❌ Don't forget to dispatch SYSTEM_ERROR_OCCURRED_ID before throwing
- ❌ Don't use generic error messages - be specific about invalid keys
- ❌ Don't break existing valid recipes - only catch actual mismatches
- ❌ Don't validate patterns - they get expanded into slots later

## Confidence Score: 9/10
High confidence due to:
- Clear bug reproduction case
- Well-defined validation point in code
- Existing error handling patterns to follow
- Comprehensive test examples available
- Simple validation logic required