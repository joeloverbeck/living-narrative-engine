# RECVALREF-011-02: Implement DescriptorCoverageValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P2 (Medium Priority)
**Estimated Effort:** 2 hours
**Complexity:** Low-Medium

## Objective

Extract the `#checkDescriptorCoverage` inline method (and helper methods) from `RecipePreflightValidator` into a standalone `DescriptorCoverageValidator` class extending `BaseValidator`.

## Background

This validator suggests body descriptors that could enhance the recipe. It's a suggestion-only validator that helps mod developers improve their character anatomy definitions. Descriptor components live under the `descriptors:*` namespace defined in the anatomy system docs, and missing components mean a part will never surface in the generated description output.

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`

**Primary Method:** `#checkDescriptorCoverage` (lines 513-563)

**Helper Methods:**
- `#hasDescriptorComponents` (lines 565-567)
- `#preferredEntityHasDescriptors` (lines 576-599)

**Logic:**
- Iterates over every slot declared in the recipe and inspects `slot.properties`
- Checks whether any property/component keys start with the `descriptors:` prefix
- If the slot itself lacks descriptor components, looks up the `preferId` entity via `dataRegistry.getAll('entityDefinitions')` and inspects that entity's components for descriptor coverage
- Adds a suggestion when neither the slot nor its preferred entity provide descriptors; records a passed check otherwise

## Implementation Tasks

### 1. Create Validator Class (1 hour)

**File:** `src/anatomy/validation/validators/DescriptorCoverageValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Suggests body descriptors that could enhance recipe
 *
 * Priority: 40 - Suggestions only
 * Fail Fast: false - Advisory only, doesn't block other validations
 */
export class DescriptorCoverageValidator extends BaseValidator {
  #dataRegistry;

  constructor({ logger, dataRegistry }) {
    super({
      name: 'descriptor-coverage',
      priority: 40,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAll'],
    });

    this.#dataRegistry = dataRegistry;
  }

  async performValidation(recipe, options, builder) {
    // Extract logic from lines 513-563
    // Iterate only over recipe slots (patterns are not part of the current check)
    // Use builder.addSuggestion() for descriptor recommendations
    // Use builder.addPassed() if coverage is good
  }

  #hasDescriptorComponents(tags) {
    // Extract from lines 565-567 (expects an array of component/property keys)
  }

  #preferredEntityHasDescriptors(entityId) {
    // Extract from lines 576-599 (calls dataRegistry.getAll('entityDefinitions'))
  }
}
```

**Key Extraction Points:**
- Lines 520-549: Loop through slots and compute descriptor presence
- Lines 522-532: Check for descriptor components in `slot.properties`
- Lines 526-533 & 576-592: Fallback to preferred entity descriptor detection via data registry
- Lines 534-557: Generate suggestion or passed messages

### 2. Create Unit Tests (45 min)

**File:** `tests/unit/anatomy/validation/validators/DescriptorCoverageValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate dataRegistry dependency

2. Main validation scenarios
  - Should pass when all slots have descriptor components
  - Should suggest when slot lacks descriptors but preferId has them
  - Should suggest when neither slot nor preferId have descriptors
  - Should handle slots without properties correctly (empty object)
  - Should handle recipes without slots (no suggestions, passed message)

3. Helper method tests: `#hasDescriptorComponents`
   - Should return true when tags contain descriptor components
   - Should return false when no descriptor components
   - Should handle undefined/null tags
   - Should handle empty tags array

4. Helper method tests: `#preferredEntityHasDescriptors`
  - Should return true when preferred entity has descriptors (based on component IDs)
  - Should return false when no descriptors
  - Should handle missing entity definition (dataRegistry returns array without matching id)
  - Should handle entity without descriptor components despite having other anatomy data

5. Edge cases
   - Should handle recipes with mixed slot types (with/without descriptors)
   - Should handle malformed component data
   - Should handle dataRegistry.getAll throwing or returning non-array values

**Coverage Target:** 80%+ branch coverage

### 3. Integration (15 min)

**No integration needed yet** - Will be done in RECVALREF-011-10

Verify:
```bash
npm run test:unit -- validators/DescriptorCoverageValidator.test.js
```

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - Must expose `getAll('entityDefinitions')` for scanning entity component IDs
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation

## Acceptance Criteria

- [ ] DescriptorCoverageValidator class created
- [ ] Extends BaseValidator with correct configuration (priority: 40, failFast: false)
- [ ] All three methods extracted: performValidation, #hasDescriptorComponents, #preferredEntityHasDescriptors
- [ ] Constructor validates dataRegistry dependency
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Suggestion message format matches original exactly
- [ ] Passed message format matches original exactly
- [ ] Helper methods behave identically to original
- [ ] ESLint passes on new file

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/DescriptorCoverageValidator.test.js

# Check coverage
npm run test:unit -- validators/DescriptorCoverageValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/DescriptorCoverageValidator.js
```

## Code Reference

**Original Method Locations:**
- Primary: `RecipePreflightValidator.js:513-563`
- Helper 1: `RecipePreflightValidator.js:565-567`
- Helper 2: `RecipePreflightValidator.js:576-599`

**Key Logic to Preserve:**
- Line 526: `tags.some(tag => tag.startsWith('descriptors:'))`
- Line 534: Check preferId entity for descriptors
- Line 545-558: Suggestion message construction

## Notes

- This validator only generates suggestions, never errors or warnings
- Helps improve mod quality but doesn't block validation
- Uses descriptor component tags to determine coverage
- Two-level check: slot properties → preferId entity

## Success Metrics

- DescriptorCoverageValidator: ~120-150 lines
- Test file: ~200-250 lines
- Branch coverage: 80%+
- Zero behavior changes from original
