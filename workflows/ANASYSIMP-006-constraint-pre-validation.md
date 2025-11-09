# ANASYSIMP-006: Constraint Pre-Validation

**Phase:** 2 (Tooling & Documentation)
**Priority:** P1
**Effort:** Low (1 day)
**Impact:** Medium - Better constraint error messages
**Status:** Not Started

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

Recipe constraints define co-presence and mutual exclusion rules for anatomy parts. However:
- Schema validation only checks structure (array with items)
- Error messages don't explain why constraint is invalid
- No explanation of business rule (co-presence requires 2+ parts)
- No examples of correct constraint format

## Solution Overview

Implement constraint pre-validation with enhanced error messages that explain business rules and provide examples.

## Implementation Details

### Core Validation Function

```javascript
/**
 * Validates recipe constraints with business rule explanations
 * @param {Object} recipe - Recipe to validate
 * @returns {Array<Object>} Array of errors found
 */
function validateConstraints(recipe) {
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
  }

  // Validate 'forbids' constraints (mutual exclusion)
  for (const [index, constraint] of Object.entries(recipe.constraints?.forbids || [])) {
    if (!constraint.partTypes || constraint.partTypes.length < 2) {
      errors.push({
        type: 'INVALID_CONSTRAINT',
        constraintType: 'forbids',
        index: parseInt(index),
        current: constraint.partTypes || [],
        message: 'Mutual exclusion constraint must specify at least 2 part types',
        businessRule: 'Forbids constraints ensure mutually exclusive parts never co-exist',
        fix: 'Add another part type to the forbids array',
        example: { partTypes: ['gills', 'lungs'] },
        explanation: 'Mutual exclusion prevents incompatible parts (e.g., aquatic gills vs terrestrial lungs)',
        severity: 'error',
      });
    }
  }

  return errors;
}
```

### Integration Points

Integrates with ANASYSIMP-003 (Pre-flight Recipe Validator) as an additional check.

## Acceptance Criteria

- [ ] Validates 'requires' constraints have 2+ part types
- [ ] Validates 'forbids' constraints have 2+ part types
- [ ] Errors explain business rule behind constraint
- [ ] Errors provide correct constraint examples
- [ ] Errors include fix suggestions
- [ ] Integration with pre-flight validator works correctly

## Testing Requirements

### Unit Tests

1. **Requires Constraints**
   - Constraint with 2+ parts → no error
   - Constraint with 1 part → error with explanation
   - Constraint with 0 parts → error with explanation
   - Empty constraints object → no error

2. **Forbids Constraints**
   - Constraint with 2+ parts → no error
   - Constraint with 1 part → error with explanation

3. **Error Messages**
   - Error includes constraint type (requires/forbids)
   - Error includes index
   - Error includes business rule explanation
   - Error includes example
   - Error includes fix suggestion

## Documentation Requirements

- [ ] Add JSDoc comments to validation function
- [ ] Document constraint validation in validation workflow docs
- [ ] Add constraint examples to recipe creation checklist

## Dependencies

**Depends On:** None (independent validator)
**Integrates With:** ANASYSIMP-003 (Pre-flight Recipe Validator)

## Success Metrics

- **Error Clarity:** 100% of constraint errors include business rule explanation
- **Time Savings:** 10-15 minutes per constraint error (eliminated guesswork)

## References

- **Report Section:** Recommendation 1.5
- **Report Pages:** Lines 590-621
- **Error Examples:** Red Dragon Error Round 1 (lines 182-188)
