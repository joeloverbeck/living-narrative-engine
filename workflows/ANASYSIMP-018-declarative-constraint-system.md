# ANASYSIMP-018: Declarative Constraint System

**Phase:** 3 (Architectural Enhancements)
**Priority:** P3
**Effort:** Medium (3-4 days)
**Impact:** Medium - Better constraint handling
**Status:** Not Started

## Context

Constraint validation logic is currently hardcoded in `RecipeConstraintEvaluator` (`src/anatomy/recipeConstraintEvaluator.js`). Error messages are embedded in the evaluator code rather than being declarative. Making constraints declarative with inline validation metadata would enable self-documenting rules and better, customizable error messages.

**Current Constraint Implementation:**
- Schema: `data/schemas/anatomy.recipe.schema.json`
- Evaluator: `src/anatomy/recipeConstraintEvaluator.js`
- Validation Rule: `src/anatomy/validation/rules/recipeConstraintRule.js`
- Current constraint types: `requires`, `excludes`
- Structure: Simple arrays of `partTypes` and `components`
- Error messages: Hardcoded strings in evaluator

## Solution Overview

Extend the existing constraint schema (`data/schemas/anatomy.recipe.schema.json`) to include optional validation metadata for custom error messages and explanations directly in recipe definitions. This maintains backward compatibility while enabling declarative error messaging.

## Implementation

### Enhanced Constraint Schema

**Current Structure:**
```json
{
  "constraints": {
    "requires": [
      {
        "partTypes": ["dragon_wing", "dragon_tail"],
        "components": []
      }
    ],
    "excludes": [
      {
        "partTypes": ["gills", "lungs"],
        "components": []
      }
    ]
  }
}
```

**Proposed Enhancement (backward compatible):**
```json
{
  "constraints": {
    "requires": [
      {
        "partTypes": ["dragon_wing", "dragon_tail"],
        "components": [],
        "validation": {
          "minItems": 2,
          "errorMessage": "Co-presence constraint requires at least 2 part types",
          "explanation": "Dragons need both wings and tail for flight balance"
        }
      }
    ],
    "excludes": [
      {
        "partTypes": ["gills", "lungs"],
        "components": [],
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

### Declarative Validator Enhancement

**Current Implementation Location:** `src/anatomy/recipeConstraintEvaluator.js`

**Enhancement Strategy:** Extend existing `RecipeConstraintEvaluator` to support optional validation metadata in constraints.

**Key Methods to Enhance:**
- `#evaluateRequiresConstraints()` - Add support for custom error messages
- `#evaluateExcludesConstraints()` - Add support for custom error messages
- `#buildGraphMetadata()` - Already builds part type and component metadata

**Proposed Changes:**

```javascript
// In RecipeConstraintEvaluator.js
#evaluateRequiresConstraints(requiresConstraints, graphMetadata, errors) {
  for (const constraint of requiresConstraints) {
    const requiredComponents = constraint.components || [];
    const requiredPartTypes = constraint.partTypes || [];

    // NEW: Get validation metadata if provided
    const validation = constraint.validation || {};
    const minItems = validation.minItems || 2;

    // Check if any required part types are present
    const presentPartTypes = requiredPartTypes.filter((pt) =>
      graphMetadata.partTypes.has(pt)
    );
    const hasRequiredPartType = presentPartTypes.length > 0;

    // If we have the required part type, check for required components
    if (hasRequiredPartType && requiredComponents.length > 0) {
      const missingComponents = requiredComponents.filter(
        (c) => !graphMetadata.components.has(c)
      );

      if (missingComponents.length > 0) {
        // NEW: Use custom error message if provided, otherwise use default
        const errorMessage = validation.errorMessage ||
          `Required constraint not satisfied: has part types [${presentPartTypes.join(', ')}] ` +
          `but missing required components [${missingComponents.join(', ')}]`;

        errors.push(errorMessage);

        // NEW: Log explanation if provided
        if (validation.explanation) {
          this.#logger.debug(`Constraint explanation: ${validation.explanation}`);
        }
      }
    }
  }
}

#evaluateExcludesConstraints(excludesConstraints, graphMetadata, errors) {
  for (const constraint of excludesConstraints) {
    const excludedComponents = constraint.components || constraint;

    // NEW: Get validation metadata if provided
    const validation = constraint.validation || {};

    if (Array.isArray(excludedComponents)) {
      const presentExcluded = excludedComponents.filter((c) =>
        graphMetadata.components.has(c)
      );

      if (presentExcluded.length > 1) {
        // NEW: Use custom error message if provided, otherwise use default
        const errorMessage = validation.errorMessage ||
          `Exclusion constraint violated: found mutually exclusive components ` +
          `[${presentExcluded.join(', ')}] in the same anatomy`;

        errors.push(errorMessage);

        // NEW: Log explanation if provided
        if (validation.explanation) {
          this.#logger.debug(`Constraint explanation: ${validation.explanation}`);
        }
      }
    }
  }
}
```

**Implementation Notes:**
- Uses existing `#buildGraphMetadata()` which already extracts part types and components from entity manager
- `graphMetadata.partTypes` is a Set of part type strings from `anatomy:part` components
- `graphMetadata.components` is a Set of all component type IDs across entities
- Validation metadata is optional (backward compatible)
- Default error messages preserved when validation metadata absent

## Benefits

- **Self-documenting** - Constraints explain themselves
- **Better errors** - Custom messages per constraint
- **Easier to extend** - Add new constraint types via schema
- **No code changes** - Configure via JSON

## Acceptance Criteria

- [ ] Schema updated: `data/schemas/anatomy.recipe.schema.json` includes optional `validation` property in constraint objects
- [ ] `RecipeConstraintEvaluator.js` updated to support custom error messages from validation metadata
- [ ] Explanations logged when validation.explanation provided
- [ ] Both constraint types (`requires`, `excludes`) support validation metadata
- [ ] Backward compatible: Existing recipes without validation metadata continue to work with default error messages
- [ ] Tests added: Unit tests in `tests/unit/anatomy/recipeConstraintEvaluator.test.js` for validation metadata
- [ ] Tests updated: Validation rule tests in `tests/unit/anatomy/validation/rules/recipeConstraintRule.test.js`
- [ ] Documentation: Update `docs/anatomy/common-errors.md` constraint section with new validation metadata capability

## Implementation Steps

### Step 1: Update Schema

**File:** `data/schemas/anatomy.recipe.schema.json`

Add optional `validation` property to both `requires` and `excludes` constraint items:

```json
{
  "requires": {
    "items": {
      "properties": {
        "components": { /* existing */ },
        "partTypes": { /* existing */ },
        "validation": {
          "type": "object",
          "description": "Optional validation metadata for custom error messages",
          "properties": {
            "minItems": {
              "type": "integer",
              "minimum": 2,
              "description": "Minimum number of items required for co-presence"
            },
            "errorMessage": {
              "type": "string",
              "description": "Custom error message when constraint violated"
            },
            "explanation": {
              "type": "string",
              "description": "Explanation of why constraint exists (for debugging/docs)"
            }
          },
          "additionalProperties": false
        }
      }
    }
  }
}
```

### Step 2: Update RecipeConstraintEvaluator

**File:** `src/anatomy/recipeConstraintEvaluator.js`

Modify `#evaluateRequiresConstraints()` and `#evaluateExcludesConstraints()` as shown in "Proposed Changes" section above.

### Step 3: Add Tests

**File:** `tests/unit/anatomy/recipeConstraintEvaluator.test.js`

Add test cases:
- Constraint with custom error message
- Constraint with explanation (verify debug logging)
- Constraint without validation metadata (backward compatibility)
- Both constraint types with validation metadata

### Step 4: Update Documentation

**File:** `docs/anatomy/common-errors.md`

Update "8. Constraint Validation Errors" section to document:
- Optional validation metadata
- Custom error message capability
- Explanation field for documentation
- Examples of enhanced constraints

## Current Constraint Examples

**Real Example from `red_dragon.recipe.json`:**
```json
{
  "constraints": {
    "requires": [
      {
        "partTypes": ["dragon_wing", "dragon_tail"]
      }
    ]
  }
}
```

**Enhanced Version (Proposed):**
```json
{
  "constraints": {
    "requires": [
      {
        "partTypes": ["dragon_wing", "dragon_tail"],
        "validation": {
          "minItems": 2,
          "errorMessage": "Dragons require both wings and tail for flight stability",
          "explanation": "Flight mechanics require wing-tail coordination for balance"
        }
      }
    ]
  }
}
```

## Dependencies

**Depends On:** ANASYSIMP-006 (Constraint Pre-Validation)

## References

- **Report Section:** Recommendation 4.3
- **Report Pages:** Lines 1327-1370
- **Current Implementation:** `src/anatomy/recipeConstraintEvaluator.js:169-222`
- **Schema:** `data/schemas/anatomy.recipe.schema.json` (constraints section)
- **Tests:** `tests/unit/anatomy/recipeConstraintEvaluator.test.js`
- **Docs:** `docs/anatomy/common-errors.md` (section 8)
