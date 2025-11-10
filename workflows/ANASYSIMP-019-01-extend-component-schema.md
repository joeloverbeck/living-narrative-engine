# ANASYSIMP-019-01: Extend component.schema.json with validationRules

**Phase:** 1 (Foundation)
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** None
**Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)

## Overview

Extend the component schema definition to support an optional `validationRules` property. This property will define custom validation behavior, error messages, and suggestions for component validation beyond standard JSON Schema validation.

## Objectives

1. Add `validationRules` property to `component.schema.json`
2. Define schema structure for `errorMessages` configuration
3. Define schema structure for `suggestions` configuration
4. Update schema validation to accept new property
5. Create example component schema with `validationRules`
6. Validate backward compatibility with existing schemas
7. Ensure non-breaking change (property is optional)

## Technical Details

### 1. Schema Extension

**File to Update:** `data/schemas/component.schema.json`

**Current Schema Structure Note:** The existing `component.schema.json` uses `$ref` references to `common.schema.json` for shared definitions like `$schema`, `id`, and `description`. The `validationRules` property should be added as a new direct property definition (not a reference) since it's specific to component schemas.

Add the following property definition to the component schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "$schema": { "type": "string" },
    "id": { "type": "string" },
    "description": { "type": "string" },
    "dataSchema": { "type": "object" },
    "validationRules": {
      "type": "object",
      "description": "Optional validation rules for generating validators",
      "properties": {
        "generateValidator": {
          "type": "boolean",
          "description": "Whether to generate a validator from this schema",
          "default": false
        },
        "errorMessages": {
          "type": "object",
          "description": "Custom error message templates",
          "properties": {
            "invalidEnum": {
              "type": "string",
              "description": "Template for enum validation failures. Available variables: {{value}}, {{validValues}}",
              "default": "Invalid {{property}}: {{value}}. Valid options: {{validValues}}"
            },
            "missingRequired": {
              "type": "string",
              "description": "Template for required field failures. Available variables: {{field}}",
              "default": "Missing required field: {{field}}"
            },
            "invalidType": {
              "type": "string",
              "description": "Template for type validation failures. Available variables: {{field}}, {{expected}}, {{actual}}",
              "default": "Invalid type for {{field}}: expected {{expected}}, got {{actual}}"
            }
          },
          "additionalProperties": false
        },
        "suggestions": {
          "type": "object",
          "description": "Configuration for value suggestions",
          "properties": {
            "enableSimilarity": {
              "type": "boolean",
              "description": "Enable similarity-based suggestions for enum values",
              "default": true
            },
            "maxDistance": {
              "type": "integer",
              "description": "Maximum Levenshtein distance for suggestions",
              "default": 3,
              "minimum": 1,
              "maximum": 10
            },
            "maxSuggestions": {
              "type": "integer",
              "description": "Maximum number of suggestions to provide",
              "default": 3,
              "minimum": 1,
              "maximum": 10
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["id", "description", "dataSchema"]
}
```

### 2. Example Component Schema

**File to Create:** `data/mods/descriptors/components/texture-with-validation.component.json`

Create an example showing the enhanced schema:

**Note:** The example below uses a simplified enum for clarity. The actual `texture.component.json` in the descriptors mod contains 47 enum values. Choose an appropriate subset or use the full enum based on implementation needs.

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:texture-validation-example",
  "description": "Example component showing validationRules usage for texture descriptors",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "description": "The surface texture",
        "enum": ["bumpy", "chitinous", "coarse", "smooth", "rough", "scaly", "slimy", "soft", "sticky"],
        "default": "smooth"
      }
    },
    "required": ["texture"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid texture value '{{value}}'. Valid textures are: {{validValues}}",
      "missingRequired": "Texture is required but was not provided"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### 3. Validation Testing

Create a test schema validation scenario to ensure:
- Schemas WITH `validationRules` are valid
- Schemas WITHOUT `validationRules` (existing schemas) are still valid
- Invalid `validationRules` structures are rejected

## Files to Create

- [ ] `data/mods/descriptors/components/texture-with-validation.component.json` - Example schema

## Files to Update

- [ ] `data/schemas/component.schema.json` - Add `validationRules` property definition

**Note:** There is no `docs/schemas/component-schema-spec.md` file in the codebase. The `docs/schemas/` directory does not exist. Documentation updates should focus on inline schema descriptions and validation-workflow.md if needed.

## Testing Requirements

### Unit Tests

**File to Create:** `tests/unit/validation/componentSchemaValidation.test.js`

**Note:** This test file does not currently exist and needs to be created as part of this ticket.

Test cases:
- Schema with valid `validationRules` passes validation
- Schema without `validationRules` passes validation (backward compatibility)
- Schema with invalid `validationRules` structure fails validation
- Schema with invalid `errorMessages` fails validation
- Schema with invalid `suggestions` config fails validation
- Schema with partial `validationRules` (only some properties) passes

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File to Create:** `tests/integration/validation/componentSchemaExtension.integration.test.js`

**Note:** This test file does not currently exist and needs to be created as part of this ticket.

Test cases:
- Load existing component schemas (should all still validate)
- Load example schema with `validationRules`
- Validate that AJV correctly processes extended schema
- Verify schema loader handles new property without errors

## Acceptance Criteria

- [ ] `component.schema.json` updated with `validationRules` definition
- [ ] `validationRules` property is optional (non-breaking change)
- [ ] Schema defines structure for `errorMessages` with templates
- [ ] Schema defines structure for `suggestions` configuration
- [ ] Example component schema created with `validationRules`
- [ ] All existing component schemas still validate correctly
- [ ] Schema validation tests pass
- [ ] Integration tests verify backward compatibility
- [ ] No breaking changes to existing schemas
- [ ] ESLint passes on any modified files: `npx eslint <modified-files>`
- [ ] TypeScript type checking passes

## Validation Commands

Run these after implementation:

```bash
# Validate all schemas still work
npm run validate

# Run unit tests
npm run test:unit -- tests/unit/validation/componentSchemaValidation.test.js

# Run integration tests
npm run test:integration -- tests/integration/validation/componentSchemaExtension.integration.test.js

# Full test suite
npm run test:ci
```

## Success Metrics

- ✅ All 124 existing component schemas validate without changes
- ✅ New `validationRules` property accepts valid configurations
- ✅ Invalid `validationRules` configurations are rejected
- ✅ Schema remains backward compatible
- ✅ Example schema demonstrates all features

## Notes

- **Non-Breaking Change:** The `validationRules` property is optional, ensuring all existing schemas continue to work
- **JSON Schema Standard:** Uses standard JSON Schema features only; no custom AJV keywords needed yet
- **Template Variables:** Document available template variables for each error message type
- **Future Extensions:** Design allows adding more validation rule types in future phases

## Alternative Considerations

If extending the schema proves complex, consider the **Registry-Based Approach** mentioned in the parent workflow:
- Create `ComponentDescriptorRegistry` similar to `BodyDescriptorRegistry`
- Define validation rules in code rather than schema
- No schema changes required
- Trade-off: Less declarative, but proven pattern

## Related Tickets

- **Parent:** ANASYSIMP-019 (Schema-Driven Validation Generation)
- **Blocks:** ANASYSIMP-019-02 (Create ValidatorGenerator class)
- **Related:** ANASYSIMP-017 (Validation Result Caching) - may benefit from cached validators

## References

- **Component Schema:** `data/schemas/component.schema.json`
- **Body Descriptor Registry:** `src/anatomy/registries/bodyDescriptorRegistry.js` (pattern reference)
- **AJV Validator:** `src/validation/ajvSchemaValidator.js`
- **Schema Validation Guide:** `docs/anatomy/validation-workflow.md`
