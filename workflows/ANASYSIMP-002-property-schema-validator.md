# ANASYSIMP-002: Property Schema Validator

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Low (1 day)
**Impact:** High - Prevents enum/type errors
**Status:** Not Started

## Context

From the anatomy system improvements analysis, recipe properties can use invalid enum values that pass schema validation but fail at runtime. This was a consistent issue across 75% of all anatomy recipes tested.

**Architecture Notes (Updated based on actual codebase):**
- Recipes are loaded by `AnatomyRecipeLoader` (not a generic `recipeLoader`)
- Components are stored in `InMemoryDataRegistry` implementing `IDataRegistry` (not a dedicated `componentRegistry`)
- Component definitions include `dataSchema` but NOT `filePath` (derive path from component ID)
- Validation follows Chain of Responsibility pattern via `AnatomyValidationPhase`
- New validator should be a `ValidationRule` subclass, not a standalone function
- Integration point: Add rule to validation chain after `ComponentExistenceValidationRule`

**Example Error from Red Dragon:**
```
Error Round 3: "Runtime component validation failed for 'anatomy:dragon_wing'.
Invalid components: [descriptors:length_category]"
Location: Entity instantiation
Issue: Used invalid enum value "vast" (not in schema)
Root Cause: No property validation against component schema at load time
```

## Problem Statement

Recipe properties are defined with arbitrary values during recipe creation. While the recipe schema validates the structure (that properties is an object), it doesn't validate that property values match the component's dataSchema. This causes:
- Runtime validation failures during entity instantiation
- Unclear error messages about which value is invalid
- Manual schema file inspection required
- Trial-and-error value correction
- Poor developer experience

## Solution Overview

Implement property schema validation that runs at recipe load time. The validator should:
1. Access component schemas from the component registry
2. Validate each property object against its component's dataSchema using AJV
3. Format AJV errors with context (slot/pattern, component, property)
4. Include valid enum values in error messages
5. Suggest corrections when possible

## Implementation Details

### Core Validation Function

```javascript
import { ValidationRule } from '../validationRule.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates that recipe property values match component dataSchemas
 *
 * @extends ValidationRule
 */
class PropertySchemaValidationRule extends ValidationRule {
  #logger;
  #dataRegistry;
  #schemaValidator;

  constructor({ logger, dataRegistry, schemaValidator }) {
    super();

    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;
    this.#schemaValidator = schemaValidator;
  }

  get ruleId() {
    return 'property-schema-validation';
  }

  get ruleName() {
    return 'Property Schema Validation';
  }

  shouldApply(context) {
    return context.hasRecipes();
  }

  async validate(context) {
    const issues = [];
    const recipes = context.getRecipes();

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const recipeIssues = this.#validateRecipeProperties(recipe);

      // Add recipe context to each issue
      for (const issue of recipeIssues) {
        issues.push({
          ...issue,
          context: {
            ...issue.context,
            recipeId,
          },
        });
      }
    }

    // Log summary
    if (issues.length > 0) {
      const errors = issues.filter((i) => i.severity === 'error');
      this.#logger.warn(
        `Property schema validation found ${errors.length} invalid property value(s)`
      );
    } else {
      this.#logger.debug('Property schema validation passed');
    }

    return issues;
  }

  #validateRecipeProperties(recipe) {
    const issues = [];

    // Validate slot properties
    for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
      for (const [componentId, properties] of Object.entries(slot.properties || {})) {
        const component = this.#dataRegistry.get('components', componentId);

        if (!component) {
          // Component existence is validated by ComponentExistenceValidationRule
          // Skip validation if component doesn't exist
          continue;
        }

        const schemaErrors = this.#validateComponentProperties(
          componentId,
          properties,
          component.dataSchema
        );

        if (schemaErrors.length > 0) {
          issues.push({
            type: 'INVALID_PROPERTY_VALUE',
            location: { type: 'slot', name: slotName },
            componentId: componentId,
            properties: properties,
            schemaErrors: schemaErrors,
            componentSource: this.#deriveComponentSource(componentId),
            severity: 'error',
          });
        }
      }
    }

    // Validate pattern properties
    for (const [index, pattern] of (recipe.patterns || []).entries()) {
      const patternId = pattern.matchesPattern || pattern.matchesGroup || `pattern-${index}`;

      for (const [componentId, properties] of Object.entries(pattern.properties || {})) {
        const component = this.#dataRegistry.get('components', componentId);

        if (!component) {
          continue; // Caught by component existence validator
        }

        const schemaErrors = this.#validateComponentProperties(
          componentId,
          properties,
          component.dataSchema
        );

        if (schemaErrors.length > 0) {
          issues.push({
            type: 'INVALID_PROPERTY_VALUE',
            location: { type: 'pattern', name: patternId, index },
            componentId: componentId,
            properties: properties,
            schemaErrors: schemaErrors,
            componentSource: this.#deriveComponentSource(componentId),
            severity: 'error',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Derives the component source file path from the component ID
   * Format: data/mods/{modId}/components/{componentName}.component.json
   */
  #deriveComponentSource(componentId) {
    const [modId, componentName] = componentId.split(':');
    return `data/mods/${modId}/components/${componentName}.component.json`;
  }

  /**
   * Validates a property object against a component's dataSchema
   * @param {string} componentId - Component identifier
   * @param {Object} properties - Property values to validate
   * @param {Object} dataSchema - Component dataSchema
   * @returns {Array<Object>} Array of formatted validation errors
   */
  #validateComponentProperties(componentId, properties, dataSchema) {
    const errors = [];

    // Temporarily add the dataSchema to validator if not already registered
    // This allows validation without pre-registering all component schemas
    const schemaId = `temp:${componentId}:dataSchema`;

    // Note: In practice, component dataSchemas are already registered during component loading
    // This is a fallback for edge cases
    try {
      // Use the schema validator to validate properties against dataSchema
      // The schemaValidator expects a schemaId, but we have an inline schema
      // We'll use AJV's compile method via the validator if available
      const result = this.#schemaValidator.validate(schemaId, properties);

      if (!result.isValid && result.errors) {
        for (const error of result.errors) {
          errors.push(this.#formatPropertyError(componentId, properties, error, dataSchema));
        }
      }
    } catch (schemaNotFoundError) {
      // If schema isn't registered, validate inline
      // This requires direct access to AJV which may need refactoring
      this.#logger.warn(
        `Component '${componentId}' dataSchema not registered. Inline validation needed.`
      );
      // TODO: Consider adding inline schema validation support to ISchemaValidator
    }

    return errors;
  }

  /**
   * Formats AJV error with context and suggestions
   * @param {string} componentId - Component identifier
   * @param {Object} properties - Property values
   * @param {Object} ajvError - AJV error object
   * @param {Object} dataSchema - Component dataSchema
   * @returns {Object} Formatted error object
   */
  #formatPropertyError(componentId, properties, ajvError, dataSchema) {
    const propertyPath = ajvError.instancePath.replace(/^\//, '');
    const propertyName = propertyPath || ajvError.params.missingProperty;

    const error = {
      property: propertyName,
      message: ajvError.message,
      currentValue: this.#getPropertyValue(properties, propertyPath),
    };

    // Add enum suggestions for enum validation failures
    if (ajvError.keyword === 'enum' && ajvError.params.allowedValues) {
      error.validValues = ajvError.params.allowedValues;
      error.suggestion = this.#suggestClosestValue(
        error.currentValue,
        ajvError.params.allowedValues
      );
    }

    // Add type information for type validation failures
    if (ajvError.keyword === 'type') {
      error.expectedType = ajvError.params.type;
      error.actualType = typeof error.currentValue;
    }

    // Add required field information
    if (ajvError.keyword === 'required') {
      error.missingField = ajvError.params.missingProperty;
    }

    return error;
  }

  /**
   * Gets a nested property value from an object using a path
   * @param {Object} obj - Object to search
   * @param {string} path - Property path (e.g., "color.primary")
   * @returns {*} Property value
   */
  #getPropertyValue(obj, path) {
    if (!path) return obj;
    return path.split('/').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Suggests the closest matching value from a list of valid values
   * @param {*} value - Invalid value
   * @param {Array} validValues - List of valid values
   * @returns {*} Closest matching valid value
   */
  #suggestClosestValue(value, validValues) {
    if (typeof value !== 'string') return validValues[0];

    // Simple string similarity: find shortest edit distance
    let closest = validValues[0];
    let minDistance = Infinity;

    for (const valid of validValues) {
      const distance = this.#levenshteinDistance(value.toLowerCase(), valid.toLowerCase());
      if (distance < minDistance) {
        minDistance = distance;
        closest = valid;
      }
    }

    return closest;
  }

  /**
   * Calculates Levenshtein distance between two strings
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} Edit distance
   */
  #levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}

export { PropertySchemaValidationRule };
```

### Integration Points

1. **Anatomy Validation Phase**
   - File: `src/loaders/phases/anatomyValidationPhase.js`
   - Pattern: Add as new validation rule in the Chain of Responsibility
   - Hook: After component existence validation
   - Action: Run property schema validation, add issues to context

2. **Data Registry Access**
   - File: `src/data/inMemoryDataRegistry.js` (implements `IDataRegistry`)
   - Method: `get('components', componentId)` - Retrieve component definition with dataSchema
   - Note: Registry does NOT store file paths - component source location must be derived from component ID

3. **AJV Instance**
   - Use existing AJV instance via dependency injection
   - File: `src/validation/ajvSchemaValidator.js` (implements `ISchemaValidator`)
   - Access: Inject `ISchemaValidator` dependency into validation rule constructor

### File Structure

```
src/anatomy/validation/rules/
└── propertySchemaValidationRule.js  # New validation rule (extends ValidationRule)

src/anatomy/validation/
└── propertyErrorFormatter.js        # Error formatting utilities (if needed)

tests/unit/anatomy/validation/rules/
└── propertySchemaValidationRule.test.js

tests/integration/anatomy/validation/
└── propertySchemaValidation.integration.test.js
```

**Note:** Follow the existing validation rule pattern:
- Extend `ValidationRule` base class (`src/anatomy/validation/validationRule.js`)
- Implement `ruleId` getter (e.g., 'property-schema-validation')
- Implement `ruleName` getter (e.g., 'Property Schema Validation')
- Implement `shouldApply(context)` method
- Implement `validate(context)` method returning array of issues
- Use dependency injection for `logger`, `dataRegistry`, and `schemaValidator`
- Add rule to `AnatomyValidationPhase` after `ComponentExistenceValidationRule`

**Integration Steps:**
1. Create `PropertySchemaValidationRule` class in `src/anatomy/validation/rules/`
2. Register rule in DI container (add to anatomy validation registrations)
3. Inject into `AnatomyValidationPhase` constructor
4. Add to validation chain: `validationChain.addRule(this.#propertySchemaValidationRule);`

**Reference Implementation:**
See `ComponentExistenceValidationRule` (`src/anatomy/validation/rules/componentExistenceValidationRule.js`) for pattern to follow.

## Acceptance Criteria

- [ ] Validator checks all slot property values against component dataSchemas
- [ ] Validator checks all pattern property values against component dataSchemas
- [ ] Enum validation errors include list of valid values
- [ ] Enum validation errors suggest closest matching value
- [ ] Type validation errors show expected vs actual type
- [ ] Required field errors identify missing properties
- [ ] Errors include component ID and schema file path
- [ ] Errors include location context (slot/pattern name)
- [ ] Recipe load fails when property validation fails
- [ ] Validator skips components that don't exist (handled by ANASYSIMP-001)
- [ ] All existing recipes pass validation (no false positives)

## Testing Requirements

### Unit Tests

1. **Enum Validation**
   - Property with invalid enum value → error with valid values list
   - Property with valid enum value → no error
   - Multiple properties, one invalid → only one error
   - Invalid enum with suggestion matching → suggests correct value

2. **Type Validation**
   - Property with wrong type (string instead of number) → error
   - Property with correct type → no error
   - Nested property type validation

3. **Required Fields**
   - Missing required property → error identifying missing field
   - All required properties present → no error

4. **Error Formatting**
   - Error includes property name
   - Error includes current value
   - Error includes valid values (for enum)
   - Error includes suggestion (for enum)
   - Error includes expected/actual type (for type errors)

5. **Edge Cases**
   - Empty properties object → no error
   - Component without dataSchema → skip validation
   - Component not in registry → skip (caught by ANASYSIMP-001)
   - Nested property paths (e.g., "color.primary")
   - Array properties

6. **Suggestion Algorithm**
   - "vast" vs ["short", "medium", "long"] → suggests "long"
   - "imense" vs ["tiny", "small", "immense"] → suggests "immense"
   - Partial matches prioritized
   - Case-insensitive matching

### Integration Tests

1. **Recipe Load Pipeline**
   - Load recipe with invalid property value → should fail with clear error
   - Load recipe with valid property values → should succeed
   - Error message includes recipe file path and component schema path

2. **Real Component Registry**
   - Test against actual component schemas
   - Verify AJV validation works with real dataSchemas
   - Test with multiple component types (descriptors, anatomy, etc.)

3. **Multi-Error Scenarios**
   - Recipe with multiple invalid properties → all errors reported
   - Recipe with invalid properties in multiple slots → all reported

## Documentation Requirements

- [ ] Add JSDoc comments to all validation functions
- [ ] Document property validation in validation workflow docs
- [ ] Add example error messages to common errors catalog
- [ ] Update recipe creation checklist with property validation guidance
- [ ] Document suggestion algorithm for future maintainers

## Dependencies

**Required:**
- Component registry with `get(componentId)` method returning schema
- AJV instance for schema validation
- Recipe loader with validation hook

**Depends On:**
- None (independent validator, complements ANASYSIMP-001)

**Blocks:**
- ANASYSIMP-003 (Pre-flight Recipe Validator - uses this)
- ANASYSIMP-009 (Recipe Validation CLI Tool - uses this)

## Implementation Notes

### Data Registry Requirements

Components in the data registry are stored and retrieved as follows:
```javascript
// Storage (handled by ComponentLoader during mod loading)
dataRegistry.store('components', 'anatomy:horned', {
  id: 'anatomy:horned',
  dataSchema: { /* AJV-compatible JSON Schema */ },
  description: '...',
  // Note: filePath is NOT stored - derive from component ID
});

// Retrieval (in validation rule)
const component = dataRegistry.get('components', 'anatomy:horned');
// Returns: { id: 'anatomy:horned', dataSchema: {...}, ... }

// Derive file path from component ID when needed for error messages
const [modId, componentName] = component.id.split(':');
const filePath = `data/mods/${modId}/components/${componentName}.component.json`;
```

### Error Message Template

```
[ERROR] Invalid component property value

Recipe:    anatomy:red_dragon (red_dragon.recipe.json)
Location:  Slot 'head'
Component: anatomy:horned
Property:  'length'
Problem:   Invalid enum value 'vast'

Current Value:  "vast"
Valid Values:   ["short", "medium", "long"]
Suggestion:     "long" (closest match)

Component Schema: data/mods/anatomy/components/horned.component.json

Example Fix in red_dragon.recipe.json:
{
  "slots": {
    "head": {
      "properties": {
        "anatomy:horned": {
          "style": "crown",
          "length": "long"  // ← Changed from "vast"
        }
      }
    }
  }
}

Impact: Runtime validation will fail when entity is instantiated if not fixed.
```

**Note:** Component schema path is derived from component ID, not stored in registry.

### Schema Validator Integration

The validation rule uses the `ISchemaValidator` interface via dependency injection:
```javascript
// In validation rule constructor
constructor({ logger, dataRegistry, schemaValidator }) {
  validateDependency(schemaValidator, 'ISchemaValidator', logger, {
    requiredMethods: ['validate'],
  });
  this.#schemaValidator = schemaValidator;
}

// During validation
const result = this.#schemaValidator.validate(schemaId, properties);
```

**Important Note on Component DataSchemas:**
Component dataSchemas are automatically registered during mod loading by `ComponentLoader`:
- File: `src/loaders/componentLoader.js:75-78`
- Schema ID format: `{modId}:{componentId}:dataSchema`
- Example: `descriptors:length_category` dataSchema is registered as schema ID

However, the current implementation may need to handle cases where dataSchemas are stored as inline schemas within component definitions rather than pre-registered schema IDs. Consider adding support for inline schema validation to `ISchemaValidator` or compiling schemas on-demand during validation.

### Performance Considerations

- Validation runs once per recipe at load time
- AJV validation is highly optimized (compiled schemas)
- Expected recipe size: 10-50 property objects
- Performance impact: negligible (<10ms per recipe)
- Suggestion algorithm: O(n*m) where n=validValues.length, m=string length
  - Typical case: 3-5 valid values, strings <20 chars
  - Impact: <1ms per suggestion

## Success Metrics

- **Error Detection:** 100% of invalid property values caught at load time
- **False Positives:** 0% (all existing recipes pass)
- **Error Clarity:** >90% of errors include actionable suggestions
- **Suggestion Accuracy:** >80% of suggestions are the intended value
- **Time Savings:** 20-30 minutes per property error (eliminated runtime debugging and schema lookup)

## References

- **Report Section:** Category 1: Validation Enhancements → Recommendation 1.3
- **Report Pages:** Lines 498-541
- **Error Examples:** Red Dragon Error Round 3 & 4 (lines 199-215)
- **Related Validators:** Component Existence Checker (ANASYSIMP-001)
