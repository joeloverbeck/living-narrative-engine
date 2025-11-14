# RECVALREF-011-03: Implement BlueprintExistenceValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical - Fail Fast)
**Estimated Effort:** 1.5 hours
**Complexity:** Low

## Objective

Extract the `#checkBlueprintExists` inline method from `RecipePreflightValidator` into a standalone `BlueprintExistenceValidator` class extending `BaseValidator`.

## Background

This is a critical fail-fast validator that must run first (priority 10). If the blueprint doesn't exist, all subsequent validations that depend on the blueprint should be skipped.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkBlueprintExists` (lines 341-370)

**Logic:**
- Attempts to load blueprint using `anatomyBlueprintRepository.getBlueprint(recipe.blueprintId)`
- Returns error if blueprint is null
- Returns passed with blueprint metadata if found
- **Critical:** This validator's result determines if blueprint-dependent validators run

## Implementation Tasks

### 1. Create Validator Class (45 min)

**File:** `src/anatomy/validation/validators/BlueprintExistenceValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates that the blueprint referenced by recipe exists and loads successfully
 *
 * Priority: 10 - Must run before all blueprint-dependent validators
 * Fail Fast: true - Critical failure stops pipeline immediately
 */
export class BlueprintExistenceValidator extends BaseValidator {
  #anatomyBlueprintRepository;

  constructor({ logger, anatomyBlueprintRepository }) {
    super({
      name: 'blueprint-existence',
      priority: 10,
      failFast: true,  // CRITICAL: Stop if blueprint missing
      logger,
    });

    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint'],
    });

    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
  }

  async performValidation(recipe, options, builder) {
    // Extract logic from lines 341-370
    // Use builder.addError() if blueprint is null
    // Use builder.addPassed() with blueprint info if found
  }
}
```

**Key Extraction Points:**
- Line 347: `await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId)`
- Line 349-357: Error handling for null blueprint
- Line 359-368: Success message with blueprint metadata

### 2. Create Unit Tests (45 min)

**File:** `tests/unit/anatomy/validation/validators/BlueprintExistenceValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration (priority: 10, failFast: true)
   - Should validate anatomyBlueprintRepository dependency
   - Should throw on missing logger
   - Should throw on invalid anatomyBlueprintRepository

2. Validation scenarios
   - Should pass when blueprint exists
   - Should error when blueprint is null (not found)
   - Should error when blueprint loading throws exception
   - Should include blueprint metadata in passed message
   - Should include blueprintId in error message

3. Fail-fast behavior
   - Should set failFast to true in constructor
   - Should return isValid: false when blueprint missing

4. Edge cases
   - Should handle recipe with missing blueprintId
   - Should handle repository throwing unexpected errors
   - Should handle blueprint with minimal metadata

**Coverage Target:** 80%+ branch coverage

### 3. Integration (15 min)

**No integration needed yet** - Will be done in RECVALREF-011-10

Verify:
```bash
npm run test:unit -- validators/BlueprintExistenceValidator.test.js
```

## Dependencies

**Service Dependencies:**
- `IAnatomyBlueprintRepository` - For loading blueprints
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation

## Acceptance Criteria

- [ ] BlueprintExistenceValidator class created
- [ ] Extends BaseValidator with priority: 10, failFast: true
- [ ] Constructor validates anatomyBlueprintRepository dependency
- [ ] `performValidation` calls `getBlueprint` and handles null correctly
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Error message format matches original exactly
- [ ] Passed message includes blueprint metadata
- [ ] Fail-fast behavior correctly set
- [ ] ESLint passes on new file

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/BlueprintExistenceValidator.test.js

# Check coverage
npm run test:unit -- validators/BlueprintExistenceValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/BlueprintExistenceValidator.js
```

## Code Reference

**Original Method Location:**
`src/anatomy/validation/RecipePreflightValidator.js:341-370`

**Key Logic to Preserve:**
- Line 347: Async blueprint loading
- Line 349: Null check for missing blueprint
- Line 350-355: Error message construction with blueprintId
- Line 360-366: Success message with blueprint.version, blueprint.description

## Critical Notes

- **FAIL FAST**: This validator MUST have `failFast: true`
- **PRIORITY 10**: Lowest priority number = runs first
- **Blocks Pipeline**: If this fails, blueprint-dependent validators should not run
- This is the gatekeeper for all blueprint-based validation

## Success Metrics

- BlueprintExistenceValidator: ~80-100 lines
- Test file: ~150-200 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- Fail-fast behavior correctly implemented
