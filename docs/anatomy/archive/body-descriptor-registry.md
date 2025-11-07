# Body Descriptor Registry

## Overview

The Body Descriptor Registry is the centralized source of truth for all body descriptor metadata in the Living Narrative Engine. It provides a single, unified place for managing descriptor properties, validation rules, and display configuration, eliminating the need for manual synchronization across multiple files.

## Architecture

### Registry Structure

Each descriptor in the registry contains complete metadata:

- **schemaProperty**: Property name in JSON schema (camelCase, e.g., `skinColor`)
- **displayLabel**: Human-readable label for UI display (e.g., "Skin color")
- **displayKey**: Key used in formatting configuration (snake_case, e.g., `skin_color`)
- **dataPath**: Path to access data in body component (e.g., `body.descriptors.skinColor`)
- **validValues**: Array of valid values for enumerated descriptors, or `null` for free-form strings
- **displayOrder**: Numeric priority for display ordering (lower numbers display first)
- **extractor**: Function to extract value from body component
- **formatter**: Function to format value for display
- **required**: Boolean indicating if descriptor is required

### Location

The body descriptor system spans several key files:

- **Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js`
- **Validator**: `src/anatomy/validators/bodyDescriptorValidator.js`
- **Validation Script**: `scripts/validate-body-descriptors.js`
- **JSON Schema**: `data/schemas/anatomy.recipe.schema.json` (lines 135-198)
- **Formatting Config**: `data/mods/anatomy/anatomy-formatting/default.json`
- **Tests**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

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

## Usage

### Accessing Registry

The registry provides several functions for accessing descriptor metadata:

```javascript
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorMetadata,
  getAllDescriptorNames,
  getDescriptorsByDisplayOrder,
  validateDescriptorValue,
} from './registries/bodyDescriptorRegistry.js';

// Get specific descriptor metadata
const heightMetadata = getDescriptorMetadata('height');
console.log(heightMetadata.displayLabel); // "Height"
console.log(heightMetadata.validValues);  // ['gigantic', 'very-tall', ...]

// Get all descriptor names
const allDescriptors = getAllDescriptorNames();
// Returns: ['height', 'skinColor', 'build', 'composition', 'hairDensity', 'smell']

// Get descriptors sorted by display order
const orderedDescriptors = getDescriptorsByDisplayOrder();
// Returns descriptors in display order (10, 20, 30, 40, 50, 60)

// Validate a descriptor value
const result = validateDescriptorValue('height', 'tall');
console.log(result.valid); // true

const invalidResult = validateDescriptorValue('height', 'super-tall');
console.log(invalidResult.valid); // false
console.log(invalidResult.error); // "Invalid value 'super-tall' for height..."
```

### Adding a New Descriptor

To add a new body descriptor to the system:

#### 1. Add Entry to Registry

**File**: `src/anatomy/registries/bodyDescriptorRegistry.js`

```javascript
export const BODY_DESCRIPTOR_REGISTRY = {
  // ... existing descriptors ...

  posture: {
    schemaProperty: 'posture',           // Schema property name (camelCase)
    displayLabel: 'Posture',             // Human-readable label
    displayKey: 'posture',               // Key in formatting config (snake_case if needed)
    dataPath: 'body.descriptors.posture', // Path in body component
    validValues: ['slouched', 'relaxed', 'upright', 'rigid'], // Valid values or null
    displayOrder: 70,                     // Next available: 70
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.posture,
    formatter: (value) => `Posture: ${value}`,
    required: false,
  },
};
```

#### 2. Update JSON Schema

**File**: `data/schemas/anatomy.recipe.schema.json` (lines 135-198)

Add property to the `bodyDescriptors` object:

```json
{
  "bodyDescriptors": {
    "properties": {
      "posture": {
        "type": "string",
        "enum": ["slouched", "relaxed", "upright", "rigid"],
        "description": "Character's typical posture"
      }
    }
  }
}
```

**Note**: The schema property name must match the `schemaProperty` field in the registry.

#### 3. Update Formatting Configuration

**File**: `data/mods/anatomy/anatomy-formatting/default.json`

Add to `descriptionOrder` array (using the `displayKey`):

```json
{
  "descriptionOrder": [
    "height",
    "skin_color",
    "build",
    "body_composition",
    "body_hair",
    "smell",
    "posture"
  ]
}
```

#### 4. Run Validation

Validate the changes to ensure consistency:

```bash
npm run validate:body-descriptors
```

Expected output:
```
✅ Validation Passed
Body descriptor system is consistent.
```

#### 5. Add Tests

**File**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

```javascript
describe('posture descriptor', () => {
  it('should have complete metadata', () => {
    const metadata = getDescriptorMetadata('posture');
    expect(metadata).toBeDefined();
    expect(metadata.schemaProperty).toBe('posture');
    expect(metadata.displayKey).toBe('posture');
    expect(metadata.displayOrder).toBe(70);
    expect(metadata.validValues).toEqual(['slouched', 'relaxed', 'upright', 'rigid']);
  });

  it('should validate valid values', () => {
    const result = validateDescriptorValue('posture', 'upright');
    expect(result.valid).toBe(true);
  });

  it('should reject invalid values', () => {
    const result = validateDescriptorValue('posture', 'invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid value');
  });
});
```

## Validation

### Bootstrap Validation

The system automatically validates configuration during application startup when the validator is integrated with the bootstrap process.

### Manual Validation

Run the validation CLI tool to check system consistency:

```bash
npm run validate:body-descriptors
```

The tool checks:
- Registry completeness
- Formatting configuration consistency
- Sample recipe validation
- Overall system integrity

### CI/CD Integration

Add to your CI pipeline to ensure configuration stays synchronized:

```yaml
# .github/workflows/ci.yml
- name: Validate Body Descriptors
  run: npm run validate:body-descriptors
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

### 3. Test with Real Recipes

After adding a descriptor, test it with actual anatomy recipes:

```json
{
  "recipeId": "test:posture_example",
  "bodyDescriptors": {
    "posture": "upright",
    "build": "athletic"
  }
}
```

### 4. Update Formatting Configuration

Remember to add the descriptor's `displayKey` to the formatting config's `descriptionOrder` array. Descriptors not in this array won't appear in generated descriptions.

### 5. Document Descriptor Purpose

Add clear descriptions in the JSON schema explaining what each descriptor represents and when to use it.

### 6. Follow Naming Conventions

- **Schema properties**: camelCase (e.g., `skinColor`, `hairDensity`)
- **Display keys**: snake_case for multi-word descriptors (e.g., `skin_color`, `body_hair`)
- **Display labels**: Natural language (e.g., "Skin color", "Body hair density")

### 7. Choose Appropriate Value Types

- Use **enumerated values** (array) for controlled vocabularies with a fixed set of options
- Use **free-form** (`null`) for descriptors that need flexibility (e.g., skin color variations)

### 8. Maintain Display Order

Use increments of 10 for display order to allow easy insertion of new descriptors:
- Current: 10, 20, 30, 40, 50, 60
- Next available: 70
- This allows inserting at 15, 25, 35, etc. if needed

## Troubleshooting

### Descriptor Not Appearing in Descriptions

**Symptom**: Descriptor is defined in registry and recipe, but doesn't appear in generated descriptions.

**Checklist**:

1. ✅ Check registry definition exists
2. ✅ Verify `displayKey` is in formatting config's `descriptionOrder`
3. ✅ Ensure extractor function is correct
4. ✅ Run validation tool: `npm run validate:body-descriptors`
5. ✅ Check recipe has the descriptor value set

**Example Fix**:

```json
// In data/mods/anatomy/anatomy-formatting/default.json
{
  "descriptionOrder": [
    "height",
    "skin_color",
    "build",
    "body_composition",
    "body_hair",
    "smell",
    "your_descriptor_key"  // Add missing displayKey
  ]
}
```

### Validation Errors

**Symptom**: `npm run validate:body-descriptors` reports errors

**Common Issues**:

1. **Missing from formatting config**:
   ```
   ⚠️  Body descriptor 'posture' defined in registry but missing from descriptionOrder
   ```

   **Fix**: Add `displayKey` to `descriptionOrder` array in formatting config

2. **Invalid values in recipe**:
   ```
   ❌ Invalid value 'super-tall' for height. Expected one of: gigantic, very-tall, ...
   ```

   **Fix**: Use only values from the descriptor's `validValues` array

3. **Incorrect extractor function**:
   ```javascript
   // ❌ Wrong property path
   extractor: (bodyComponent) => bodyComponent?.descriptors?.height

   // ✅ Correct property path
   extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.height
   ```

4. **Missing required fields in registry entry**:

   Every descriptor must have all 9 fields: `schemaProperty`, `displayLabel`, `displayKey`, `dataPath`, `validValues`, `displayOrder`, `extractor`, `formatter`, `required`

### Schema Validation Failures

**Symptom**: Recipes fail to load with schema validation errors

**Common Causes**:

- Using a descriptor name that's not in the schema
- Using values not in the `enum` array
- Typos in property names (remember: camelCase in schema/data, snake_case in config)

**Example**:

```json
// ❌ Invalid - 'hairDensity' misspelled
{
  "bodyDescriptors": {
    "hair_density": "moderate"
  }
}

// ✅ Valid - correct camelCase property name
{
  "bodyDescriptors": {
    "hairDensity": "moderate"
  }
}
```

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

// Unknown descriptor
const result4 = validateDescriptorValue('unknown', 'value');
// Returns: { valid: false, error: "Unknown descriptor: unknown" }
```

## See Also

- [Body Descriptor Validator Reference](./body-descriptor-validator-reference.md) - Validator API documentation
- [Adding Body Descriptors Guide](./adding-body-descriptors.md) - Step-by-step guide for adding descriptors
- [Anatomy System Architecture](./architecture.md) - Overall anatomy system architecture
- [Body Descriptors Technical Guide](../development/body-descriptors-technical.md) - Technical implementation details
- [Body Descriptor Migration Guide](../migration/body-descriptor-migration.md) - Migration from old patterns
