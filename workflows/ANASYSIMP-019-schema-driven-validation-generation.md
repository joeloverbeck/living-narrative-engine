# ANASYSIMP-019: Schema-Driven Validation Generation

**Phase:** 4 (Future Enhancements)
**Priority:** P3
**Effort:** High (5-7 days)
**Impact:** Medium - Reduces maintenance burden
**Status:** Not Started

## Context

Validation logic is duplicated across validators and manually maintained. Schema-driven generation enables DRY principle and consistency.

**Current State Assessment (2025-11-10):**
- ✅ Body Descriptor Registry exists as centralized validation source (`src/anatomy/registries/bodyDescriptorRegistry.js`)
- ✅ AJV-based schema validation is operational (`src/validation/ajvSchemaValidator.js`)
- ✅ Manual validator classes exist (e.g., `BodyDescriptorValidator`)
- ❌ Component schemas do NOT have `validationRules` sections
- ❌ No validator generation infrastructure exists
- ❌ Component schemas use standard JSON Schema only (no custom validation extensions)

## Solution Overview

Generate validators automatically from component schemas with validation rules and error messages defined in schema files.

## Implementation

### Enhanced Component Schema (PROPOSED)

**Current Component Schema Structure:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:texture",
  "description": "Describes the surface texture of an object",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "description": "The surface texture",
        "enum": ["bumpy", "chitinous", "coarse", "smooth", "rough", "..."],
        "default": "smooth"
      }
    },
    "required": ["texture"],
    "additionalProperties": false
  }
}
```

**Proposed Enhanced Schema (with validationRules extension):**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:texture",
  "description": "Describes the surface texture of an object",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "description": "The surface texture",
        "enum": ["bumpy", "chitinous", "coarse", "smooth", "rough", "..."],
        "default": "smooth"
      }
    },
    "required": ["texture"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid texture: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Missing required field: {{field}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3
    }
  }
}
```

**Note:** The `validationRules` section is a **NEW ADDITION** not currently present in component schemas. Implementation requires:
1. Updating component schema definition (`data/schemas/component.schema.json`)
2. Adding `validationRules` as optional property
3. Migrating existing component schemas (100+ files)

### Validator Generator (PROPOSED)

**Note:** This class does NOT currently exist in the codebase. This is a proposed implementation.

**Integration Point:** Would be added to `src/validation/` directory and integrated with `AjvSchemaValidator`.

```javascript
// Proposed: src/validation/validatorGenerator.js
class ValidatorGenerator {
  generate(componentSchema) {
    const validators = [];

    // Generate enum validators
    for (const [prop, schema] of Object.entries(componentSchema.dataSchema.properties)) {
      if (schema.enum) {
        validators.push(this.#generateEnumValidator(prop, schema));
      }

      if (schema.type) {
        validators.push(this.#generateTypeValidator(prop, schema));
      }
    }

    return this.#combineValidators(validators);
  }

  #generateEnumValidator(property, schema) {
    return (data) => {
      const value = data[property];
      const validValues = schema.enum;

      if (!validValues.includes(value)) {
        const suggestion = this.#findSimilarValue(value, validValues);
        return {
          valid: false,
          error: {
            property,
            message: `Invalid ${property}: ${value}. Valid options: ${validValues.join(', ')}`,
            suggestion,
          },
        };
      }

      return { valid: true };
    };
  }

  #combineValidators(validators) {
    return (data) => {
      const errors = [];

      for (const validator of validators) {
        const result = validator(data);
        if (!result.valid) {
          errors.push(result.error);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    };
  }
}
```

## Benefits

- **DRY principle** - Single source of truth
- **Consistent validation** - Same logic everywhere
- **Easier maintenance** - Update schema, validators regenerate
- **Better error messages** - Templated from schema

## Acceptance Criteria

- [ ] Validators generated from schemas
- [ ] Error messages templated from schema
- [ ] Enum validation auto-generated
- [ ] Type validation auto-generated
- [ ] Required field validation auto-generated
- [ ] Integration with existing validation pipeline
- [ ] Code generation or runtime generation supported

## Relationship to Existing Validation Systems

**Important Distinctions:**

1. **Body Descriptors vs Component Descriptors:**
   - **Body Descriptors** (height, build, composition, etc.) - Body-level attributes stored in `anatomy:body` component
     - Location: `src/anatomy/registries/bodyDescriptorRegistry.js`
     - Used in: Recipe `bodyDescriptors` field
     - Validator: `BodyDescriptorValidator` class
   - **Component Descriptors** (texture, color, shape, etc.) - Part-level attributes stored in individual anatomy part components
     - Location: `data/mods/descriptors/components/*.component.json`
     - Used in: Slot/pattern `components` array in recipes
     - Validation: Standard JSON Schema (AJV)

2. **Current Validation Landscape:**
   - **AJV Schema Validation**: Validates all JSON against schemas (automatic, Stage 1)
   - **Body Descriptor Validation**: Registry-based validation for body-level descriptors (manual class)
   - **Recipe Pre-flight Validation**: 9 validation rules for recipe integrity (manual validators)
   - **Runtime Graph Validation**: 6 rules for anatomy graph integrity (manual validators)
   - **This Workflow Proposes**: Automated validator generation for component-level validation

3. **Scope Clarification:**
   - This workflow targets **component descriptor validation** (texture, color, shape, etc.)
   - Does NOT target body descriptor validation (already has registry)
   - Does NOT replace AJV schema validation (foundation layer)
   - Complements existing validation by generating better error messages and suggestions

## Implementation Considerations

Two approaches possible:

1. **Build-time generation**
   - Generate validator code during build
   - Commit generated validators
   - Faster runtime performance
   - **Challenge**: 100+ component schemas to process
   - **Benefit**: Type safety at development time

2. **Runtime generation**
   - Generate validators on demand from schemas
   - No code generation needed
   - Easier to maintain
   - **Challenge**: Performance overhead on first load
   - **Benefit**: No build step, dynamic updates

**Recommendation**: Runtime generation for flexibility and ease of maintenance.

**Alternative Approach**: Extend Body Descriptor Registry pattern to component descriptors
- Create ComponentDescriptorRegistry (similar to BodyDescriptorRegistry)
- Register all component descriptors with validation rules
- Use registry-based validation (no code generation)
- **Advantage**: Proven pattern, already implemented for body descriptors
- **Disadvantage**: Requires manual registry entries for each descriptor

## Dependencies

**Depends On:**
- Component schema infrastructure (EXISTS)
- Validation pipeline infrastructure (EXISTS: `src/validation/ajvSchemaValidator.js`)
- Body Descriptor Registry pattern (EXISTS: `src/anatomy/registries/bodyDescriptorRegistry.js`)

**Requires Implementation:**
- Extension of `component.schema.json` to support `validationRules` property
- ValidatorGenerator class (does not exist)
- Integration with existing AJV validation pipeline
- Migration strategy for 100+ existing component schemas

**Integration Points:**
- `src/validation/ajvSchemaValidator.js` - Current AJV validation service
- `src/anatomy/registries/bodyDescriptorRegistry.js` - Registry pattern example
- `src/anatomy/validators/bodyDescriptorValidator.js` - Manual validator example
- `data/schemas/component.schema.json` - Component schema definition

## Implementation Roadmap

### Phase 1: Foundation (2-3 days)
1. **Extend component.schema.json**
   - Add optional `validationRules` property definition
   - Define schema structure for errorMessages and suggestions
   - Update schema validation to accept new property
   - Test with sample component schema

2. **Create ValidatorGenerator class**
   - Implement basic generator structure
   - Support enum validation with error messages
   - Support type validation
   - Support required field validation
   - Integration with existing validation pipeline

### Phase 2: Integration (1-2 days)
3. **Integrate with AjvSchemaValidator**
   - Modify `ajvSchemaValidator.js` to use ValidatorGenerator
   - Ensure backward compatibility with schemas without validationRules
   - Add runtime generation support
   - Test with existing validation workflows

4. **Create Migration Utilities**
   - Tool to analyze existing component schemas
   - Tool to suggest `validationRules` for existing enums
   - Validation to ensure consistency
   - Documentation for migration process

### Phase 3: Pilot Implementation (1-2 days)
5. **Pilot with Descriptor Components**
   - Migrate 5-10 descriptor components (texture, color, height, etc.)
   - Add `validationRules` sections
   - Test validation improvements
   - Document lessons learned

6. **Evaluate and Refine**
   - Measure error message quality improvement
   - Assess performance impact
   - Gather developer feedback
   - Adjust implementation based on findings

### Phase 4: Documentation & Rollout (1 day)
7. **Documentation**
   - Update component schema documentation
   - Document validationRules specification
   - Create migration guide for developers
   - Add examples to anatomy documentation

8. **Gradual Rollout**
   - Migrate remaining descriptor components (80+)
   - Consider automation for bulk migration
   - Update validation tests
   - Monitor for issues

## Migration Considerations

**Schema Migration Strategy:**
1. **Non-Breaking Change**: `validationRules` is optional, existing schemas continue to work
2. **Incremental Adoption**: Migrate schemas one mod at a time
3. **Validation Testing**: Ensure new validators produce expected errors
4. **Performance Monitoring**: Track validation performance before/after

**Risk Assessment:**
- **Low Risk**: Additive change, no breaking modifications
- **Medium Effort**: 100+ schemas to potentially migrate
- **High Value**: Significantly improved error messages and developer experience

**Rollback Plan:**
- Remove `validationRules` from schemas (backward compatible)
- ValidatorGenerator falls back to standard AJV validation
- No schema changes required if feature is abandoned

## Alternative: Registry-Based Approach

Given the success of `BodyDescriptorRegistry`, consider a registry-based approach instead:

### Advantages:
- Proven pattern already working in production
- No schema changes required
- Centralized validation logic
- Easier to maintain
- Type-safe (no code generation)

### Implementation:
```javascript
// src/validation/registries/componentDescriptorRegistry.js
export const COMPONENT_DESCRIPTOR_REGISTRY = {
  'descriptors:texture': {
    componentId: 'descriptors:texture',
    propertyName: 'texture',
    validValues: ['scaled', 'smooth', 'rough', '...'],
    errorTemplate: 'Invalid texture: {{value}}. Valid: {{validValues}}',
    suggestionEnabled: true,
    maxEditDistance: 3,
  },
  // ... other descriptors
};
```

### Comparison:
| Aspect | Schema-Driven | Registry-Based |
|--------|--------------|----------------|
| Schema Changes | Required | Not required |
| Code Generation | Optional | Not needed |
| Centralization | In schemas | In registry |
| Maintenance | Schema files | Single registry |
| Type Safety | Via generation | Via JSDoc |
| Proven Pattern | No | Yes (BodyDescriptor) |
| Migration Effort | High (100+ schemas) | Medium (registry entries) |

**Recommendation**: Consider registry-based approach as a lower-risk alternative with proven pattern.

## References

- **Report Section:** Recommendation 4.4
- **Report Pages:** Lines 1371-1422
- **Related Docs:**
  - Body Descriptor Registry: `src/anatomy/registries/bodyDescriptorRegistry.js`
  - Body Descriptor Validator: `src/anatomy/validators/bodyDescriptorValidator.js`
  - Body Descriptors Guide: `docs/anatomy/body-descriptors-complete.md`
  - Validation Workflow: `docs/anatomy/validation-workflow.md`
  - Component Schema: `data/schemas/component.schema.json`
