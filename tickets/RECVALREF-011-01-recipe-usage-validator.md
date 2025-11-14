# RECVALREF-011-01: Implement RecipeUsageValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P1 (High Priority)
**Estimated Effort:** 1.5 hours
**Complexity:** Low

## Objective

Extract the `#checkRecipeUsage` inline method from `RecipePreflightValidator` into a standalone `RecipeUsageValidator` class extending `BaseValidator`.

## Background

This is the simplest validator in the refactoring effort, making it an ideal starting point. It verifies that entity definitions actually reference the recipe being validated.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkRecipeUsage` (lines 1022-1061)
**Logic:**
- Gets all entity definitions from dataRegistry
- Finds definitions where `anatomy:body.recipeId === recipe.recipeId`
- Reports warning if no references found
- Reports passed with count if references exist

## Implementation Tasks

### 1. Create Validator Class (45 min)

**File:** `src/anatomy/validation/validators/RecipeUsageValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates that entity definitions reference this recipe
 *
 * Priority: 60 - Informational check
 * Fail Fast: false - Warning only, doesn't block other validations
 */
export class RecipeUsageValidator extends BaseValidator {
  #dataRegistry;

  constructor({ logger, dataRegistry }) {
    super({
      name: 'recipe-usage',
      priority: 60,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAllEntityDefinitions'],
    });

    this.#dataRegistry = dataRegistry;
  }

  async performValidation(recipe, options, builder) {
    // Extract logic from lines 1022-1061
    // Use builder.addWarning() for no references
    // Use builder.addPassed() with count for references found
  }
}
```

**Key Extraction Points:**
- Line 1026-1029: Get all entity definitions
- Line 1033-1035: Filter by recipeId match
- Line 1037-1044: Warning for no references
- Line 1046-1058: Passed message with count

### 2. Create Unit Tests (45 min)

**File:** `tests/unit/anatomy/validation/validators/RecipeUsageValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct name, priority, failFast
   - Should validate dataRegistry dependency
   - Should throw on missing logger
   - Should throw on invalid dataRegistry

2. Validation scenarios
   - Should pass when entities reference the recipe
   - Should warn when no entities reference the recipe
   - Should handle multiple entity references correctly
   - Should handle entities with missing anatomy:body component
   - Should handle entities with null recipeId

3. Edge cases
   - Should handle empty entity definitions list
   - Should handle entities with malformed anatomy:body

**Coverage Target:** 80%+ branch coverage

### 3. Integration (15 min)

**No integration needed yet** - This will be done in RECVALREF-011-10 (Integration ticket)

However, verify the validator works by:
```bash
npm run test:unit -- validators/RecipeUsageValidator.test.js
```

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - For accessing entity definitions
- `ILogger` - For logging (inherited from BaseValidator)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation utility

## Acceptance Criteria

- [ ] RecipeUsageValidator class created in `src/anatomy/validation/validators/`
- [ ] Extends BaseValidator with correct configuration (priority: 60, failFast: false)
- [ ] Constructor validates dataRegistry dependency
- [ ] `performValidation` method extracts exact logic from original method
- [ ] Unit tests created with 80%+ branch coverage
- [ ] All test scenarios pass
- [ ] Warning message format matches original exactly
- [ ] Passed message format matches original exactly
- [ ] ESLint passes: `npx eslint src/anatomy/validation/validators/RecipeUsageValidator.js`

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/RecipeUsageValidator.test.js

# Check coverage
npm run test:unit -- validators/RecipeUsageValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/RecipeUsageValidator.js
```

## Code Reference

**Original Method Location:**
`src/anatomy/validation/RecipePreflightValidator.js:1022-1061`

**Key Logic to Preserve:**
- Line 1033: `entityDef.components['anatomy:body']?.recipeId === recipe.recipeId`
- Line 1038: Warning message format
- Line 1048: Passed message format with count

## Notes

- This validator is informational only (warnings, not errors)
- No fail-fast behavior (other validators continue regardless)
- Simple logic makes it ideal for establishing the refactoring pattern
- Sets the template for subsequent validator implementations

## Success Metrics

- RecipeUsageValidator: ~80-100 lines (including JSDoc)
- Test file: ~150-200 lines
- Branch coverage: 80%+
- Zero behavior changes from original implementation
