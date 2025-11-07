# Body Descriptors Complete Guide

This document provides comprehensive coverage of the Body Descriptor system in the Living Narrative Engine, including the registry architecture, adding new descriptors, validation, and API reference.

## Table of Contents

1. [Overview](#overview)
2. [Registry Architecture](#registry-architecture)
3. [Adding New Descriptors](#adding-new-descriptors)
4. [Validation System](#validation-system)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)
7. [Examples](#examples)

## Overview

The Body Descriptor Registry is the centralized source of truth for all body descriptor metadata in the Living Narrative Engine. It provides a single, unified place for managing descriptor properties, validation rules, and display configuration, eliminating the need for manual synchronization across multiple files.

### Purpose

The Body Descriptor system enables:

- **Centralized Configuration**: Single source of truth for all descriptor metadata
- **Automatic Validation**: Runtime and CLI validation of descriptor values
- **Consistent Display**: Unified formatting across the application
- **Easy Extension**: Straightforward process for adding new descriptors
- **Type Safety**: Enum validation for controlled vocabularies

### Key Benefits

- Eliminates manual synchronization across multiple files
- Prevents configuration drift between schema, code, and config
- Provides runtime validation of descriptor values
- Ensures consistent display ordering and formatting
- Simplifies adding new descriptors

## Registry Architecture

### Location

The body descriptor system spans several key files:

- **Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js` - Source of truth
- **Validator (Class)**: `src/anatomy/validators/bodyDescriptorValidator.js` - System validation
- **Validator (Utilities)**: `src/anatomy/utils/bodyDescriptorValidator.js` - Runtime helpers
- **Validation Script**: `scripts/validate-body-descriptors.js` - CLI tool
- **JSON Schema**: `data/schemas/anatomy.recipe.schema.json` (lines 135-198)
- **Formatting Config**: `data/mods/anatomy/anatomy-formatting/default.json`
- **Tests**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

### Registry Structure

Each descriptor in the registry contains 9 required properties:

```javascript
{
  schemaProperty: 'height',           // Property name in JSON schema (camelCase)
  displayLabel: 'Height',             // Human-readable label
  displayKey: 'height',               // Key in formatting config (snake_case if multi-word)
  dataPath: 'body.descriptors.height', // Path in body component
  validValues: ['gigantic', 'very-tall', ...], // Valid values or null for free-form
  displayOrder: 10,                   // Display priority (lower = earlier)
  extractor: (bodyComponent) => ...,  // Extraction function
  formatter: (value) => ...,          // Formatting function
  required: false,                    // Whether required
}
```

### Current Descriptors

The registry currently defines 6 body descriptors:

| Descriptor | Display Order | Valid Values | Type |
|-----------|--------------|--------------|------|
| height | 10 | gigantic, very-tall, tall, average, short, petite, tiny | Enumerated |
| skinColor | 20 | *any string* | Free-form |
| build | 30 | skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky | Enumerated |
| composition | 40 | underweight, lean, average, soft, chubby, overweight, obese | Enumerated |
| hairDensity | 50 | hairless, sparse, light, moderate, hairy, very-hairy | Enumerated |
| smell | 60 | *any string* | Free-form |

**Next Available Display Order**: 70

### Integration Points

**Recipe Processing**:
- Recipes define body descriptors in `bodyDescriptors` field
- AnatomyGenerationWorkflow copies descriptors to body component during generation
- Stored at `body.descriptors.{schemaProperty}` in anatomy:body component

**Validation**:
- `BodyDescriptorValidator` class validates system-wide consistency
- Runtime utilities validate descriptors during anatomy generation
- CLI tool (`npm run validate:body-descriptors`) checks system consistency

**Description Generation**:
- `BodyDescriptionComposer` uses registry extractors to retrieve values
- Registry formatters generate display strings
- Display order determines appearance order in descriptions

## Adding New Descriptors

### Prerequisites

Before adding a new body descriptor, ensure you have:

- ✅ Understanding of the Body Descriptor Registry architecture
- ✅ Familiarity with the anatomy system
- ✅ Knowledge of JSON schema validation
- ✅ Node.js development environment set up
- ✅ Ability to run tests and validation tools

### Overview

Adding a body descriptor requires updates to three key files:

1. **Registry** (`src/anatomy/registries/bodyDescriptorRegistry.js`) - Source of truth
2. **JSON Schema** (`data/schemas/anatomy.recipe.schema.json`) - Recipe validation
3. **Formatting Config** (`data/mods/anatomy/anatomy-formatting/default.json`) - Display configuration

The process takes approximately 15-30 minutes and includes validation and testing steps.

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
      // ... existing descriptors ...

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
      expect(metadata.displayOrder).toBe(70);
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
  });

  describe('validation', () => {
    it('should validate valid values', () => {
      expect(validateDescriptorValue('posture', 'upright').valid).toBe(true);
    });

    it('should reject invalid values', () => {
      const result = validateDescriptorValue('posture', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid value');
    });
  });
});
```

Run the tests:

```bash
npm run test:unit -- tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js
```

### Verification Checklist

Before considering the descriptor complete, verify:

- [ ] Registry entry added with all 9 required fields
- [ ] Schema property matches `schemaProperty` exactly (camelCase)
- [ ] Schema `enum` array matches `validValues` (if enumerated)
- [ ] `displayKey` added to formatting config's `descriptionOrder`
- [ ] Validation tool passes: `npm run validate:body-descriptors`
- [ ] Unit tests added and passing
- [ ] Descriptor appears in generated descriptions (integration test recommended)

## Validation System

### BodyDescriptorValidator Class

**Location**: `src/anatomy/validators/bodyDescriptorValidator.js`

The validator class provides comprehensive system-wide validation.

#### Constructor

```javascript
new BodyDescriptorValidator(options)
```

**Parameters**:
- `options` (object, optional): Configuration options
  - `logger` (object, optional): Logger instance (reserved for future use)

#### Methods

##### validateRecipeDescriptors()

Validates recipe body descriptors against the registry.

```javascript
validateRecipeDescriptors(bodyDescriptors)
```

**Returns**: `{valid: boolean, errors: string[], warnings: string[]}`

**Example**:

```javascript
const bodyDescriptors = {
  build: 'athletic',
  skinColor: 'olive',
};

const result = validator.validateRecipeDescriptors(bodyDescriptors);
// { valid: true, errors: [], warnings: [] }
```

##### validateFormattingConfig()

Validates formatting configuration against the registry.

```javascript
validateFormattingConfig(formattingConfig)
```

**Returns**: `{valid: boolean, errors: string[], warnings: string[]}`

**Example**:

```javascript
const formattingConfig = {
  descriptionOrder: ['height', 'skin_color', 'build', ...]
};

const result = validator.validateFormattingConfig(formattingConfig);
```

##### validateSystemConsistency()

Comprehensive validation of the entire body descriptor system.

```javascript
async validateSystemConsistency(options)
```

**Parameters**:
- `options` (object): Validation options
  - `dataRegistry` (object): DataRegistry instance for loading configuration and recipes

**Returns**: `Promise<{errors: string[], warnings: string[], info: string[]}>`

### CLI Tool

**Location**: `scripts/validate-body-descriptors.js`

#### Usage

```bash
npm run validate:body-descriptors
```

#### Features

The CLI tool provides:

1. **Registry Check**: Lists all registered descriptors
2. **Formatting Validation**: Validates formatting configuration
3. **Recipe Validation**: Checks sample recipes
4. **Clear Output**: Color-coded results with emojis
5. **Exit Codes**: Returns 0 on success, 1 on failure (CI-friendly)

#### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
name: CI

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - name: Validate Body Descriptors
        run: npm run validate:body-descriptors
```

### Validation Results

#### Result Structure

```typescript
interface ValidationResult {
  valid: boolean;      // Overall validation status
  errors: string[];    // Critical failures (must fix)
  warnings: string[];  // Non-critical issues (should fix)
  info?: string[];     // Informational messages
}
```

#### Common Validation Messages

**Errors** (Critical):
- `"Invalid value 'X' for Y. Expected one of: ..."` - Recipe uses invalid value
- `"Formatting config missing descriptionOrder"` - Missing required configuration
- `"Unknown descriptor: X"` - Descriptor not found in registry

**Warnings** (Non-Critical):
- `"Unknown body descriptor 'X' (not in registry)"` - Descriptor not registered
- `"Body descriptor 'X' defined in registry but missing from descriptionOrder"` - Won't appear in descriptions

## API Reference

### BODY_DESCRIPTOR_REGISTRY

The main registry object containing all descriptor metadata.

```javascript
import { BODY_DESCRIPTOR_REGISTRY } from './registries/bodyDescriptorRegistry.js';

// Access descriptor directly
const heightMeta = BODY_DESCRIPTOR_REGISTRY.height;
```

### getDescriptorMetadata(schemaProperty)

Get metadata for a specific descriptor.

**Parameters**:
- `schemaProperty` (string): The schema property name (e.g., 'height', 'skinColor')

**Returns**: `BodyDescriptorMetadata | undefined`

**Example**:
```javascript
const meta = getDescriptorMetadata('height');
// Returns: { schemaProperty: 'height', displayLabel: 'Height', ... }
```

### getAllDescriptorNames()

Get all registered descriptor names.

**Returns**: `string[]` - Array of descriptor schema property names

**Example**:
```javascript
const names = getAllDescriptorNames();
// Returns: ['height', 'skinColor', 'build', 'composition', 'hairDensity', 'smell']
```

### getDescriptorsByDisplayOrder()

Get descriptors sorted by display order.

**Returns**: `string[]` - Descriptor names sorted by `displayOrder` (ascending)

**Example**:
```javascript
const ordered = getDescriptorsByDisplayOrder();
// Returns: ['height', 'skinColor', 'build', 'composition', 'hairDensity', 'smell']
// Sorted by displayOrder: 10, 20, 30, 40, 50, 60
```

### validateDescriptorValue(descriptorName, value)

Validate a value against a descriptor's validation rules.

**Parameters**:
- `descriptorName` (string): Descriptor name
- `value` (string): Value to validate

**Returns**: `{valid: boolean, error?: string}`

**Example**:
```javascript
// Valid enumerated value
const result1 = validateDescriptorValue('height', 'tall');
// Returns: { valid: true }

// Invalid enumerated value
const result2 = validateDescriptorValue('height', 'super-tall');
// Returns: { valid: false, error: "Invalid value 'super-tall' for height..." }

// Free-form descriptor (always valid for any string)
const result3 = validateDescriptorValue('skinColor', 'olive');
// Returns: { valid: true }
```

## Troubleshooting

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

### Missing Registry Fields

**Symptom**: Errors or unexpected behavior when accessing descriptor metadata

**Diagnosis**: Every descriptor must have all 9 required fields:

1. `schemaProperty`
2. `displayLabel`
3. `displayKey`
4. `dataPath`
5. `validValues`
6. `displayOrder`
7. `extractor`
8. `formatter`
9. `required`

**Solution**: Verify registry entry contains all fields with correct types.

## Examples

### Example 1: Adding a Free-Form Descriptor

For descriptors that need flexibility:

```javascript
scars: {
  schemaProperty: 'scars',
  displayLabel: 'Scars',
  displayKey: 'scars',
  dataPath: 'body.descriptors.scars',
  validValues: null,  // Free-form - accepts any string
  displayOrder: 70,
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

### Example 2: Validating a Recipe

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';

const validator = new BodyDescriptorValidator();

const recipe = {
  recipeId: 'mymod:warrior',
  bodyDescriptors: {
    build: 'muscular',
    composition: 'lean',
    skinColor: 'tanned',
  },
};

const result = validator.validateRecipeDescriptors(recipe.bodyDescriptors);

if (result.valid) {
  console.log('✅ Recipe is valid');
} else {
  console.error('❌ Recipe validation failed:');
  result.errors.forEach(err => console.error(`  - ${err}`));
}
```

### Example 3: System-Wide Validation

```javascript
import { BodyDescriptorValidator } from './validators/bodyDescriptorValidator.js';

async function validateSystem(dataRegistry) {
  const validator = new BodyDescriptorValidator({ logger: console });

  console.log('🔍 Validating body descriptor system...\n');

  const result = await validator.validateSystemConsistency({ dataRegistry });

  // Report info
  result.info.forEach(msg => console.log(`ℹ️  ${msg}`));

  // Report warnings
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    result.warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  // Report errors
  if (result.errors.length > 0) {
    console.error('\n❌ Errors:');
    result.errors.forEach(err => console.error(`  - ${err}`));
    return false;
  }

  console.log('\n✅ System validation passed');
  return true;
}
```

### Example 4: Complex Formatting

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

## Best Practices

### 1. Always Add to Registry First

Never add descriptors directly to schemas or config files. Always start with the registry entry, then propagate changes to other files.

### 2. Run Validation After Changes

Always run `npm run validate:body-descriptors` after:
- Adding new descriptors
- Modifying valid values
- Changing display order
- Updating formatting config

### 3. Use Descriptive Names

```javascript
// ✅ Good - clear, descriptive
muscleDefinition: { ... }
facialFeatures: { ... }

// ❌ Bad - vague, abbreviated
muscleDef: { ... }
ff: { ... }
```

### 4. Provide Meaningful Valid Values

```javascript
// ✅ Good - clear progression
validValues: ['none', 'subtle', 'defined', 'very-defined', 'extreme']

// ❌ Bad - unclear order
validValues: ['some', 'lots', 'medium']
```

### 5. Write Comprehensive Tests

Test all validation paths:
- Valid values
- Invalid values
- Edge cases (null, undefined, missing)
- Integration with body component

### 6. Choose Appropriate Value Types

- Use **enumerated values** (array) for controlled vocabularies with a fixed set of options
- Use **free-form** (`null`) for descriptors that need flexibility (e.g., skin color variations)

### 7. Maintain Display Order

Use increments of 10 for display order to allow easy insertion of new descriptors:
- Current: 10, 20, 30, 40, 50, 60
- Next available: 70
- This allows inserting at 15, 25, 35, etc. if needed

## Related Documentation

- [Anatomy System Guide](./anatomy-system-guide.md) - Overall anatomy system architecture
- [Blueprints and Templates](./blueprints-and-templates.md) - Blueprint system documentation
- [Recipe Pattern Matching](./recipe-pattern-matching.md) - Pattern matching guide
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [Body Descriptors Technical Guide](../development/body-descriptors-technical.md) - Technical implementation details
- [Body Descriptor Migration Guide](../migration/body-descriptor-migration.md) - Migration from old patterns

---

**Maintained By**: Living Narrative Engine Core Team
**Last Updated**: 2025-11-07
