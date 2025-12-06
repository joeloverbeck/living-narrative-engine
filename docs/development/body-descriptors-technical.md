# Body Descriptors - Technical Implementation Guide

## Overview

The Body Descriptors system provides a recipe-level approach to defining body characteristics in the Living Narrative Engine's anatomy system. This document covers the technical implementation details for developers working with or extending the body descriptor functionality.

## Architecture

### System Components

The body descriptor system integrates with several core anatomy components:

```
Recipe (bodyDescriptors) → Registry Validation → AnatomyGenerationWorkflow → Body Component (body.descriptors) → BodyDescriptionComposer (uses registry extractors) → Generated Description
```

#### Key Files

- **Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js` - Centralized metadata source
- **Validator**: `src/anatomy/validators/bodyDescriptorValidator.js` - System validation
- **Validation Script**: `scripts/validate-body-descriptors.js` - CLI tool
- **Schema**: `data/schemas/anatomy.recipe.schema.json` (lines 135-198)
- **Implementation**: `src/anatomy/bodyDescriptionComposer.js`
- **Workflow**: `src/anatomy/workflows/anatomyGenerationWorkflow.js`
- **Formatting Config**: `data/mods/anatomy/anatomy-formatting/default.json`
- **Tests**: `tests/integration/anatomy/bodyDescriptors.integration.test.js`
- **Performance Tests**: `tests/performance/anatomy/bodyDescriptionComposer.performance.test.js`
- **Registry Tests**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

### Body Descriptor Registry

**Location**: `src/anatomy/registries/bodyDescriptorRegistry.js`

**Purpose**: Single source of truth for all body descriptor metadata

The registry eliminates manual synchronization across multiple files by centralizing descriptor configuration.

#### Registry Structure

Each descriptor contains 9 required properties:

```javascript
export const BODY_DESCRIPTOR_REGISTRY = {
  height: {
    schemaProperty: 'height', // Property name in JSON schema (camelCase)
    displayLabel: 'Height', // Human-readable label for display
    displayKey: 'height', // Key in formatting config descriptionOrder
    dataPath: 'body.descriptors.height', // Path to access data in body component
    validValues: [
      'gigantic',
      'very-tall',
      'tall',
      'average',
      'short',
      'petite',
      'tiny',
    ],
    displayOrder: 10, // Display priority (lower numbers first)
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.height,
    formatter: (value) => `Height: ${value}`,
    required: false, // Whether descriptor is required
  },
  // ... additional descriptors
};
```

#### Registry API

```javascript
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorMetadata,
  getAllDescriptorNames,
  getDescriptorsByDisplayOrder,
  validateDescriptorValue,
} from './registries/bodyDescriptorRegistry.js';

// Get specific descriptor metadata
const heightMeta = getDescriptorMetadata('height');
console.log(heightMeta.displayLabel); // "Height"
console.log(heightMeta.validValues); // ['gigantic', 'very-tall', ...]

// Get all descriptor names
const allNames = getAllDescriptorNames();
// Returns: ['height', 'skinColor', 'build', 'composition', 'hairDensity', 'smell']

// Validate a descriptor value
const result = validateDescriptorValue('height', 'tall');
// Returns: { valid: true }
```

#### Validation Tool

**Command**: `npm run validate:body-descriptors`

Validates:

- Registry completeness
- Formatting configuration
- Sample recipes
- System consistency

**BodyDescriptorValidator Class**:

```javascript
import { BodyDescriptorValidator } from './anatomy/validators/bodyDescriptorValidator.js';

const validator = new BodyDescriptorValidator();

// Validate recipe descriptors
const result = validator.validateRecipeDescriptors({
  build: 'athletic',
  composition: 'lean',
});

if (!result.valid) {
  console.error('Validation failed:', result.errors);
}
```

**Documentation**:

- [Body Descriptors Complete](../anatomy/body-descriptors-complete.md) - Complete guide including registry, adding descriptors, and validation

### Data Flow

1. **Recipe Definition**: Body descriptors defined in `bodyDescriptors` field of anatomy recipes
2. **Schema Validation**: AJV validation ensures descriptor values are valid
3. **Generation Phase**: `AnatomyGenerationWorkflow` copies descriptors to generated body components
4. **Storage**: Descriptors stored in `body.descriptors` field of anatomy:body components
5. **Extraction**: `BodyDescriptionComposer` extracts descriptors for description generation
6. **Precedence**: Body-level descriptors take precedence over entity-level descriptor components
7. **Fallback**: Entity-level descriptors used when body-level not present

## Schema Definition

### Recipe Schema Structure

```json
{
  "bodyDescriptors": {
    "type": "object",
    "description": "Optional body-level descriptors to apply to generated body",
    "properties": {
      "build": {
        "type": "string",
        "enum": [
          "skinny",
          "slim",
          "toned",
          "athletic",
          "shapely",
          "thick",
          "muscular",
          "stocky"
        ]
      },
      "density": {
        "type": "string",
        "enum": [
          "hairless",
          "sparse",
          "light",
          "moderate",
          "hairy",
          "very-hairy"
        ]
      },
      "composition": {
        "type": "string",
        "enum": [
          "underweight",
          "lean",
          "average",
          "soft",
          "chubby",
          "overweight",
          "obese"
        ]
      },
      "skinColor": {
        "type": "string"
      }
    },
    "additionalProperties": false
  }
}
```

### Validation Rules

- All descriptor fields are optional
- `build`, `density`, `composition` use strict enum validation
- `skinColor` accepts any string value for maximum flexibility
- No additional properties allowed in `bodyDescriptors` object
- Schema validation occurs during recipe loading phase

## Implementation Details

### BodyDescriptionComposer

The `BodyDescriptionComposer` class handles extraction and display of body descriptors:

#### Key Methods

```javascript
// Extract descriptors with precedence handling
extractBuildDescription(bodyEntity);
extractBodyHairDescription(bodyEntity);
extractBodyCompositionDescription(bodyEntity);
extractSkinColorDescription(bodyEntity);

// Main composition method
composeDescription(bodyEntity);
```

#### Precedence Logic

```javascript
extractBuildDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // 1. Check body.descriptors first (NEW)
  if (bodyComponent?.body?.descriptors?.build) {
    return bodyComponent.body.descriptors.build;
  }

  // 2. Fallback to entity-level component (BACKWARD COMPATIBILITY)
  if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
    const buildComponent = bodyEntity.getComponentData('descriptors:build');
    if (buildComponent?.build) {
      return buildComponent.build;
    }
  }

  return null;
}
```

#### Display Order

Body descriptors appear first in descriptions, in this fixed order:

1. **Skin color** (`extractSkinColorDescription`)
2. **Build** (`extractBuildDescription`)
3. **Body hair/density** (`extractBodyHairDescription`)
4. **Body composition** (`extractBodyCompositionDescription`)

This order is hardcoded in the `composeDescription` method:

```javascript
// FIRST: Add body-level descriptors in specific order
const skinColorDescription = this.extractSkinColorDescription(bodyEntity);
if (skinColorDescription) {
  lines.push(`Skin color: ${skinColorDescription}`);
}

const buildDescription = this.extractBuildDescription(bodyEntity);
if (buildDescription) {
  lines.push(`Build: ${buildDescription}`);
}

const bodyHairDescription = this.extractBodyHairDescription(bodyEntity);
if (bodyHairDescription) {
  lines.push(`Body hair: ${bodyHairDescription}`);
}

const compositionDescription =
  this.extractBodyCompositionDescription(bodyEntity);
if (compositionDescription) {
  lines.push(`Body composition: ${compositionDescription}`);
}
```

### AnatomyGenerationWorkflow Integration

The anatomy generation workflow applies recipe-level body descriptors to generated body components:

```javascript
// Body descriptors from recipe are copied to body component during generation
if (recipeData.bodyDescriptors) {
  bodyComponent.body.descriptors = { ...recipeData.bodyDescriptors };
}
```

### Component Storage Format

Body descriptors are stored in the anatomy:body component:

```javascript
{
  "componentId": "anatomy:body",
  "body": {
    "root": "torso-1",
    "descriptors": {
      "build": "athletic",
      "density": "moderate",
      "composition": "lean",
      "skinColor": "olive"
    }
  }
}
```

## Error Handling

### Schema Validation Errors

Invalid body descriptor values trigger AJV validation errors during recipe loading:

```javascript
// Invalid build value
{
  "bodyDescriptors": {
    "build": "invalid_value"  // Not in enum
  }
}

// Results in AJV error:
// "bodyDescriptors.build must be one of: skinny, slim, toned, athletic, shapely, thick, muscular, stocky"
```

### Runtime Error Handling

The `BodyDescriptionComposer` includes defensive error handling:

```javascript
// Graceful handling of missing components
extractBuildDescription(bodyEntity) {
  if (!bodyEntity || !bodyEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
    return null; // Graceful fallback
  }

  const bodyComponent = this.#getBodyComponent(bodyEntity);
  if (!bodyComponent) {
    return null; // Handle missing body component
  }

  // Continue with extraction logic...
}
```

### Error Recovery Strategies

- **Missing Entity**: Return empty description
- **Missing Body Component**: Return empty description
- **Invalid Descriptor Values**: Skip invalid descriptors, continue with valid ones
- **Component Access Errors**: Log error, continue with available data

## Performance Considerations

### Generation Phase Performance

- Body descriptors are applied once during entity generation
- No runtime performance impact after generation
- Slightly faster than entity-level descriptors (fewer component lookups)

### Description Generation Performance

Performance targets (validated in performance tests):

- **Anatomy Generation**: <5ms with body descriptors
- **Description Composition**: <5ms for complete body
- **Descriptor Validation**: <1ms per validation
- **Memory Efficiency**: No memory leaks in batch operations

### Optimization Strategies

```javascript
// Cached descriptor extraction to avoid repeated lookups
#getBodyComponent(bodyEntity) {
  // Implementation caches body component reference
  // Reduces repeated getComponentData calls
}

// Efficient precedence checking
// Body descriptors checked first (most common case)
// Entity-level fallback only when needed
```

## Testing Strategy

### Test Coverage Structure

The body descriptor system has comprehensive test coverage across multiple levels:

#### Unit Tests

**File**: `tests/unit/anatomy/bodyDescriptionComposer.test.js`

- Descriptor extraction methods (35 tests total)
- Precedence handling (body vs entity-level)
- Edge cases (missing entities, components)
- Display order validation
- Equipment integration

#### Integration Tests

**File**: `tests/integration/anatomy/bodyDescriptors.integration.test.js` (466 lines)

- End-to-end workflow testing
- Recipe → generation → description pipeline
- Schema validation integration
- Mixed descriptor scenarios
- Backward compatibility validation

#### Performance Tests

**Files**: `tests/performance/anatomy/bodyLevelDescriptors/`

- Performance benchmark validation
- Memory usage testing
- Batch operation efficiency
- Load testing with large datasets

### Test Utilities

#### TestBedAnatomy

**File**: `tests/common/testbed.anatomy.js`

- Complete anatomy testing infrastructure
- Built-in entity definitions for descriptor testing
- Recipe and blueprint setup utilities
- Integration with existing test framework

#### Test Data Fixtures

- Embedded test fixtures in integration tests
- Performance test fixtures in dedicated directory
- Comprehensive scenario coverage

### Running Tests

```bash
# Unit tests only
npm run test:unit -- tests/unit/anatomy/bodyDescriptionComposer.test.js

# Integration tests
npm run test:integration -- tests/integration/anatomy/bodyDescriptors.integration.test.js

# Performance benchmarks
npm run test:performance -- tests/performance/anatomy/bodyDescriptionComposer.performance.test.js

# Full anatomy test suite
npm run test:integration -- tests/integration/anatomy/
```

## Extension Points

### Adding New Descriptor Types

To add a new body descriptor type:

1. **Update Schema** (`data/schemas/anatomy.recipe.schema.json`):

```json
{
  "bodyDescriptors": {
    "properties": {
      "newDescriptorType": {
        "type": "string",
        "enum": ["value1", "value2", "value3"]
      }
    }
  }
}
```

2. **Add Extraction Method** (`src/anatomy/bodyDescriptionComposer.js`):

```javascript
extractNewDescriptorDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Check body.descriptors first
  if (bodyComponent?.body?.descriptors?.newDescriptorType) {
    return bodyComponent.body.descriptors.newDescriptorType;
  }

  // Fallback to entity-level
  if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
    const component = bodyEntity.getComponentData('descriptors:new_descriptor');
    if (component?.newDescriptorType) {
      return component.newDescriptorType;
    }
  }

  return null;
}
```

3. **Update Display Logic**:

```javascript
composeDescription(bodyEntity) {
  // Add to descriptor display sequence
  const newDescriptorDescription = this.extractNewDescriptorDescription(bodyEntity);
  if (newDescriptorDescription) {
    lines.push(`New descriptor: ${newDescriptorDescription}`);
  }
}
```

4. **Add Tests**:

```javascript
describe('New Descriptor Type', () => {
  it('should extract new descriptor from body.descriptors', () => {
    // Test implementation
  });
});
```

### Custom Display Formatting

To customize descriptor display formatting:

1. **Override Display Methods**:

```javascript
class CustomBodyDescriptionComposer extends BodyDescriptionComposer {
  composeDescription(bodyEntity) {
    // Custom display logic
    const descriptors = this.extractAllDescriptors(bodyEntity);
    return this.formatCustomDisplay(descriptors);
  }

  formatCustomDisplay(descriptors) {
    // Custom formatting logic
  }
}
```

2. **Register Custom Composer**:

```javascript
// In service registration
container.register(
  tokens.IBodyDescriptionComposer,
  CustomBodyDescriptionComposer
);
```

### Validation Extension

To add custom validation rules:

1. **Extend Schema Validation**:

```json
{
  "bodyDescriptors": {
    "properties": {
      "customField": {
        "type": "string",
        "pattern": "^[a-z]+$", // Custom regex validation
        "minLength": 3,
        "maxLength": 20
      }
    }
  }
}
```

2. **Add Runtime Validation**:

```javascript
validateBodyDescriptors(descriptors) {
  // Custom validation logic
  if (descriptors.build && descriptors.composition) {
    // Validate build/composition combinations
    return this.validateBuildCompositionCompatibility(descriptors);
  }
  return true;
}
```

## Debugging

### Common Issues

**Issue**: Descriptors not appearing

```javascript
// Debug: Check body component structure
console.log('Body component:', entity.getComponentData('anatomy:body'));

// Verify descriptors field exists
console.log('Descriptors:', bodyComponent?.body?.descriptors);
```

**Issue**: Wrong precedence order

```javascript
// Debug: Check both descriptor sources
console.log('Body descriptors:', bodyComponent?.body?.descriptors);
console.log('Entity build:', entity.getComponentData('descriptors:build'));
```

**Issue**: Performance problems

```javascript
// Profile descriptor extraction
console.time('descriptor-extraction');
const result = composer.composeDescription(entity);
console.timeEnd('descriptor-extraction');
```

### Logging and Diagnostics

The system includes comprehensive logging:

```javascript
// Enable debug logging
const composer = new BodyDescriptionComposer({
  logger: console, // Enable logging
  // ... other dependencies
});

// Logs include:
// - Descriptor extraction attempts
// - Precedence decisions
// - Performance metrics
// - Error conditions
```

## Migration and Compatibility

### Backward Compatibility

The body descriptor system maintains full backward compatibility:

- **Existing entity-level descriptors** continue to work unchanged
- **Mixed usage supported** - some descriptors at body level, others at entity level
- **Automatic precedence** - body descriptors take precedence when present
- **Gradual migration** - no forced upgrades required

### Migration Strategies

1. **Recipe-by-Recipe**: Migrate individual recipes to use body descriptors
2. **Template-Based**: Create body descriptor templates for common patterns
3. **Batch Migration**: Tools can be created to bulk-convert entity-level to body-level descriptors

### Version Compatibility

- **Schema Versioning**: Body descriptor schema is extensible
- **Component Evolution**: New descriptor types can be added without breaking changes
- **API Stability**: Core extraction methods maintain stable interfaces

## Security Considerations

### Input Validation

- **Schema Validation**: All descriptor values validated against strict schemas
- **Enum Enforcement**: Build, density, composition use controlled vocabularies
- **String Sanitization**: Skin color values should be sanitized in display contexts
- **Injection Prevention**: No executable code allowed in descriptor values

### Data Integrity

- **Immutable After Generation**: Body descriptors copied to components, not referenced
- **Consistent State**: Descriptors cannot be partially corrupted
- **Validation Gates**: Multiple validation points prevent invalid data propagation

For additional implementation details, refer to the source code comments and comprehensive test suite examples.
