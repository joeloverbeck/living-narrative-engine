# Schema-Driven Validation Developer Guide

## Overview

This guide explains how to add enhanced validation to component schemas using the `validationRules` extension. This system automatically generates validators with improved error messages and intelligent suggestions for typos.

**Implementation Status:** ✅ Fully operational (85% complete)
**Location:** `src/validation/validatorGenerator.js`
**Integration:** Two-stage validation pipeline with AjvSchemaValidator

## Quick Start

### Basic Example

Add `validationRules` to any component schema to enable enhanced validation:

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
        "enum": ["smooth", "rough", "bumpy", "coarse"],
        "default": "smooth"
      }
    },
    "required": ["texture"]
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid texture: \"{{value}}\". Valid options: {{validValues}}",
      "missingRequired": "Missing required field: {{field}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 1
    }
  }
}
```

### What You Get

When a user provides invalid input:

```javascript
// Input: { texture: "smoth" }  // typo

// Without validationRules (standard AJV):
// "should be equal to one of the allowed values"

// With validationRules (ValidatorGenerator):
// "Invalid texture: 'smoth'. Did you mean 'smooth'?"
//                                         ^^^^^^^^ Levenshtein suggestion
```

## validationRules Schema

### Complete Structure

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "string template",
      "missingRequired": "string template",
      "invalidType": "string template"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 1
    }
  }
}
```

### Field Descriptions

#### `generateValidator` (boolean, required)
- **Purpose:** Enable/disable validator generation for this component
- **Default:** N/A (must be explicitly set)
- **Recommendation:** Always set to `true` when adding validationRules

#### `errorMessages` (object, optional)
Custom error message templates with placeholder support.

**Available Placeholders:**
- `{{value}}` - The invalid value provided
- `{{validValues}}` - List of valid enum values (comma-separated)
- `{{field}}` - The property name
- `{{expectedType}}` - The expected data type
- `{{actualType}}` - The actual data type received

**Supported Error Types:**
- `invalidEnum` - Used when value not in enum list
- `missingRequired` - Used when required field is absent
- `invalidType` - Used when value has wrong data type

**Example:**
```json
{
  "errorMessages": {
    "invalidEnum": "Invalid {{field}}: \"{{value}}\". Expected one of: {{validValues}}",
    "missingRequired": "The field '{{field}}' is required but was not provided",
    "invalidType": "Expected {{field}} to be {{expectedType}}, got {{actualType}}"
  }
}
```

#### `suggestions` (object, optional)
Configuration for typo suggestions using Levenshtein distance.

**Fields:**
- `enableSimilarity` (boolean) - Enable/disable similarity matching
- `maxDistance` (number, 0-10) - Maximum edit distance for suggestions (default: 3)
- `maxSuggestions` (number) - Maximum number of suggestions to return (default: 1)

**Levenshtein Distance Guide:**
- Distance 1: Single character change ("smooth" → "smoth")
- Distance 2: Two character changes ("athletic" → "athetic")
- Distance 3: Three character changes ("massive" → "masive")

**Recommendation:** Use `maxDistance: 3` for most cases.

## Validation Types

### 1. Enum Validation

**When to Use:** Properties with predefined list of valid values

**Example:**
```json
{
  "dataSchema": {
    "properties": {
      "build": {
        "type": "string",
        "enum": ["slim", "athletic", "stocky", "heavyset", "massive"]
      }
    }
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid build: \"{{value}}\". Valid options: {{validValues}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3
    }
  }
}
```

**Result:**
```javascript
// Input: { build: "athlet" }
// Output: "Invalid build: 'athlet'. Did you mean 'athletic'?"
```

### 2. Type Validation

**When to Use:** Enforce correct data types

**Supported Types:**
- `string`
- `number`
- `integer`
- `boolean`
- `array`
- `object`
- `null`

**Example:**
```json
{
  "dataSchema": {
    "properties": {
      "capacity": {
        "type": "number"
      }
    }
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidType": "Expected capacity to be {{expectedType}}, got {{actualType}}"
    }
  }
}
```

### 3. Required Field Validation

**When to Use:** Mandatory properties that must be present

**Example:**
```json
{
  "dataSchema": {
    "properties": {
      "name": { "type": "string" }
    },
    "required": ["name"]
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "missingRequired": "Missing required field: {{field}}"
    }
  }
}
```

## Migration Checklist

### Before You Start

- [ ] Identify component with enum properties or complex validation needs
- [ ] Check if component has existing validation logic
- [ ] Review component's dataSchema structure
- [ ] Determine appropriate error messages

### Migration Steps

1. **Open Component Schema File**
   ```bash
   # Component schemas are in:
   data/mods/{mod-name}/components/{component-name}.component.json
   ```

2. **Add validationRules Section**
   ```json
   {
     // ... existing schema fields ...
     "validationRules": {
       "generateValidator": true
     }
   }
   ```

3. **Add Error Messages (Optional but Recommended)**
   ```json
   {
     "validationRules": {
       "generateValidator": true,
       "errorMessages": {
         "invalidEnum": "Custom message with {{placeholders}}",
         "missingRequired": "Required field: {{field}}",
         "invalidType": "Type error: {{field}}"
       }
     }
   }
   ```

4. **Enable Suggestions for Enums (Recommended)**
   ```json
   {
     "validationRules": {
       "generateValidator": true,
       "suggestions": {
         "enableSimilarity": true,
         "maxDistance": 3,
         "maxSuggestions": 1
       }
     }
   }
   ```

5. **Validate Schema**
   ```bash
   npm run validate
   ```

6. **Write Tests**
   - Add test cases for invalid enum values
   - Test typo suggestions
   - Test required field validation
   - Test type validation

7. **Run Tests**
   ```bash
   npm run test:unit
   npm run test:integration
   ```

### After Migration

- [ ] Schema validation passes
- [ ] Tests added and passing
- [ ] Error messages are user-friendly
- [ ] Typo suggestions working for enums
- [ ] Documentation updated (if component is documented)

## Best Practices

### DO ✅

1. **Use Descriptive Error Messages**
   ```json
   // Good
   "invalidEnum": "Invalid body build '{{value}}'. Choose from: {{validValues}}"

   // Bad
   "invalidEnum": "Invalid value"
   ```

2. **Enable Suggestions for Enums**
   ```json
   // Always enable for enum validation
   "suggestions": {
     "enableSimilarity": true,
     "maxDistance": 3
   }
   ```

3. **Keep maxDistance Reasonable**
   ```json
   // Good - catches most typos
   "maxDistance": 3

   // Too strict - misses valid suggestions
   "maxDistance": 1

   // Too lenient - suggests unrelated values
   "maxDistance": 10
   ```

4. **Test Edge Cases**
   - Empty values
   - Null values
   - Undefined values
   - Values with special characters
   - Case sensitivity

### DON'T ❌

1. **Don't Add validationRules to Marker Components**
   ```json
   // Component with empty schema - DON'T add validationRules
   {
     "id": "positioning:sitting_on",
     "description": "Marker component for sitting relationship",
     "dataSchema": {
       "type": "object",
       "properties": {},
       "additionalProperties": false
     }
     // No validationRules needed
   }
   ```

2. **Don't Duplicate AJV Validation**
   ```json
   // Don't create redundant type validation
   // AJV already validates types from dataSchema

   // Only add validationRules when you need:
   // - Better error messages
   // - Typo suggestions for enums
   // - Custom validation logic
   ```

3. **Don't Use Excessive maxDistance**
   ```json
   // Bad - will suggest unrelated values
   "maxDistance": 10  // Too high!

   // Good
   "maxDistance": 3   // Catches most typos
   ```

4. **Don't Forget Backward Compatibility**
   - `validationRules` is optional
   - Components without it still work (standard AJV validation)
   - Don't break existing mod compatibility

## Real-World Examples

### Example 1: Descriptor Component (descriptors:texture)

**File:** `data/mods/descriptors/components/texture.component.json`

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
        "enum": [
          "bumpy",
          "chitinous",
          "coarse",
          "corrugated",
          "cracked",
          "crystalline",
          "dimpled",
          "feathery",
          "fibrous",
          "flaky",
          "fluffy",
          "furry",
          "gelatinous",
          "glossy",
          "grainy",
          "greasy",
          "hairy",
          "hard",
          "knobby",
          "leathery",
          "metallic",
          "mucous-covered",
          "oily",
          "pebbly",
          "pitted",
          "prickly",
          "ridged",
          "rippled",
          "rough",
          "rubbery",
          "sandy",
          "scabby",
          "scaled",
          "scratchy",
          "silky",
          "slimy",
          "slippery",
          "smooth",
          "soft",
          "spiky",
          "spiny",
          "spongy",
          "sticky",
          "stony",
          "uneven",
          "velvety",
          "waxy",
          "woolly",
          "wrinkled"
        ],
        "default": "smooth"
      }
    },
    "required": ["texture"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid texture descriptor: \"{{value}}\". Valid options include: {{validValues}}. Please choose from the available texture types.",
      "missingRequired": "Texture descriptor is required. Please specify a texture type."
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 1
    }
  }
}
```

**Why This Works:**
- 47 enum values → high chance of typos
- Suggestions help users find correct values
- Clear error messages guide users
- Required validation ensures data completeness

### Example 2: Core Component (core:gender)

**File:** `data/mods/core/components/gender.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:gender",
  "description": "Represents the gender identity of an entity",
  "dataSchema": {
    "type": "object",
    "properties": {
      "gender": {
        "type": "string",
        "enum": ["male", "female", "non-binary", "other"],
        "description": "Gender identity"
      }
    },
    "required": ["gender"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid gender: \"{{value}}\". Valid options: {{validValues}}",
      "missingRequired": "Gender field is required"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 2
    }
  }
}
```

### Example 3: Clothing Component (clothing:wearable)

**File:** `data/mods/clothing/components/wearable.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "clothing:wearable",
  "description": "Marks an item as wearable clothing with equipment slots",
  "dataSchema": {
    "type": "object",
    "properties": {
      "slot": {
        "type": "string",
        "enum": ["head", "torso", "legs", "feet", "hands", "waist"],
        "description": "The equipment slot this item occupies"
      },
      "layer": {
        "type": "string",
        "enum": ["base", "mid", "outer", "accessory"],
        "description": "The layer this clothing occupies (for layering system)"
      }
    },
    "required": ["slot", "layer"],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {{field}}: \"{{value}}\". Valid options: {{validValues}}",
      "missingRequired": "Required field '{{field}}' is missing from wearable component"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 2
    }
  }
}
```

## Common Patterns

### Pattern 1: Simple Enum Validation

**Use Case:** Small enum list (< 10 values), straightforward validation

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {{field}}: \"{{value}}\". Options: {{validValues}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 2
    }
  }
}
```

### Pattern 2: Large Enum with Detailed Messages

**Use Case:** Large enum list (> 20 values), need guidance

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {{field}} descriptor: \"{{value}}\". Valid options include: {{validValues}}. Please choose from the available types."
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 1
    }
  }
}
```

### Pattern 3: Type and Required Validation

**Use Case:** Non-enum properties that must exist with correct type

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidType": "Field '{{field}}' must be {{expectedType}}, got {{actualType}}",
      "missingRequired": "Required field '{{field}}' is missing"
    }
  }
}
```

### Pattern 4: Minimal Validation

**Use Case:** Just want suggestions, use default messages

```json
{
  "validationRules": {
    "generateValidator": true,
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3
    }
  }
}
```

## Performance Considerations

### Validator Caching

The ValidatorGenerator automatically caches generated validators:

```javascript
// First validation - generates validator
ajvValidator.validate(data, "descriptors:texture");

// Subsequent validations - uses cached validator (fast!)
ajvValidator.validate(data, "descriptors:texture");
```

**No action needed** - caching is automatic.

### Pre-Generation (Startup Optimization)

To optimize startup performance, validators can be pre-generated:

```javascript
// During mod loading (after component schemas loaded):
ajvValidator.preGenerateValidators([
  "descriptors:texture",
  "descriptors:build",
  "descriptors:height",
  // ... other frequently-used components
]);
```

**Status:** Feature exists but not yet integrated into startup sequence.

### Cache Management

Clear the validator cache when needed:

```javascript
// Clear all cached validators
ajvValidator.clearCache();
```

**When to Clear:**
- After schema hot-reload during development
- When debugging validation issues
- After mod configuration changes

## Troubleshooting

### Issue: Validation Not Working

**Symptom:** Standard AJV errors instead of enhanced messages

**Solutions:**
1. Verify `generateValidator: true` in validationRules
2. Check schema syntax (run `npm run validate`)
3. Ensure component ID matches what you're validating against
4. Check browser console for errors

### Issue: No Suggestions Generated

**Symptom:** Error message but no "Did you mean..." suggestion

**Solutions:**
1. Verify `enableSimilarity: true` in suggestions config
2. Check if typo is within maxDistance threshold
3. Ensure property has enum defined in dataSchema
4. Test with obvious typo (1-2 character difference)

### Issue: Validation Performance Slow

**Symptom:** Noticeable delay during validation

**Solutions:**
1. Enable pre-generation for frequently-used components
2. Check if maxDistance is too high (> 5)
3. Verify validator caching is working
4. Profile validation calls to identify bottlenecks

### Issue: Error Messages Not Customized

**Symptom:** Generic error messages appear

**Solutions:**
1. Verify errorMessages object in validationRules
2. Check placeholder syntax (use `{{placeholders}}` not `${placeholders}`)
3. Ensure error type matches (invalidEnum, missingRequired, invalidType)
4. Test with specific invalid input

## Testing Guidelines

### Unit Test Template

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('MyComponent - Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reject invalid enum value with suggestion', () => {
    const validator = testBed.getValidator();

    const result = validator.validate(
      { myField: "invald" },  // typo
      "my_mod:my_component"
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0].suggestion).toBe("invalid");
    expect(result.errors[0].message).toContain("Did you mean");
  });

  it('should reject missing required field', () => {
    const validator = testBed.getValidator();

    const result = validator.validate({}, "my_mod:my_component");

    expect(result.isValid).toBe(false);
    expect(result.errors[0].type).toBe("missingRequired");
  });

  it('should accept valid input', () => {
    const validator = testBed.getValidator();

    const result = validator.validate(
      { myField: "valid" },
      "my_mod:my_component"
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

### Integration Test Template

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createModTestFixture } from '../../common/mods/modTestFixture.js';

describe('MyComponent - Integration Validation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await createModTestFixture('my_mod');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should validate component data in real mod context', async () => {
    const entity = fixture.createEntity({
      'my_mod:my_component': { myField: "valid" }
    });

    // Validation happens automatically during entity creation
    expect(entity.id).toBeDefined();
  });

  it('should fail validation with invalid data', async () => {
    expect(() => {
      fixture.createEntity({
        'my_mod:my_component': { myField: "invalid_value" }
      });
    }).toThrow(/Invalid.*myField/);
  });
});
```

## Migration Priority Guide

### High Priority Components

Migrate these first for maximum impact:

1. **Descriptor Components** - High enum count, frequent typos
   - `descriptors:texture` ✅ Done
   - `descriptors:color_*` ✅ Done
   - `descriptors:build` ✅ Done
   - `descriptors:height` ✅ Done
   - etc. (35/36 complete)

2. **Core Actor Components** - Essential validation
   - `core:gender` ✅ Done
   - `core:player_type` ✅ Done
   - `core:material` ✅ Done
   - `core:notes` ✅ Done
   - Remaining: 27 components

3. **Inventory/Items** - Important for game mechanics
   - `items:*` (0/15 complete)
   - Priority: container, inventory, item, portable, weight

### Medium Priority Components

4. **Positioning Components** - Relationship validation
   - `positioning:*` (0/21 complete)
   - Many are marker components (may not need validation)

5. **Movement Components** - Navigation system
   - `movement:*` (0/6 complete)

### Lower Priority Components

6. **Marker/Tag Components** - Empty schemas
   - Example: `positioning:sitting_on` (no properties)
   - May not need validationRules

7. **Activity Components**
   - `activity:*` (1/1 complete)

## FAQ

### Q: Should I add validationRules to every component?

**A:** No. Only add validationRules when:
- Component has enum properties (for typo suggestions)
- Custom error messages would improve user experience
- Component has complex validation requirements

Marker components with empty schemas don't need validationRules.

### Q: What's the difference between AJV validation and ValidatorGenerator?

**A:**
- **AJV (Stage 1):** Structural validation against JSON Schema
- **ValidatorGenerator (Stage 2):** Enhanced error messages + typo suggestions

ValidatorGenerator complements AJV, doesn't replace it. Both run in sequence.

### Q: Can I use validationRules without enum properties?

**A:** Yes! ValidatorGenerator supports:
- Type validation (any property with `type`)
- Required field validation (any field in `required` array)
- Enum validation with suggestions (properties with `enum`)

### Q: How do I test my validationRules?

**A:** Three approaches:
1. Run unit tests with `npm run test:unit`
2. Use integration tests with real mod context
3. Test manually by loading mod and triggering validation

### Q: Will validationRules break existing mods?

**A:** No. `validationRules` is optional and backward compatible:
- Components without validationRules use standard AJV validation
- No changes required to existing components
- Migration is incremental and non-breaking

### Q: What happens if I make a syntax error in validationRules?

**A:** Schema validation will catch it:
```bash
npm run validate
# Will report: "validationRules syntax error at..."
```

### Q: Can I disable suggestions for specific components?

**A:** Yes:
```json
{
  "suggestions": {
    "enableSimilarity": false  // Disables suggestions
  }
}
```

### Q: How do I know if validationRules is working?

**A:** Check the error message:
- **Standard AJV:** "should be equal to one of the allowed values"
- **ValidatorGenerator:** "Invalid texture: 'smoth'. Did you mean 'smooth'?"

If you see the second format, it's working!

## Additional Resources

### Source Code

- **ValidatorGenerator:** `src/validation/validatorGenerator.js` (345 lines)
- **AjvSchemaValidator:** `src/validation/ajvSchemaValidator.js` (integration point)
- **StringSimilarityCalculator:** `src/utils/stringSimilarityCalculator.js` (Levenshtein)
- **DI Registration:** `src/dependencyInjection/registrations/loadersRegistrations.js`

### Test Examples

- **Unit Tests:** `tests/unit/validation/validatorGenerator.test.js`
- **Integration Tests:** `tests/integration/validation/ajvValidatorGeneratorIntegration.integration.test.js`

### Related Documentation

- **Workflow:** `workflows/ANASYSIMP-019-schema-driven-validation-generation.md`
- **Component Schema:** `data/schemas/component.schema.json`
- **Validation Workflow:** `docs/anatomy/validation-workflow.md`

### Migration Status

See `workflows/ANASYSIMP-019-schema-driven-validation-generation.md` for:
- Current migration progress (46/131 components)
- Remaining work breakdown
- Implementation roadmap

## Support

For questions or issues:
1. Check this guide first
2. Review existing migrated components for examples
3. Check workflow document for implementation status
4. Run tests to verify your changes
5. Consult source code for advanced use cases

---

**Last Updated:** 2025-01-13
**Implementation Status:** 85% Complete (Core infrastructure operational)
**Migration Progress:** 46/131 components (35%)
