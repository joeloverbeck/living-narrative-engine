# Guide: Adding Body Descriptors

This guide walks through the complete process of adding a new body descriptor to the Living Narrative Engine's anatomy system.

## Prerequisites

Before adding a new body descriptor, ensure you have:

- ✅ Understanding of the [Body Descriptor Registry](./body-descriptor-registry.md) architecture
- ✅ Familiarity with the anatomy system (see [Anatomy System Architecture](./architecture.md))
- ✅ Knowledge of JSON schema validation
- ✅ Node.js development environment set up
- ✅ Ability to run tests and validation tools

## Overview

Adding a body descriptor requires updates to three key files:

1. **Registry** (`src/anatomy/registries/bodyDescriptorRegistry.js`) - Source of truth
2. **JSON Schema** (`data/schemas/anatomy.recipe.schema.json`) - Recipe validation
3. **Formatting Config** (`data/mods/anatomy/anatomy-formatting/default.json`) - Display configuration

The process takes approximately 15-30 minutes and includes validation and testing steps.

## Step-by-Step Process

### Step 1: Add to Registry (REQUIRED - Start Here)

**File**: `src/anatomy/registries/bodyDescriptorRegistry.js`

Add a new entry to the `BODY_DESCRIPTOR_REGISTRY` object:

```javascript
export const BODY_DESCRIPTOR_REGISTRY = {
  // ... existing descriptors (height, skinColor, build, etc.) ...

  // Your new descriptor
  posture: {
    // Schema property name (camelCase) - must match JSON schema property
    schemaProperty: 'posture',

    // Human-readable label for display
    displayLabel: 'Posture',

    // Key used in formatting config descriptionOrder (snake_case if multi-word)
    displayKey: 'posture',

    // Path to access data in body component
    dataPath: 'body.descriptors.posture',

    // Valid values - use array for enum, null for free-form strings
    validValues: ['slouched', 'relaxed', 'upright', 'rigid'],

    // Display order - use next available number (currently 70)
    // Increments of 10 allow easy insertion later
    displayOrder: 70,

    // Extractor function - retrieves value from body component
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.posture,

    // Formatter function - formats value for display
    formatter: (value) => `Posture: ${value}`,

    // Whether descriptor is required
    required: false,
  },
};
```

**Important Notes**:

- **schemaProperty**: Must match the JSON schema property name exactly (camelCase)
- **displayKey**: Use snake_case for multi-word descriptors (e.g., `body_hair`, `skin_color`)
- **validValues**:
  - Use an array for controlled vocabulary: `['value1', 'value2', 'value3']`
  - Use `null` for free-form strings that accept any value
- **displayOrder**: Next available is **70** (after smell at 60)
  - Current orders: 10 (height), 20 (skinColor), 30 (build), 40 (composition), 50 (hairDensity), 60 (smell)
  - Use increments of 10 to allow future insertion

### Step 2: Update JSON Schema

**File**: `data/schemas/anatomy.recipe.schema.json` (lines 135-198)

Locate the `bodyDescriptors` section and add your new property:

```json
{
  "bodyDescriptors": {
    "type": "object",
    "description": "Optional body-level descriptors to apply to generated body",
    "properties": {
      "height": {
        "type": "string",
        "enum": ["gigantic", "very-tall", "tall", "average", "short", "petite", "tiny"]
      },
      "skinColor": {
        "type": "string"
      },
      "build": {
        "type": "string",
        "enum": ["skinny", "slim", "lissom", "toned", "athletic", "shapely", "hourglass", "thick", "muscular", "hulking", "stocky"]
      },
      "composition": {
        "type": "string",
        "enum": ["underweight", "lean", "average", "soft", "chubby", "overweight", "obese"]
      },
      "hairDensity": {
        "type": "string",
        "enum": ["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"]
      },
      "smell": {
        "type": "string"
      },

      // ADD YOUR NEW DESCRIPTOR HERE
      "posture": {
        "type": "string",
        "enum": ["slouched", "relaxed", "upright", "rigid"],
        "description": "Character's typical posture and bearing"
      }
    },
    "additionalProperties": false
  }
}
```

**Important Notes**:

- Property name MUST match `schemaProperty` from registry (camelCase)
- For enumerated descriptors, the `enum` array must match `validValues` from registry
- For free-form descriptors, omit the `enum` property (just use `"type": "string"`)
- Always add a `description` to document the descriptor's purpose

**Validation Types**:

```json
// Enumerated (controlled vocabulary)
"posture": {
  "type": "string",
  "enum": ["slouched", "relaxed", "upright", "rigid"]
}

// Free-form (any string value)
"skinTone": {
  "type": "string",
  "description": "Detailed skin tone description (free-form)"
}

// With additional constraints
"age": {
  "type": "string",
  "pattern": "^(young|middle-aged|old)$",
  "description": "Age category"
}
```

### Step 3: Update Formatting Configuration

**File**: `data/mods/anatomy/anatomy-formatting/default.json`

Add your descriptor's `displayKey` to the `descriptionOrder` array:

```json
{
  "descriptionOrder": [
    "height",
    "skin_color",
    "build",
    "body_composition",
    "body_hair",
    "smell",
    "posture"  // ADD YOUR displayKey HERE
  ]
}
```

**Important Notes**:

- Use the `displayKey` from the registry entry (snake_case for multi-word descriptors)
- Position in this array determines display order in descriptions
- Descriptors NOT in this array will not appear in generated descriptions
- This array must include all registered descriptors

**Display Order Examples**:

```json
{
  "descriptionOrder": [
    // Physical measurements
    "height",

    // Appearance
    "skin_color",
    "build",
    "body_composition",
    "body_hair",

    // Sensory
    "smell",

    // Behavioral
    "posture"
  ]
}
```

### Step 4: Validate Changes

Run the validation tool to ensure all files are synchronized:

```bash
npm run validate:body-descriptors
```

**Expected Output (Success)**:

```
🔍 Body Descriptor System Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Checking Registry...
   Found 7 registered descriptors
   height, skinColor, build, composition, hairDensity, smell, posture

📄 Validating Formatting Configuration...
   ✅ Formatting configuration is valid

🧬 Validating Anatomy Recipes...
   ✅ human_male.recipe.json
   ✅ human_female.recipe.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Validation Passed

Body descriptor system is consistent.
```

**Common Validation Errors**:

```
❌ Errors:
   Body descriptor 'posture' defined in registry but missing from descriptionOrder
```

**Fix**: Add the descriptor's `displayKey` to the `descriptionOrder` array in formatting config.

```
❌ Invalid value 'invalid' for posture. Expected one of: slouched, relaxed, upright, rigid
```

**Fix**: Ensure the recipe uses only values from the descriptor's `validValues` array.

### Step 5: Add Tests

**File**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

Add tests for your new descriptor:

```javascript
import { describe, it, expect } from '@jest/globals';
import {
  getDescriptorMetadata,
  validateDescriptorValue,
  getAllDescriptorNames,
  getDescriptorsByDisplayOrder,
} from '../../../src/anatomy/registries/bodyDescriptorRegistry.js';

describe('bodyDescriptorRegistry - posture', () => {
  describe('metadata', () => {
    it('should have complete metadata for posture', () => {
      const metadata = getDescriptorMetadata('posture');

      expect(metadata).toBeDefined();
      expect(metadata.schemaProperty).toBe('posture');
      expect(metadata.displayLabel).toBe('Posture');
      expect(metadata.displayKey).toBe('posture');
      expect(metadata.dataPath).toBe('body.descriptors.posture');
      expect(metadata.displayOrder).toBe(70);
      expect(metadata.required).toBe(false);
    });

    it('should have correct valid values', () => {
      const metadata = getDescriptorMetadata('posture');

      expect(metadata.validValues).toEqual([
        'slouched',
        'relaxed',
        'upright',
        'rigid',
      ]);
    });

    it('should have extractor function', () => {
      const metadata = getDescriptorMetadata('posture');

      expect(typeof metadata.extractor).toBe('function');
    });

    it('should have formatter function', () => {
      const metadata = getDescriptorMetadata('posture');

      expect(typeof metadata.formatter).toBe('function');
      expect(metadata.formatter('upright')).toBe('Posture: upright');
    });
  });

  describe('validation', () => {
    it('should validate valid values', () => {
      expect(validateDescriptorValue('posture', 'slouched').valid).toBe(true);
      expect(validateDescriptorValue('posture', 'relaxed').valid).toBe(true);
      expect(validateDescriptorValue('posture', 'upright').valid).toBe(true);
      expect(validateDescriptorValue('posture', 'rigid').valid).toBe(true);
    });

    it('should reject invalid values', () => {
      const result = validateDescriptorValue('posture', 'invalid');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid value');
      expect(result.error).toContain('posture');
    });
  });

  describe('registry integration', () => {
    it('should be included in all descriptor names', () => {
      const allNames = getAllDescriptorNames();

      expect(allNames).toContain('posture');
    });

    it('should be included in display order list', () => {
      const orderedNames = getDescriptorsByDisplayOrder();

      expect(orderedNames).toContain('posture');
      expect(orderedNames[orderedNames.length - 1]).toBe('posture'); // Last in order (70)
    });
  });

  describe('extractor', () => {
    it('should extract posture from body component', () => {
      const metadata = getDescriptorMetadata('posture');
      const bodyComponent = {
        body: {
          descriptors: {
            posture: 'upright',
          },
        },
      };

      const result = metadata.extractor(bodyComponent);

      expect(result).toBe('upright');
    });

    it('should return undefined for missing posture', () => {
      const metadata = getDescriptorMetadata('posture');
      const bodyComponent = {
        body: {
          descriptors: {},
        },
      };

      const result = metadata.extractor(bodyComponent);

      expect(result).toBeUndefined();
    });

    it('should handle null body component', () => {
      const metadata = getDescriptorMetadata('posture');

      const result = metadata.extractor(null);

      expect(result).toBeUndefined();
    });
  });
});
```

Run the tests:

```bash
npm run test:unit -- tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js
```

### Step 6: Test Integration

Create a test recipe and verify the descriptor appears in generated descriptions:

**File**: `data/mods/your_mod/recipes/test_posture.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "your_mod:test_posture",
  "blueprintId": "anatomy:humanoid",
  "description": "Test recipe for posture descriptor",
  "bodyDescriptors": {
    "posture": "upright",
    "build": "athletic",
    "skinColor": "olive"
  },
  "slots": {
    "torso": {
      "partType": "torso"
    }
  }
}
```

**Integration Test** (optional but recommended):

```javascript
// tests/integration/anatomy/postureDescriptor.integration.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Posture Descriptor Integration', () => {
  let testBed;
  let anatomyService;
  let bodyDescriptionComposer;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.loadMods(['core', 'anatomy', 'your_mod']);

    anatomyService = testBed.getService('anatomyGenerationService');
    bodyDescriptionComposer = testBed.getService('bodyDescriptionComposer');
  });

  it('should include posture in generated body component', async () => {
    const result = await anatomyService.generateForEntity(
      'test_entity',
      'anatomy:humanoid',
      'your_mod:test_posture'
    );

    const bodyComponent = testBed.entityManager
      .getEntity(result.rootEntityId)
      .getComponentData('anatomy:body');

    expect(bodyComponent.body.descriptors.posture).toBe('upright');
  });

  it('should include posture in generated description', async () => {
    const result = await anatomyService.generateForEntity(
      'test_entity',
      'anatomy:humanoid',
      'your_mod:test_posture'
    );

    const entity = testBed.entityManager.getEntity(result.rootEntityId);
    const description = bodyDescriptionComposer.composeDescription(entity);

    expect(description).toContain('Posture: upright');
  });
});
```

## Verification Checklist

Before considering the descriptor complete, verify:

- [ ] Registry entry added with all 9 required fields
- [ ] Schema property matches `schemaProperty` exactly (camelCase)
- [ ] Schema `enum` array matches `validValues` (if enumerated)
- [ ] `displayKey` added to formatting config's `descriptionOrder`
- [ ] Validation tool passes: `npm run validate:body-descriptors`
- [ ] Unit tests added and passing
- [ ] Integration test created (optional but recommended)
- [ ] Descriptor appears in generated descriptions
- [ ] Documentation updated (if needed)

## Common Issues

### Descriptor Not Appearing in Descriptions

**Symptom**: Descriptor is set in recipe but doesn't appear in generated description.

**Diagnosis Steps**:

1. Check formatting config:
   ```bash
   grep -A 10 "descriptionOrder" data/mods/anatomy/anatomy-formatting/default.json
   ```

2. Verify `displayKey` is in the array:
   ```json
   "descriptionOrder": [..., "posture"]
   ```

3. Check body component has descriptor:
   ```javascript
   console.log(bodyComponent.body.descriptors); // Should include posture
   ```

**Solution**: Add `displayKey` to `descriptionOrder` array in formatting config.

### Validation Fails

**Symptom**: `npm run validate:body-descriptors` reports errors

**Common Causes**:

1. **Missing from formatting config**:
   ```
   ⚠️  Body descriptor 'posture' defined in registry but missing from descriptionOrder
   ```
   **Fix**: Add to `descriptionOrder` array

2. **Schema/Registry mismatch**:
   - Schema property name doesn't match registry `schemaProperty`
   - Schema `enum` values don't match registry `validValues`

   **Fix**: Ensure exact match between schema and registry

3. **Invalid values in test recipe**:
   ```
   ❌ Invalid value 'standing' for posture. Expected one of: slouched, relaxed, upright, rigid
   ```
   **Fix**: Use only values from `validValues` array

### Schema Validation Fails

**Symptom**: Recipes fail to load with schema validation errors

**Common Causes**:

```json
// ❌ Wrong property name (snake_case instead of camelCase)
{
  "bodyDescriptors": {
    "post_ure": "upright"  // Wrong - schema expects camelCase
  }
}

// ✅ Correct property name (camelCase)
{
  "bodyDescriptors": {
    "posture": "upright"  // Correct
  }
}
```

**Solution**: Always use the exact `schemaProperty` name from the registry (camelCase).

### Tests Failing

**Symptom**: Unit tests fail after adding descriptor

**Common Causes**:

1. Extractor function returns wrong value
2. Formatter function has incorrect format string
3. Missing test cases for edge cases (null, undefined, missing descriptor)

**Solution**: Verify extractor and formatter functions work correctly with test data.

## Example: Complete Workflow

Here's a complete example of adding a "muscleDefinition" descriptor:

### 1. Registry Entry

```javascript
muscleDefinition: {
  schemaProperty: 'muscleDefinition',
  displayLabel: 'Muscle definition',
  displayKey: 'muscle_definition',
  dataPath: 'body.descriptors.muscleDefinition',
  validValues: ['none', 'subtle', 'defined', 'very-defined', 'extreme'],
  displayOrder: 70,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.muscleDefinition,
  formatter: (value) => `Muscle definition: ${value}`,
  required: false,
},
```

### 2. Schema Entry

```json
"muscleDefinition": {
  "type": "string",
  "enum": ["none", "subtle", "defined", "very-defined", "extreme"],
  "description": "Level of visible muscle definition"
}
```

### 3. Formatting Config

```json
{
  "descriptionOrder": [
    "height",
    "skin_color",
    "build",
    "muscle_definition",  // Added
    "body_composition",
    "body_hair",
    "smell"
  ]
}
```

### 4. Validation

```bash
npm run validate:body-descriptors
# ✅ Validation Passed
```

### 5. Test Recipe

```json
{
  "recipeId": "test:bodybuilder",
  "bodyDescriptors": {
    "build": "muscular",
    "muscleDefinition": "extreme",
    "composition": "lean"
  }
}
```

### 6. Generated Description

```
Skin color: tanned
Build: muscular
Muscle definition: extreme
Body composition: lean
```

## Best Practices

### 1. Plan Before Coding

- Decide if descriptor should be enumerated or free-form
- Choose appropriate display order
- Consider relationship to existing descriptors

### 2. Use Descriptive Names

```javascript
// ✅ Good - clear, descriptive
muscleDefinition: { ... }
facialFeatures: { ... }

// ❌ Bad - vague, abbreviated
muscleDef: { ... }
ff: { ... }
```

### 3. Provide Meaningful Valid Values

```javascript
// ✅ Good - clear progression
validValues: ['none', 'subtle', 'defined', 'very-defined', 'extreme']

// ❌ Bad - unclear order
validValues: ['some', 'lots', 'medium']
```

### 4. Write Comprehensive Tests

Test all validation paths:
- Valid values
- Invalid values
- Edge cases (null, undefined, missing)
- Integration with body component

### 5. Update Documentation

If the descriptor serves a special purpose or has specific usage patterns, update relevant documentation:
- API documentation
- Usage guides
- Migration guides (if changing existing patterns)

### 6. Consider Backwards Compatibility

When adding descriptors:
- Make them optional (`required: false`)
- Don't break existing recipes
- Provide default behavior when absent

## Advanced Topics

### Creating Free-Form Descriptors

For descriptors that need flexibility:

```javascript
scars: {
  schemaProperty: 'scars',
  displayLabel: 'Scars',
  displayKey: 'scars',
  dataPath: 'body.descriptors.scars',
  validValues: null,  // Free-form - accepts any string
  displayOrder: 80,
  extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.scars,
  formatter: (value) => `Scars: ${value}`,
  required: false,
},
```

Schema (no enum):

```json
"scars": {
  "type": "string",
  "description": "Description of visible scars (free-form)"
}
```

### Complex Formatting

For advanced formatting logic:

```javascript
formatter: (value) => {
  const labels = {
    'none': 'No muscle definition',
    'subtle': 'Subtle muscle definition',
    'defined': 'Defined muscles',
    'very-defined': 'Highly defined musculature',
    'extreme': 'Extreme muscle definition',
  };
  return labels[value] || `Muscle definition: ${value}`;
}
```

### Conditional Validation

For descriptors with complex validation:

```javascript
// In schema, use more complex rules
"age": {
  "type": "string",
  "pattern": "^(young|middle-aged|elderly|ancient)$",
  "description": "Apparent age category"
}
```

## Next Steps

After successfully adding a descriptor:

1. Update user-facing documentation if needed
2. Consider creating test recipes that showcase the new descriptor
3. Add examples to migration guides if relevant
4. Share learnings with the team

## See Also

- [Body Descriptor Registry](./body-descriptor-registry.md) - Registry architecture and API
- [Body Descriptor Validator Reference](./body-descriptor-validator-reference.md) - Validator API
- [Anatomy System Architecture](./architecture.md) - Overall anatomy architecture
- [Body Descriptors Technical Guide](../development/body-descriptors-technical.md) - Technical details
- [Body Descriptor Migration Guide](../migration/body-descriptor-migration.md) - Migration patterns
