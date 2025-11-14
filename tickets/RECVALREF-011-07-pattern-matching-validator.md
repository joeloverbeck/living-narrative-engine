# RECVALREF-011-07: Implement PatternMatchingValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P1 (High Priority - Warnings)
**Estimated Effort:** 2.5 hours
**Complexity:** Medium-High

## Objective

Migrate the external `validatePatternMatching` function from `patternMatchingValidator.js` into a standalone `PatternMatchingValidator` class extending `BaseValidator`.

## Background

This validator performs dry-run pattern matching to detect patterns that would match zero slots. It helps mod developers identify problematic pattern configurations before runtime.

## Current Implementation

**Location:** `src/anatomy/validation/patternMatchingValidator.js`

**Functions:**
- `validatePatternMatching(recipe, blueprint, dataRegistry, slotGenerator, logger)` (main)
- `findMatchingSlots(pattern, blueprint, slotGenerator)` (helper)
- `getPatternDescription(pattern)` (helper - also used by GeneratedSlotPartsValidator)

**Logic:**
- Gets processed blueprint (calls ensureBlueprintProcessed)
- For each pattern in recipe, finds matching slots
- Reports warnings for patterns with zero matches
- Provides helpful pattern descriptions

## Implementation Tasks

### 1. Create Blueprint Processing Utility (30 min)

**First, extract shared utility:**

**File:** `src/anatomy/validation/utils/blueprintProcessingUtils.js`

```javascript
/**
 * Blueprint processing utilities shared by validators
 */

/**
 * Ensures blueprint is processed (V2 compatibility)
 *
 * @param {object} blueprint - Blueprint to process
 * @returns {object} Processed blueprint
 */
export function ensureBlueprintProcessed(blueprint) {
  // Extract from RecipePreflightValidator.js lines 411-456
  // This is used by both PatternMatchingValidator and GeneratedSlotPartsValidator
}
```

### 2. Create Validator Class (1.5 hours)

**File:** `src/anatomy/validation/validators/PatternMatchingValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureBlueprintProcessed } from '../utils/blueprintProcessingUtils.js';

/**
 * Validates pattern matching by dry-run to detect zero-match patterns
 *
 * Priority: 35 - Warnings only, after critical validations
 * Fail Fast: false - Report all problematic patterns
 */
export class PatternMatchingValidator extends BaseValidator {
  #dataRegistry;
  #slotGenerator;
  #anatomyBlueprintRepository;

  constructor({ logger, dataRegistry, slotGenerator, anatomyBlueprintRepository }) {
    super({
      name: 'pattern-matching',
      priority: 35,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getComponent'],
    });

    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: ['extractSlotsFromBlueprint'],
    });

    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint'],
    });

    this.#dataRegistry = dataRegistry;
    this.#slotGenerator = slotGenerator;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
  }

  async performValidation(recipe, options, builder) {
    // Get and process blueprint
    const blueprint = await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

    if (!blueprint) {
      return; // Skip if blueprint missing (validated elsewhere)
    }

    const processedBlueprint = ensureBlueprintProcessed(blueprint);

    // Migrate logic from validatePatternMatching function
    // Use builder.addWarning() for zero-match patterns
    // Use builder.addPassed() when all patterns match
  }

  #findMatchingSlots(pattern, blueprint) {
    // Migrate from external helper function
  }

  #getPatternDescription(pattern) {
    // Migrate from external helper function
    // Also export this utility for use by GeneratedSlotPartsValidator
  }
}

// Export utility for use by other validators
export { getPatternDescription } from './PatternMatchingValidator.js';
```

**Key Migration Points:**
- External function `validatePatternMatching` → `performValidation`
- Helper `findMatchingSlots` → private method
- Helper `getPatternDescription` → private method + export for reuse
- Blueprint processing using shared utility

### 3. Create Unit Tests (30 min)

**File:** `tests/unit/anatomy/validation/validators/PatternMatchingValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate all dependencies (dataRegistry, slotGenerator, anatomyBlueprintRepository)

2. Basic validation scenarios
   - Should pass when all patterns match slots
   - Should warn when pattern matches zero slots
   - Should warn for multiple zero-match patterns
   - Should handle recipe with no patterns

3. Pattern matching logic
   - Should find slots matching pattern criteria
   - Should handle complex pattern criteria
   - Should handle patterns with multiple conditions
   - Should use slotGenerator correctly

4. Blueprint processing
   - Should process V2 blueprints correctly
   - Should skip if blueprint is null
   - Should handle blueprint processing errors

5. Pattern descriptions
   - Should generate readable pattern descriptions
   - Should handle patterns with slotName
   - Should handle patterns with partType
   - Should handle patterns with multiple criteria

6. Edge cases
   - Should handle empty patterns array
   - Should handle malformed patterns
   - Should handle blueprint with no slots

**Coverage Target:** 80%+ branch coverage

### 4. Deprecate Old File (Included in integration ticket)

**Action:** Mark `src/anatomy/validation/patternMatchingValidator.js` for deletion in RECVALREF-011-10

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - For component access
- `ISlotGenerator` - For slot extraction
- `IAnatomyBlueprintRepository` - For loading blueprints
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation
- `blueprintProcessingUtils` - Shared blueprint processing

## Acceptance Criteria

- [ ] blueprintProcessingUtils.js created with ensureBlueprintProcessed
- [ ] PatternMatchingValidator class created
- [ ] Extends BaseValidator with priority: 35, failFast: false
- [ ] All logic from external function migrated
- [ ] Helper functions migrated as private methods
- [ ] getPatternDescription exported for reuse
- [ ] Constructor validates all dependencies
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Warning messages match original format exactly
- [ ] Blueprint processing uses shared utility
- [ ] ESLint passes on new files

## Testing Commands

```bash
# Run utility tests (if created)
npm run test:unit -- validation/utils/blueprintProcessingUtils.test.js

# Run validator tests
npm run test:unit -- validators/PatternMatchingValidator.test.js

# Check coverage
npm run test:unit -- validators/PatternMatchingValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/PatternMatchingValidator.js
npx eslint src/anatomy/validation/utils/blueprintProcessingUtils.js
```

## Code Reference

**Original File:**
`src/anatomy/validation/patternMatchingValidator.js`

**Functions to Migrate:**
- `validatePatternMatching(recipe, blueprint, dataRegistry, slotGenerator, logger)`
- `findMatchingSlots(pattern, blueprint, slotGenerator)`
- `getPatternDescription(pattern)` (export for reuse)

**Blueprint Processing Source:**
`RecipePreflightValidator.js:411-456` (#ensureBlueprintProcessed)

**Usage Sites:**
- RecipePreflightValidator line 130: Import
- RecipePreflightValidator line 480-511: Call site
- GeneratedSlotPartsValidator will use getPatternDescription

## Critical Notes

- Creates shared blueprint processing utility (DRY principle)
- Warnings only (not errors) - helps developers but doesn't block
- Pattern matching is dry-run (doesn't generate actual slots)
- getPatternDescription must be accessible to GeneratedSlotPartsValidator

## Success Metrics

- blueprintProcessingUtils.js: ~60-80 lines
- PatternMatchingValidator: ~180-220 lines
- Test file: ~250-300 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- Shared utility reduces duplication
