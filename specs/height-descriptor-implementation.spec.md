# Height Descriptor Implementation Plan

## Status

**⚠️ IMPORTANT: This is a proposed implementation plan. The height descriptor feature described in this document has NOT been implemented yet.**

- **Status**: Proposed - Not Yet Implemented
- **Version**: 1.0.0
- **Created**: 2025-01-20
- **Author**: System Architect

## Executive Summary

This plan outlines the proposed implementation of a new body-level descriptor for height in the Living Narrative Engine. The height descriptor will be integrated into the existing descriptor system, following established patterns for body-level descriptors like build, body hair, and body composition.

## Current State

As of January 2025, the Living Narrative Engine has a robust descriptor system for body-level attributes including:

- **Build**: athletic, average, stocky, slender
- **Density/Body Hair**: sparse, moderate, dense
- **Composition**: lean, average, plump, obese
- **Skin Color**: various tones

The height descriptor proposed in this document has **not been implemented**. All infrastructure needed to add this feature is in place and functioning correctly for the existing descriptors.

## 1. Overview

### 1.1 Purpose

To add a height descriptor that will provide more detailed physical characterization of entities at the body level, enhancing the narrative description generation system.

### 1.2 Scope

- Create a new height descriptor component
- Integrate height into body-level descriptors
- Update description generation to include height
- Maintain backward compatibility with existing systems

### 1.3 Prerequisites

The existing descriptor infrastructure is already in place and working for other body descriptors (build, density/body hair, composition, skinColor). This implementation will follow the same established patterns.

### 1.4 Proposed Height Values

The height descriptor will support the following values (from tallest to shortest):

- `gigantic` - Exceptionally tall, towering presence
- `very-tall` - Significantly above average height
- `tall` - Above average height
- `average` - Normal height (default)
- `short` - Below average height
- `petite` - Notably small stature
- `tiny` - Exceptionally small

## 2. Proposed Component Implementation

### 2.1 New Height Component to Create

**File to create**: `/data/mods/descriptors/components/height.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "descriptors:height",
  "description": "Height descriptor for overall body stature",
  "dataSchema": {
    "type": "object",
    "properties": {
      "height": {
        "type": "string",
        "description": "The height category",
        "enum": [
          "gigantic",
          "very-tall",
          "tall",
          "average",
          "short",
          "petite",
          "tiny"
        ],
        "default": "average"
      }
    },
    "required": ["height"],
    "additionalProperties": false
  }
}
```

## 3. Required Schema Updates

### 3.1 Body Component Schema Update

**File to modify**: `/data/mods/anatomy/components/body.component.json`

Will need to add height to the descriptors section:

```json
"descriptors": {
  "type": "object",
  "description": "Body-level descriptors that apply to the whole body",
  "properties": {
    "build": { /* existing */ },
    "density": { /* existing */ },
    "composition": { /* existing */ },
    "skinColor": { /* existing */ },
    "height": {
      "type": "string",
      "enum": [
        "gigantic",
        "very-tall",
        "tall",
        "average",
        "short",
        "petite",
        "tiny"
      ]
    }
  },
  "additionalProperties": false
}
```

### 3.2 Anatomy Recipe Schema Update

**File to modify**: `/data/schemas/anatomy.recipe.schema.json`

Will need to add height to the bodyDescriptors section:

```json
"bodyDescriptors": {
  "type": "object",
  "description": "Optional body-level descriptors to apply to generated body",
  "properties": {
    "build": { /* existing */ },
    "density": { /* existing */ },
    "composition": { /* existing */ },
    "skinColor": { /* existing */ },
    "height": {
      "type": "string",
      "enum": [
        "gigantic",
        "very-tall",
        "tall",
        "average",
        "short",
        "petite",
        "tiny"
      ]
    }
  },
  "additionalProperties": false
}
```

## 4. Required Source Code Updates

### 4.1 Body Descriptor Constants

**File to modify**: `/src/anatomy/constants/bodyDescriptorConstants.js`

Will need to add new constants:

```javascript
/**
 * Valid height categories
 */
export const HEIGHT_CATEGORIES = {
  GIGANTIC: 'gigantic',
  VERY_TALL: 'very-tall',
  TALL: 'tall',
  AVERAGE: 'average',
  SHORT: 'short',
  PETITE: 'petite',
  TINY: 'tiny',
};

// Update DESCRIPTOR_METADATA
export const DESCRIPTOR_METADATA = {
  // ... existing entries ...
  height: {
    label: 'Height',
    validValues: Object.values(HEIGHT_CATEGORIES),
    description: 'Height category',
  },
};
```

### 4.2 Body Description Composer

**File to modify**: `/src/anatomy/bodyDescriptionComposer.js`

Will need to add height extraction method:

```javascript
/**
 * Extract height description from body entity
 *
 * @param {object} bodyEntity - The body entity
 * @returns {string} Height description
 */
extractHeightDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Check body.descriptors first
  if (bodyComponent?.body?.descriptors?.height) {
    return bodyComponent.body.descriptors.height;
  }

  // Fallback to entity-level component for backward compatibility
  if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
    const heightComponent = bodyEntity.getComponentData('descriptors:height');
    if (heightComponent?.height) {
      // eslint-disable-next-line no-console
      console.warn(
        `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:height'. ` +
          'Please migrate to body.descriptors.height in anatomy:body component. ' +
          'Entity-level descriptors will be removed in a future version.'
      );
      return heightComponent.height;
    }
  }

  return '';
}
```

Will need to update `extractBodyLevelDescriptors` method to include height:

```javascript
extractBodyLevelDescriptors(bodyEntity) {
  const descriptors = {};

  // Add height FIRST (before other descriptors)
  const heightDescription = this.extractHeightDescription(bodyEntity);
  if (heightDescription) {
    descriptors.height = `Height: ${heightDescription}`;
  }

  // ... existing descriptor extractions ...

  return descriptors;
}
```

Will need to update `getBodyDescriptorOrder` method:

```javascript
getBodyDescriptorOrder(descriptionOrder) {
  const bodyDescriptorTypes = [
    'height',  // Add height first in the list
    'skin_color',
    'build',
    'body_composition',
    'body_hair',
  ];
  return descriptionOrder.filter((type) =>
    bodyDescriptorTypes.includes(type)
  );
}
```

### 4.3 Description Configuration

**File to modify**: `/src/anatomy/configuration/descriptionConfiguration.js`

Will need to update the default description order to include height at the beginning:

```javascript
this._defaultDescriptionOrder = [
  'height', // Add height as the first body-level descriptor
  'build',
  'body_composition',
  'body_hair',
  'skin_color',
  // ... rest of the order ...
];
```

Will also need to update `DESCRIPTION_CONFIG_CONSTANTS`:

```javascript
export const DESCRIPTION_CONFIG_CONSTANTS = {
  DEFAULT_DESCRIPTION_ORDER: [
    'height', // Add height first
    'build',
    'body_composition',
    'body_hair',
    'skin_color',
    // ... rest of the order ...
  ],
  // ... other constants ...
};
```

### 4.4 Body Descriptor Validator

**File**: `/src/anatomy/utils/bodyDescriptorValidator.js`

The validator should automatically pick up the new height descriptor from the updated `DESCRIPTOR_METADATA` constant, as it uses dynamic validation based on the metadata. No changes should be needed if the validator is properly implemented.

## 5. Proposed Usage Examples

### 5.1 In Anatomy Recipes

```json
{
  "recipeId": "anatomy:tall_human",
  "blueprintId": "anatomy:human_base",
  "bodyDescriptors": {
    "height": "very-tall",
    "build": "athletic",
    "composition": "lean"
  },
  "slots": {
    /* ... */
  }
}
```

### 5.2 Expected Description Output

When a body is generated with height descriptor, the description should appear as:

```
Height: very-tall
Build: athletic
Body composition: lean
Body hair: moderate
Skin color: fair
[... rest of body part descriptions ...]
```

## 6. Proposed Testing Strategy

### 6.1 Unit Tests to Create

#### Component Tests

- Test height component schema validation
- Test valid height values acceptance
- Test invalid height values rejection

#### Body Description Composer Tests

**File to update**: `/tests/unit/anatomy/bodyDescriptionComposer.test.js`

- Test `extractHeightDescription` method
- Test height appears in correct order in descriptions
- Test fallback to entity-level component (deprecation path)
- Test missing height descriptor handling

#### Constants Tests

**File to update**: `/tests/unit/anatomy/constants/bodyDescriptorConstants.test.js`

- Test HEIGHT_CATEGORIES values
- Test height in DESCRIPTOR_METADATA
- Test height in SUPPORTED_DESCRIPTOR_PROPERTIES

### 6.2 Integration Tests to Create

#### Anatomy Generation Tests

**File to update**: `/tests/integration/anatomy/anatomyGeneration.test.js`

- Test recipe with height descriptor creates body with height
- Test height descriptor persists through body generation
- Test height descriptor appears in final description

#### Description Generation Tests

**File to update**: `/tests/integration/anatomy/descriptionGeneration.test.js`

- Test complete description includes height in correct position
- Test description with all body descriptors including height
- Test description with only height descriptor

### 6.3 E2E Tests to Create

- Test character creation with height selection
- Test height descriptor persistence across save/load
- Test height in exported character descriptions

## 7. Proposed Migration Strategy

### 7.1 Backward Compatibility Approach

- Will support reading height from entity-level component with deprecation warning
- Existing bodies without height will continue to work (height omitted from description)
- Default value will be "average" when not specified

### 7.2 Proposed Migration Path

1. Deploy new height component
2. Update existing recipes to include height descriptors where appropriate
3. Add height selection to character creation UI
4. Eventually remove entity-level height component support (future version)

## 8. Performance Considerations

- No significant performance impact is expected
- Height extraction will follow the same pattern as existing descriptors
- Will add a single additional property lookup during description generation
- Minimal memory overhead (one string value per body)

## 9. Potential Future Enhancements

### 9.1 Relative Height System

Could consider implementing relative height comparisons:

- Height relative to species average
- Height relative to other characters in scene
- Dynamic height descriptions based on observer

### 9.2 Numeric Height Values

Could consider supporting specific measurements:

- Metric (cm) and Imperial (ft/in) units
- Conversion between categorical and numeric values
- Range-based categories (e.g., "tall" = 180-195cm)

### 9.3 Height-Based Interactions

Future systems could potentially use height for:

- Reach calculations
- Line of sight determination
- Social interaction modifiers
- Equipment sizing requirements

## 10. Implementation Checklist

Tasks to complete when implementing this feature:

- [ ] Create height component file
- [ ] Update body component schema
- [ ] Update anatomy recipe schema
- [ ] Add height constants
- [ ] Implement height extraction method
- [ ] Update body level descriptor extraction
- [ ] Update description configuration
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation
- [ ] Add migration notes
- [ ] Test with existing content
- [ ] Verify backward compatibility

## 11. Acceptance Criteria

When implemented, the following criteria must be met:

1. Height descriptor component is created and validates correctly
2. Height can be specified in anatomy recipes
3. Generated bodies include height descriptor when specified
4. Height appears first in body-level descriptors in descriptions
5. Existing bodies without height continue to work
6. All tests pass with >80% coverage
7. No performance regression in description generation
8. Documentation is updated to reflect new capability

## 12. References

- Body Component: `/data/mods/anatomy/components/body.component.json`
- Anatomy Recipe Schema: `/data/schemas/anatomy.recipe.schema.json`
- Body Description Composer: `/src/anatomy/bodyDescriptionComposer.js`
- Descriptor Constants: `/src/anatomy/constants/bodyDescriptorConstants.js`
- Description Configuration: `/src/anatomy/configuration/descriptionConfiguration.js`

---

## Implementation Notes

This plan provides a complete blueprint for implementing the height descriptor feature. The proposed approach follows existing patterns in the codebase and should integrate seamlessly with the current descriptor system. All necessary infrastructure (descriptor system, body components, description generation) is already in place and functioning for other descriptors.
