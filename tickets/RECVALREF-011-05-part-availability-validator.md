# RECVALREF-011-05: Implement PartAvailabilityValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical)
**Estimated Effort:** 2 hours
**Complexity:** Medium

## Objective

Extract the `#checkPartAvailability` inline method from `RecipePreflightValidator` into a standalone `PartAvailabilityValidator` class extending `BaseValidator`.

## Background

This validator ensures that entity definitions exist for all recipe slots. It uses the `EntityMatcherService` to find matching entities for each slot/pattern configuration.

Per the Anatomy System Guide, this work corresponds to Recipe Pre-flight Validation stage 8 (explicit part availability) and must preserve parity with the legacy inline check until the wider RECVALREF-011 plan is complete.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkPartAvailability` (lines 601-670)

**Logic:**
- Calls `this.#dataRegistry.getAll('entityDefinitions')` to load every anatomy part definition currently registered
- Iterates all explicit `recipe.slots` and `recipe.patterns`, calling `entityMatcherService.findMatchingEntities(criteria, allEntityDefs)` for each
- Adds a `PART_UNAVAILABLE` error when no entities match, including `location`, `details`, and the number of definitions checked
- Pushes the success message `{ check: 'part_availability', message: 'All slots and patterns have matching entity definitions' }` when every slot and pattern has at least one match

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
      requiredMethods: ['getAll'],
    });

    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: ['findMatchingEntities'],
    });

    this.#dataRegistry = dataRegistry;
    this.#entityMatcherService = entityMatcherService;
  }

  async performValidation(recipe, options, builder) {
    // Extract logic from lines 601-670
    // Use builder.addIssues([...]) for accumulated PART_UNAVAILABLE errors
    // Use builder.addPassed('All slots and patterns have matching entity definitions', { check: 'part_availability' }) on success
    // Wrap thrown exceptions with builder.addError('VALIDATION_ERROR', 'Failed to validate part availability', { check: 'part_availability', error: error.message })
  }
}
```

**Key Extraction Points:**
- Lines 603-604: Load all entity definitions via `getAll('entityDefinitions')`
- Lines 606-627: Iterate explicit slots and build PART_UNAVAILABLE errors when no matches exist
- Lines 629-650: Repeat the process for recipe patterns
- Lines 653-667: Emit either the success message or the aggregated errors

### 2. Create Unit Tests (1 hour)

**File:** `tests/unit/anatomy/validation/validators/PartAvailabilityValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate that `dataRegistry` exposes `getAll`
   - Should validate that `entityMatcherService` exposes `findMatchingEntities`

2. Basic validation scenarios
   - Should pass when every slot and pattern produces at least one entity
   - Should add a PART_UNAVAILABLE error when a slot has zero matches
   - Should aggregate multiple PART_UNAVAILABLE errors before returning
   - Should respect slot criteria that only include `partType`, `tags`, or `properties`

3. Pattern handling
   - Should invoke `findMatchingEntities` for each pattern entry
   - Should record PART_UNAVAILABLE errors for patterns without matches, including their index

4. Entity matcher integration
   - Should pass the slot/pattern criteria object directly to `findMatchingEntities`
   - Should propagate matcher exceptions by recording the VALIDATION_ERROR block (from the catch path)

5. Edge cases
   - Should treat `recipe.slots` and `recipe.patterns` as optional (missing or empty arrays yield the success message)
   - Should handle the registry returning an empty entity list
   - Should support recipes that only declare slots or only patterns

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
`src/anatomy/validation/RecipePreflightValidator.js:601-670`

**Key Logic to Preserve:**
- Lines 603-604: `const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');`
- Lines 606-627: Iterate explicit slots, calling `findMatchingEntities(slot, allEntityDefs)`
- Lines 629-650: Repeat the matcher call for each pattern index
- Lines 614-648: Build `PART_UNAVAILABLE` errors with `location` and `details.totalEntitiesChecked`
- Lines 653-667: Emit the success message or push accumulated errors, and capture thrown exceptions as `VALIDATION_ERROR`

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
