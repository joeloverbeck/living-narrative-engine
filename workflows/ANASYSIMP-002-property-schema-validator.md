# ANASYSIMP-002: Property Schema Validator

**Phase:** 1 (Quick Wins)
**Priority:** P0
**Effort:** Low (1 day)
**Impact:** High - Prevents enum/type errors
**Status:** Not Started

## Context

From the anatomy system improvements analysis, recipe properties can use invalid enum values that pass schema validation but fail at runtime. This was a consistent issue across 75% of all anatomy recipes tested.

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
import Ajv from 'ajv';

/**
 * Validates that recipe property values match component dataSchemas
 * @param {Object} recipe - The recipe to validate
 * @param {Object} componentRegistry - Registry of loaded components with schemas
 * @param {Object} ajv - AJV instance for schema validation
 * @returns {Array<Object>} Array of errors found
 */
function validatePropertySchemas(recipe, componentRegistry, ajv) {
  const errors = [];

  // Validate slot properties
  for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
    for (const [componentId, properties] of Object.entries(slot.properties || {})) {
      const component = componentRegistry.get(componentId);

      if (!component) {
        // Component existence is validated by ANASYSIMP-001
        // Skip validation if component doesn't exist
        continue;
      }

      const schemaErrors = validateComponentProperties(
        componentId,
        properties,
        component.dataSchema,
        ajv
      );

      if (schemaErrors.length > 0) {
        errors.push({
          type: 'INVALID_PROPERTY_VALUE',
          location: { type: 'slot', name: slotName },
          componentId: componentId,
          properties: properties,
          schemaErrors: schemaErrors,
          schemaPath: component.filePath,
          severity: 'error',
        });
      }
    }
  }

  // Validate pattern properties
  for (const pattern of recipe.patterns || []) {
    const patternId = pattern.matchesPattern || pattern.matchesGroup || 'unknown';

    for (const [componentId, properties] of Object.entries(pattern.properties || {})) {
      const component = componentRegistry.get(componentId);

      if (!component) {
        continue; // Caught by component existence validator
      }

      const schemaErrors = validateComponentProperties(
        componentId,
        properties,
        component.dataSchema,
        ajv
      );

      if (schemaErrors.length > 0) {
        errors.push({
          type: 'INVALID_PROPERTY_VALUE',
          location: { type: 'pattern', name: patternId },
          componentId: componentId,
          properties: properties,
          schemaErrors: schemaErrors,
          schemaPath: component.filePath,
          severity: 'error',
        });
      }
    }
  }

  return errors;
}

/**
 * Validates a property object against a component's dataSchema
 * @param {string} componentId - Component identifier
 * @param {Object} properties - Property values to validate
 * @param {Object} dataSchema - Component dataSchema
 * @param {Object} ajv - AJV instance
 * @returns {Array<Object>} Array of formatted validation errors
 */
function validateComponentProperties(componentId, properties, dataSchema, ajv) {
  const errors = [];

  const valid = ajv.validate(dataSchema, properties);

  if (!valid && ajv.errors) {
    for (const error of ajv.errors) {
      errors.push(formatPropertyError(componentId, properties, error, dataSchema));
    }
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
function formatPropertyError(componentId, properties, ajvError, dataSchema) {
  const propertyPath = ajvError.instancePath.replace(/^\//, '');
  const propertyName = propertyPath || ajvError.params.missingProperty;

  const error = {
    property: propertyName,
    message: ajvError.message,
    currentValue: getPropertyValue(properties, propertyPath),
  };

  // Add enum suggestions for enum validation failures
  if (ajvError.keyword === 'enum' && ajvError.params.allowedValues) {
    error.validValues = ajvError.params.allowedValues;
    error.suggestion = suggestClosestValue(
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
function getPropertyValue(obj, path) {
  if (!path) return obj;
  return path.split('/').reduce((current, key) => current?.[key], obj);
}

/**
 * Suggests the closest matching value from a list of valid values
 * @param {*} value - Invalid value
 * @param {Array} validValues - List of valid values
 * @returns {*} Closest matching valid value
 */
function suggestClosestValue(value, validValues) {
  if (typeof value !== 'string') return validValues[0];

  // Simple string similarity: find shortest edit distance
  let closest = validValues[0];
  let minDistance = Infinity;

  for (const valid of validValues) {
    const distance = levenshteinDistance(value.toLowerCase(), valid.toLowerCase());
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
function levenshteinDistance(a, b) {
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
```

### Integration Points

1. **Recipe Loader Hook**
   - File: `src/loaders/recipeLoader.js`
   - Hook: After component existence validation
   - Action: Run property schema validation, throw on errors

2. **Component Registry Access**
   - File: `src/entities/componentRegistry.js`
   - Method: `get(componentId)` - Retrieve component with dataSchema and filePath

3. **AJV Instance**
   - Use existing AJV instance from schema validator
   - File: `src/validation/ajvSchemaValidator.js`

### File Structure

```
src/anatomy/validation/
├── propertySchemaValidator.js  # Main validator
├── propertyErrorFormatter.js   # Error formatting utilities
└── validationErrors.js         # Error class definitions

tests/unit/anatomy/validation/
├── propertySchemaValidator.test.js
└── propertyErrorFormatter.test.js

tests/integration/anatomy/validation/
└── propertyValidation.integration.test.js
```

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

### Component Registry Requirements

Components in the registry must provide:
```javascript
{
  id: 'anatomy:horned',
  dataSchema: { /* AJV-compatible JSON Schema */ },
  filePath: 'data/mods/anatomy/components/horned.component.json'
}
```

### Error Message Template

```
[ERROR] Invalid component property value

Context:  Recipe 'red_dragon.recipe.json', Slot 'head', Component 'anatomy:horned'
Problem:  Property 'length' has invalid value 'vast'
Impact:   Runtime validation will fail when entity is instantiated
Fix:      Change property value to valid enum option

Current Value:  "vast"
Valid Values:   ["short", "medium", "long"]
Suggestion:     "long" (closest match)

Component Schema: data/mods/anatomy/components/horned.component.json

Example Fix:
{
  "properties": {
    "anatomy:horned": {
      "style": "crown",
      "length": "long"  // ← Changed from "vast"
    }
  }
}
```

### AJV Integration

The validator reuses the existing AJV instance to ensure consistent validation:
```javascript
import { ajv } from '../validation/ajvSchemaValidator.js';

function validatePropertySchemas(recipe, componentRegistry) {
  return validatePropertySchemasWithAjv(recipe, componentRegistry, ajv);
}
```

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
