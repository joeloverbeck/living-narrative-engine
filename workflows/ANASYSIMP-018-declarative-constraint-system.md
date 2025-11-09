# ANASYSIMP-018: Declarative Constraint System

**Phase:** 3 (Architectural Enhancements)
**Priority:** P3
**Effort:** Medium (3-4 days)
**Impact:** Medium - Better constraint handling
**Status:** Not Started

## Context

Constraint validation logic is hardcoded. Making constraints declarative enables self-documenting rules and better error messages.

## Solution Overview

Extend constraint schema to include validation metadata and error messages directly in recipe definitions.

## Implementation

### Enhanced Constraint Schema

```json
{
  "constraints": {
    "requires": [
      {
        "partTypes": ["dragon_wing", "dragon_tail"],
        "validation": {
          "minItems": 2,
          "errorMessage": "Co-presence constraint requires at least 2 part types",
          "explanation": "Dragons need both wings and tail for flight balance"
        }
      }
    ],
    "forbids": [
      {
        "partTypes": ["gills", "lungs"],
        "validation": {
          "mutuallyExclusive": true,
          "errorMessage": "Cannot have both gills and lungs",
          "explanation": "Choose either aquatic (gills) or terrestrial (lungs)"
        }
      }
    ]
  }
}
```

### Declarative Validator

```javascript
class DeclarativeConstraintValidator {
  validate(recipe, generatedAnatomy) {
    const errors = [];

    for (const constraint of recipe.constraints?.requires || []) {
      const result = this.#validateRequires(constraint, generatedAnatomy);
      if (!result.valid) {
        errors.push({
          type: 'CONSTRAINT_VIOLATION',
          constraintType: 'requires',
          message: constraint.validation?.errorMessage || 'Co-presence constraint failed',
          explanation: constraint.validation?.explanation,
          partTypes: constraint.partTypes,
          actual: result.actual,
        });
      }
    }

    return errors;
  }

  #validateRequires(constraint, anatomy) {
    const validation = constraint.validation || {};
    const minItems = validation.minItems || 2;

    const presentParts = constraint.partTypes.filter(
      partType => anatomy.hasPart(partType)
    );

    return {
      valid: presentParts.length >= minItems || presentParts.length === 0,
      actual: presentParts.length,
    };
  }
}
```

## Benefits

- **Self-documenting** - Constraints explain themselves
- **Better errors** - Custom messages per constraint
- **Easier to extend** - Add new constraint types via schema
- **No code changes** - Configure via JSON

## Acceptance Criteria

- [ ] Constraint schema includes validation metadata
- [ ] Custom error messages supported
- [ ] Explanations included in errors
- [ ] Multiple constraint types supported
- [ ] Backward compatible with existing recipes

## Dependencies

**Depends On:** ANASYSIMP-006 (Constraint Pre-Validation)

## References

- **Report Section:** Recommendation 4.3
- **Report Pages:** Lines 1327-1370
