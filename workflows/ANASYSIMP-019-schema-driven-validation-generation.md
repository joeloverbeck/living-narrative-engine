# ANASYSIMP-019: Schema-Driven Validation Generation

**Phase:** 4 (Future Enhancements)
**Priority:** P3
**Effort:** High (5-7 days)
**Impact:** Medium - Reduces maintenance burden
**Status:** Not Started

## Context

Validation logic is duplicated across validators and manually maintained. Schema-driven generation enables DRY principle and consistency.

## Solution Overview

Generate validators automatically from component schemas with validation rules and error messages defined in schema files.

## Implementation

### Enhanced Component Schema

```json
{
  "id": "descriptors:texture",
  "dataSchema": {
    "type": "object",
    "properties": {
      "texture": {
        "type": "string",
        "enum": ["scaled", "smooth", "rough"]
      }
    }
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

### Validator Generator

```javascript
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

## Implementation Considerations

Two approaches possible:

1. **Build-time generation**
   - Generate validator code during build
   - Commit generated validators
   - Faster runtime performance

2. **Runtime generation**
   - Generate validators on demand
   - No code generation needed
   - Easier to maintain

Recommend runtime generation for flexibility.

## Dependencies

**Depends On:**
- Component schema infrastructure
- Validation pipeline (ANASYSIMP-016)

## References

- **Report Section:** Recommendation 4.4
- **Report Pages:** Lines 1371-1422
