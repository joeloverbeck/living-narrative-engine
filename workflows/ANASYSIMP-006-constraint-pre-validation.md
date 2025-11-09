# ANASYSIMP-006: Constraint Pre-Validation

**Phase:** 2 (Tooling & Documentation)
**Priority:** P1
**Effort:** Low (1 day)
**Impact:** Medium - Better constraint error messages
**Status:** Not Started

---

## ⚠️ Workflow Corrections (Updated 2025-11-09)

This workflow has been updated to reflect the actual production code state:

1. **Constraint Field Names**: Schema uses `excludes`, NOT `forbids`
   - ✅ Correct: `constraints.requires` and `constraints.excludes`
   - ❌ Wrong: `constraints.forbids` (does not exist in schema)

2. **Validation Already Exists**: Basic constraint validation implemented at `AnatomyRecipeLoader._validateConstraintArray()` (lines 201-223)
   - Current validation enforces 2+ items rule
   - Current error: "Invalid '{constraintType}' group... must contain at least 2 items"
   - **Enhancement needed**: Add business rule explanations and examples

3. **Both Fields Must Be Validated**: Constraints have TWO fields that need validation:
   - `partTypes` (array of part type strings)
   - `components` (array of component tag strings)
   - Both fields support co-presence (requires) and mutual exclusion (excludes)

4. **RecipePreflightValidator Exists**: Pre-flight validator is already implemented at `src/anatomy/validation/RecipePreflightValidator.js`
   - Currently validates: components, properties, blueprints, sockets/slots, patterns, descriptors
   - Does NOT currently validate constraints
   - Can be enhanced with constraint validation (Option B)

5. **Implementation Options**: Two approaches available:
   - **Option A (Recommended)**: Enhance existing `AnatomyRecipeLoader` validation
   - **Option B**: Add constraint check to `RecipePreflightValidator`

---

## Context

From the anatomy system improvements analysis, constraint errors surface during generation with unclear messages that don't explain the business rules behind the validation.

**Example Error from Red Dragon:**
```
Error Round 1: "Invalid 'requires' group at index 0. 'partTypes' must contain at least 2 items."
Location: Recipe constraint validation
Issue: Constraint required co-presence but only 1 part specified
Root Cause: Schema validation doesn't explain business rule
```

## Problem Statement

Recipe constraints define co-presence and mutual exclusion rules for anatomy parts. Current state:
- **Basic validation exists**: `AnatomyRecipeLoader._validateConstraintArray()` (src/loaders/anatomyRecipeLoader.js:201-223) enforces structural rules (2+ items, array of strings)
- **Current error message**: "Invalid '{constraintType}' group at index {index}... '{field}' must contain at least 2 items."
- **Missing context**: Error messages don't explain the business rule (why 2+ parts are required)
- **No examples**: No examples of correct constraint format in error messages
- **Constraint types**: Schema defines `requires` and `excludes` (NOT "forbids")

## Solution Overview

Enhance existing constraint validation in `AnatomyRecipeLoader` with business rule explanations and examples. Two implementation approaches:

**Option A: Enhance Existing Validation (Recommended)**
- Extend `AnatomyRecipeLoader._validateConstraintArray()` with enhanced error messages
- Minimal code changes, immediate impact
- Errors occur at load time (fail-fast)

**Option B: Add to Pre-flight Validator**
- Add constraint check to `RecipePreflightValidator` (src/anatomy/validation/RecipePreflightValidator.js)
- Consistent with other pre-flight checks
- Requires separate validation pass

## Implementation Details

### Option A: Enhanced Error Messages (Recommended)

**Location**: `src/loaders/anatomyRecipeLoader.js:201-223`

Enhance the existing `_validateConstraintArray()` method to throw errors with business context:

```javascript
/**
 * Enhanced validation that provides business rule explanations
 * Extends existing _validateConstraintArray method
 */
_validateConstraintArray(value, constraintType, field, modId, filename, index) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(
      `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'. '${field}' must be an array of strings.`
    );
  }

  if (value.length < 2) {
    // Enhanced error with business rule explanation
    const businessRule = constraintType === 'requires'
      ? 'Co-presence constraints ensure multiple part types exist together (e.g., wings require tail for balance)'
      : 'Mutual exclusion constraints prevent incompatible parts from coexisting (e.g., gills vs lungs)';

    const example = constraintType === 'requires'
      ? `{ "partTypes": ["dragon_wing", "dragon_tail"] }`
      : `{ "partTypes": ["gills", "lungs"] }`;

    throw new ValidationError(
      `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'.\n` +
      `  '${field}' must contain at least 2 items.\n\n` +
      `  Business Rule: ${businessRule}\n` +
      `  Example: ${example}\n` +
      `  Current: ${JSON.stringify(value)}`
    );
  }

  if (!value.every((entry) => typeof entry === 'string')) {
    throw new ValidationError(
      `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'. '${field}' entries must all be strings.`
    );
  }
}
```

### Option B: Pre-flight Validator Integration

**Location**: `src/anatomy/validation/RecipePreflightValidator.js`

Add a new validation check method:

```javascript
async #checkConstraints(recipe, results) {
  try {
    const errors = [];

    // Validate 'requires' constraints (co-presence)
    for (const [index, constraint] of Object.entries(recipe.constraints?.requires || [])) {
      if (!constraint.partTypes || constraint.partTypes.length < 2) {
        errors.push({
          type: 'INVALID_CONSTRAINT',
          constraintType: 'requires',
          index: parseInt(index),
          current: constraint.partTypes || [],
          message: 'Co-presence constraint must specify at least 2 part types',
          businessRule: 'Constraints validate that multiple part types co-exist in generated anatomy',
          fix: 'Add another part type to the requires array',
          example: { partTypes: ['dragon_wing', 'dragon_tail'] },
          explanation: 'Co-presence ensures if one part exists, others must exist too (e.g., wings require tail for balance)',
          severity: 'error',
        });
      }

      // Also validate 'components' field if present
      if (!constraint.components || constraint.components.length < 2) {
        // Similar error structure
      }
    }

    // Validate 'excludes' constraints (mutual exclusion) - NOTE: Schema uses 'excludes', NOT 'forbids'
    for (const [index, constraint] of Object.entries(recipe.constraints?.excludes || [])) {
      if (!constraint.partTypes || constraint.partTypes.length < 2) {
        errors.push({
          type: 'INVALID_CONSTRAINT',
          constraintType: 'excludes',
          index: parseInt(index),
          current: constraint.partTypes || [],
          message: 'Mutual exclusion constraint must specify at least 2 part types',
          businessRule: 'Excludes constraints ensure mutually exclusive parts never co-exist',
          fix: 'Add another part type to the excludes array',
          example: { partTypes: ['gills', 'lungs'] },
          explanation: 'Mutual exclusion prevents incompatible parts (e.g., aquatic gills vs terrestrial lungs)',
          severity: 'error',
        });
      }

      // Also validate 'components' field if present
      if (!constraint.components || constraint.components.length < 2) {
        // Similar error structure
      }
    }

    if (errors.length === 0) {
      results.passed.push({
        check: 'constraint_validation',
        message: `All ${this.#countConstraints(recipe)} constraint(s) valid`,
      });
    } else {
      results.errors.push(...errors);
    }
  } catch (error) {
    this.#logger.error('Constraint validation check failed', error);
    results.errors.push({
      type: 'VALIDATION_ERROR',
      check: 'constraint_validation',
      message: 'Failed to validate constraints',
      error: error.message,
    });
  }
}

#countConstraints(recipe) {
  const requires = recipe.constraints?.requires?.length || 0;
  const excludes = recipe.constraints?.excludes?.length || 0;
  return requires + excludes;
}
```

Then add to `#runValidationChecks()`:

```javascript
// 7. Constraint Validation (Critical - P1)
if (!options.skipConstraintChecks) {
  await this.#checkConstraints(recipe, results);
}
```

### Integration Points

**Current State:**
- Basic constraint validation exists in `AnatomyRecipeLoader._validateConstraintArray()` (load-time)
- `RecipePreflightValidator` exists at `src/anatomy/validation/RecipePreflightValidator.js`
- RecipePreflightValidator currently validates: component existence, property schemas, blueprint existence, socket/slot compatibility, pattern matching, descriptor coverage
- Constraint validation NOT currently in RecipePreflightValidator

**Integration Options:**
1. **Option A (Recommended)**: Enhance existing `AnatomyRecipeLoader` validation with better error messages
   - Pros: Immediate, fail-fast, minimal code changes
   - Cons: Errors only visible at load time

2. **Option B**: Add constraint check to `RecipePreflightValidator.#runValidationChecks()`
   - Pros: Consistent with other pre-flight checks, can be run independently via CLI
   - Cons: Requires users to run pre-flight validator, duplicate validation logic

**Recommendation**: Implement Option A first (quick win), then optionally add Option B for CLI tooling integration.

## Acceptance Criteria

**Option A (Enhanced Load-Time Validation):**
- [ ] Enhances `_validateConstraintArray()` with business rule explanations
- [ ] Validates 'requires' constraints (both `partTypes` and `components` fields)
- [ ] Validates 'excludes' constraints (both `partTypes` and `components` fields)
- [ ] Error messages include business rule explanation
- [ ] Error messages include concrete examples
- [ ] Error messages show current invalid value
- [ ] All existing tests still pass
- [ ] New tests verify enhanced error messages

**Option B (Pre-flight Validator Integration):**
- [ ] Adds `#checkConstraints()` method to RecipePreflightValidator
- [ ] Validates both 'requires' and 'excludes' constraint types
- [ ] Validates both 'partTypes' and 'components' fields
- [ ] Returns structured error objects with business rules
- [ ] Integrates with existing pre-flight validation workflow
- [ ] CLI tool can report constraint validation results

## Testing Requirements

### Unit Tests

**Option A: Enhanced AnatomyRecipeLoader Tests**

Location: `tests/unit/loaders/anatomyRecipeLoader.processFetchedItem.test.js`

1. **Requires Constraints**
   - `partTypes` with 2+ items → no error
   - `partTypes` with 1 item → enhanced error with business rule
   - `partTypes` with 0 items → enhanced error with business rule
   - `components` with 2+ items → no error
   - `components` with 1 item → enhanced error
   - Both `partTypes` and `components` with < 2 items → multiple enhanced errors

2. **Excludes Constraints** (NOTE: Schema uses 'excludes', not 'forbids')
   - `partTypes` with 2+ items → no error
   - `partTypes` with 1 item → enhanced error with business rule
   - `components` with 1 item → enhanced error
   - Empty `constraints.excludes` array → no error
   - Missing `constraints` object → no error

3. **Enhanced Error Message Content**
   - Error includes constraint type ('requires' or 'excludes')
   - Error includes field name ('partTypes' or 'components')
   - Error includes index
   - Error includes business rule explanation
   - Error includes example for constraint type
   - Error includes current invalid value (JSON.stringify)
   - Error includes mod ID and filename for context

**Option B: RecipePreflightValidator Tests**

Location: `tests/unit/anatomy/validation/RecipePreflightValidator.test.js`

1. **Constraint Validation Check**
   - Recipe with valid constraints → passes with count
   - Recipe with invalid 'requires' → structured error object
   - Recipe with invalid 'excludes' → structured error object
   - Recipe with no constraints → passes
   - Recipe with multiple constraint errors → all errors collected

2. **Integration Test**

Location: `tests/integration/anatomy/validation/recipePreflightValidation.integration.test.js`

   - Full validation workflow includes constraint check
   - Constraint errors appear in ValidationReport
   - CLI tool displays constraint validation results

## Documentation Requirements

- [ ] Add JSDoc comments to validation function
- [ ] Document constraint validation in validation workflow docs
- [ ] Add constraint examples to recipe creation checklist

## Dependencies

**Depends On:** None (enhancement to existing code)

**Related Systems:**
- `AnatomyRecipeLoader` (src/loaders/anatomyRecipeLoader.js) - Current location of constraint validation
- `RecipePreflightValidator` (src/anatomy/validation/RecipePreflightValidator.js) - Potential integration point
- Recipe Schema (data/schemas/anatomy.recipe.schema.json) - Defines constraint structure

**Notes:**
- ANASYSIMP-003 workflow file doesn't exist, but RecipePreflightValidator is already implemented
- Basic constraint validation already exists in AnatomyRecipeLoader
- This ticket enhances existing validation, doesn't create new validation from scratch

## Success Metrics

- **Error Clarity:** 100% of constraint errors include business rule explanation
- **Time Savings:** 10-15 minutes per constraint error (eliminated guesswork)

## References

- **Report Section:** Recommendation 1.5
- **Report Pages:** Lines 590-621
- **Error Examples:** Red Dragon Error Round 1 (lines 182-188)
