# RECVALREF-011-05: Implement PartAvailabilityValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical)
**Estimated Effort:** 2 hours
**Complexity:** Medium

## Objective

Extract the `#checkPartAvailability` inline method from `RecipePreflightValidator` into a standalone `PartAvailabilityValidator` class extending `BaseValidator`.

## Background

This validator ensures that entity definitions exist for all recipe slots. It uses the `EntityMatcherService` to find matching entities for each slot/pattern configuration.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkPartAvailability` (lines 554-670)

**Logic:**
- Gets all entity definitions from dataRegistry
- For each slot/pattern in recipe, calls `entityMatcherService.findMatchingEntities()`
- Reports errors if no matching entities found
- Includes detailed information about what was searched for

## Implementation Tasks

### 1. Create Validator Class (1 hour)

**File:** `src/anatomy/validation/validators/PartAvailabilityValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates that entity definitions exist for all recipe slots
 *
 * Priority: 25 - After blueprint and descriptor validation
 * Fail Fast: false - Report all missing parts
 */
export class PartAvailabilityValidator extends BaseValidator {
  #dataRegistry;
  #entityMatcherService;

  constructor({ logger, dataRegistry, entityMatcherService }) {
    super({
      name: 'part-availability',
      priority: 25,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAllEntityDefinitions'],
    });

    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: ['findMatchingEntities'],
    });

    this.#dataRegistry = dataRegistry;
    this.#entityMatcherService = entityMatcherService;
  }

  async performValidation(recipe, options, builder) {
    // Extract logic from lines 601-670
    // Use builder.addError() for missing entities
    // Use builder.addPassed() when all slots have matches
  }

  #getSlotIdentifier(slot, index) {
    // Helper to create slot description for error messages
  }

  #formatEntityCriteria(criteria) {
    // Helper to format search criteria for error messages
  }
}
```

**Key Extraction Points:**
- Lines 601-603: Get all entity definitions
- Lines 605-610: Process all slots (both patterns and direct slots)
- Lines 612-646: Call findMatchingEntities for each slot
- Lines 648-666: Error reporting for missing entities
- Lines 668-670: Success message

### 2. Create Unit Tests (1 hour)

**File:** `tests/unit/anatomy/validation/validators/PartAvailabilityValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate dataRegistry dependency
   - Should validate entityMatcherService dependency

2. Basic validation scenarios
   - Should pass when all slots have matching entities
   - Should error when no entities match a slot
   - Should error when multiple slots have no matches
   - Should handle slots with preferId
   - Should handle slots with partType

3. Pattern slot handling
   - Should validate pattern-based slots
   - Should handle patterns with multiple criteria
   - Should handle patterns with no matches

4. Entity matcher integration
   - Should call findMatchingEntities with correct criteria
   - Should handle entityMatcherService returning empty array
   - Should handle entityMatcherService throwing errors

5. Edge cases
   - Should handle recipe with no slots
   - Should handle recipe with empty slots array
   - Should handle slots with partial criteria
   - Should handle entity definitions list being empty

6. Error message formatting
   - Should include slot identifier in error messages
   - Should include search criteria in error messages
   - Should format criteria readably

**Coverage Target:** 80%+ branch coverage

### 3. Integration (Time included above)

**No integration needed yet** - Will be done in RECVALREF-011-10

Verify:
```bash
npm run test:unit -- validators/PartAvailabilityValidator.test.js
```

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - For accessing entity definitions
- `IEntityMatcherService` - For finding matching entities
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation

## Acceptance Criteria

- [ ] PartAvailabilityValidator class created
- [ ] Extends BaseValidator with priority: 25, failFast: false
- [ ] Constructor validates both dataRegistry and entityMatcherService
- [ ] Calls findMatchingEntities correctly for each slot
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Error messages match original format exactly
- [ ] Handles both pattern and direct slots correctly
- [ ] Passed message format matches original
- [ ] ESLint passes on new file

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/PartAvailabilityValidator.test.js

# Check coverage
npm run test:unit -- validators/PartAvailabilityValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/PartAvailabilityValidator.js
```

## Code Reference

**Original Method Location:**
`src/anatomy/validation/RecipePreflightValidator.js:554-670`

**Key Logic to Preserve:**
- Line 601: `getAllEntityDefinitions()`
- Line 608: Process both `recipe.slots` and pattern-generated slots
- Lines 612-646: Entity matching logic
- Line 620: `findMatchingEntities(entityDefs, criteria)`
- Lines 628-644: Error message construction
- Lines 648-666: Aggregated error reporting

**Helper References:**
- `#getSlotIdentifier` logic: Lines 630-633
- Criteria formatting: Lines 638-642

## Critical Notes

- Must handle both direct slots and pattern-based slots
- Uses EntityMatcherService for matching logic (don't reimplement)
- Reports ALL missing parts, not just first (failFast: false)
- Error messages must be descriptive with search criteria

## Success Metrics

- PartAvailabilityValidator: ~150-180 lines
- Test file: ~250-300 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- EntityMatcherService integration preserved
