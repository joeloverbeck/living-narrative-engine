# RECVALREF-011-04: Implement RecipeBodyDescriptorValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical)
**Estimated Effort:** 2.5 hours
**Complexity:** Medium

## Objective

Extract the `#checkBodyDescriptors` inline method from `RecipePreflightValidator` into a standalone `RecipeBodyDescriptorValidator` class extending `BaseValidator`.

## Background

This validator validates recipe bodyDescriptors against the `anatomy:body` component schema. It's DISTINCT from the existing `src/anatomy/validators/bodyDescriptorValidator.js` (which validates system/registry consistency).

**Important Naming:**
- **RecipeBodyDescriptorValidator** (this ticket) - Validates recipe descriptors against component schema
- **BodyDescriptorValidator** (existing) - Validates system registry consistency

## Current Implementation

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`
**Method:** `#checkBodyDescriptors` (lines 235-335)

**Logic:**
- Gets `anatomy:body` component from dataRegistry
- Extracts descriptorsSchema from component.dataSchema.properties.body.properties.descriptors
- Validates each bodyDescriptor field against schema properties
- Checks enum values and types
- Reports errors for invalid descriptors

## Implementation Tasks

### 1. Create Validator Class (1.5 hours)

**File:** `src/anatomy/validation/validators/RecipeBodyDescriptorValidator.js`

**Structure:**
```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates recipe bodyDescriptors against anatomy:body component schema
 *
 * DISTINCT from src/anatomy/validators/bodyDescriptorValidator.js
 * - This validator: Recipe-level schema validation
 * - System validator: Registry consistency validation
 *
 * Priority: 15 - Early validation of recipe structure
 * Fail Fast: false - Report all descriptor issues
 */
export class RecipeBodyDescriptorValidator extends BaseValidator {
  #dataRegistry;

  constructor({ logger, dataRegistry }) {
    super({
      name: 'recipe-body-descriptor',
      priority: 15,
      failFast: false,
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getComponent'],
    });

    this.#dataRegistry = dataRegistry;
  }

  async performValidation(recipe, options, builder) {
    // Extract logic from lines 235-335
    // Use builder.addError() for invalid descriptors
    // Use builder.addPassed() when all valid
  }

  #getDescriptorsSchema() {
    // Extract schema from anatomy:body component
    // Lines 245-267
  }

  #validateDescriptor(descriptorName, descriptorValue, schema) {
    // Validate individual descriptor
    // Lines 276-323
  }
}
```

**Key Extraction Points:**
- Lines 245-267: Get and extract descriptors schema from component
- Lines 271-274: Get bodyDescriptors from recipe
- Lines 276-323: Validation logic for each descriptor
- Lines 325-333: Success/failure reporting

### 2. Create Unit Tests (1 hour)

**File:** `tests/unit/anatomy/validation/validators/RecipeBodyDescriptorValidator.test.js`

**Test Cases:**
1. Constructor validation
   - Should initialize with correct configuration
   - Should validate dataRegistry dependency

2. Schema extraction
   - Should extract descriptors schema from anatomy:body component
   - Should handle missing anatomy:body component
   - Should handle malformed component schema
   - Should handle missing descriptors in schema

3. Descriptor validation
   - Should pass when all descriptors are valid
   - Should error on unknown descriptor field
   - Should error on invalid enum value
   - Should error on wrong data type
   - Should validate multiple descriptors correctly

4. Recipe scenarios
   - Should pass for recipe with no bodyDescriptors
   - Should pass for recipe with all valid descriptors
   - Should error for recipe with one invalid descriptor
   - Should error for recipe with multiple invalid descriptors
   - Should handle empty bodyDescriptors object

5. Edge cases
   - Should handle schema with no enum constraints
   - Should handle schema with complex type definitions
   - Should handle descriptors with null values

**Coverage Target:** 80%+ branch coverage

### 3. Integration (Time included above)

**No integration needed yet** - Will be done in RECVALREF-011-10

Verify:
```bash
npm run test:unit -- validators/RecipeBodyDescriptorValidator.test.js
```

## Dependencies

**Service Dependencies:**
- `IDataRegistry` - For accessing anatomy:body component
- `ILogger` - For logging (inherited)

**Code Dependencies:**
- `BaseValidator` - Base class
- `validateDependency` - Dependency validation

## Acceptance Criteria

- [ ] RecipeBodyDescriptorValidator class created
- [ ] Extends BaseValidator with priority: 15, failFast: false
- [ ] Schema extraction logic from anatomy:body component works
- [ ] Descriptor validation matches original behavior exactly
- [ ] Constructor validates dataRegistry dependency
- [ ] Unit tests achieve 80%+ branch coverage
- [ ] Error messages match original format exactly
- [ ] Passed message matches original format
- [ ] Handles all edge cases from original implementation
- [ ] ESLint passes on new file

## Testing Commands

```bash
# Run unit tests
npm run test:unit -- validators/RecipeBodyDescriptorValidator.test.js

# Check coverage
npm run test:unit -- validators/RecipeBodyDescriptorValidator.test.js --coverage

# Lint
npx eslint src/anatomy/validation/validators/RecipeBodyDescriptorValidator.js
```

## Code Reference

**Original Method Location:**
`src/anatomy/validation/RecipePreflightValidator.js:235-335`

**Key Logic to Preserve:**
- Lines 245-267: Schema extraction from component
- Line 250: `component.dataSchema?.properties?.body?.properties?.descriptors`
- Lines 276-323: Per-descriptor validation loop
- Line 289: Unknown field check
- Lines 294-308: Enum validation
- Lines 310-320: Type validation

## Critical Notes

- **NOT the same as BodyDescriptorValidator**: Different purpose (recipe vs system)
- Schema comes from `anatomy:body` component, not hardcoded
- Must validate against dynamic schema properties
- Reports ALL invalid descriptors, not just first (failFast: false)

## Success Metrics

- RecipeBodyDescriptorValidator: ~150-200 lines
- Test file: ~250-300 lines
- Branch coverage: 80%+
- Zero behavior changes from original
- Clear distinction from system BodyDescriptorValidator documented
