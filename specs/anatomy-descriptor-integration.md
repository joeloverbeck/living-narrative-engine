# Anatomy Descriptor Integration Specification

## Overview

This specification outlines the integration of new descriptor components into the Living Narrative Engine's anatomy formatting system. The goal is to enhance entity descriptions by incorporating body composition, body hair, and facial hair descriptors that have been created but are not yet utilized in the description generation process.

**Note**: This specification has been updated to accurately reflect the current architecture where body-level descriptors require special handling in the `BodyDescriptionComposer` class, similar to how "build" is currently handled.

## Current State Analysis

### Existing Descriptor Components Used

The following descriptor components are currently integrated and functioning in the anatomy formatting system:

- `descriptors:build` - Overall body build
- `descriptors:length_category` - General length descriptors
- `descriptors:length_hair` - Hair-specific lengths
- `descriptors:size_category` - Size categories
- `descriptors:size_specific` - Specific size descriptors
- `descriptors:weight_feel` - Weight perception
- `descriptors:color_basic` - Basic color descriptors
- `descriptors:color_extended` - Extended color palette
- `descriptors:shape_general` - General shape descriptors
- `descriptors:shape_eye` - Eye-specific shapes
- `descriptors:hair_style` - Hair styling
- `descriptors:texture` - Texture descriptors
- `descriptors:firmness` - Firmness levels

### New Components Requiring Integration

1. **`descriptors:body_composition`**
   - Purpose: Describes body fat levels and overall body composition
   - Values: underweight, lean, average, soft, chubby, overweight, obese
   - Scope: Entity-level descriptor

2. **`descriptors:body_hair`**
   - Purpose: Describes the body hair characteristics
   - Values: hairless, sparse, light, moderate, hairy, very-hairy
   - Scope: Entity-level descriptor

3. **`descriptors:facial_hair`**
   - Purpose: Describes facial hair characteristics
   - Values: clean-shaven, stubble, mustache, goatee, bearded, full-beard, mutton-chops, soul-patch, van-dyke
   - Scope: Part-level descriptor (head/face parts)

### Unused Component

- **`descriptors:projection`**
  - Purpose: Describes projection characteristics of surfaces
  - Values: flat, bubbly, shelf
  - Status: Created but not included in descriptor order
  - Recommendation: Add to descriptor order for body parts where applicable (e.g., breasts, buttocks)

## Integration Requirements

### 1. Anatomy Formatting Configuration Updates

**File**: `data/mods/anatomy/anatomy-formatting/default.json`

#### Update `descriptionOrder`

The `descriptionOrder` array should be updated to include body-level descriptors. Note that items in this array are processed specially if they match known body-level descriptors (like "build"), otherwise they are treated as body part types:

```json
"descriptionOrder": [
  "build",
  "body_composition",  // NEW: Add after "build"
  "body_hair",        // NEW: Add after "body_composition"
  "hair",
  "eye",
  "face",
  // ... rest of the order
]
```

#### Update `descriptorOrder`

Add the new descriptor components to the appropriate positions:

```json
"descriptorOrder": [
  "descriptors:length_category",
  "descriptors:length_hair",
  "descriptors:size_category",
  "descriptors:size_specific",
  "descriptors:weight_feel",
  "descriptors:body_composition",    // NEW: Add here for body-level context
  "descriptors:body_hair",           // NEW: Add here for body-level context
  "descriptors:facial_hair",         // NEW: Add before shape descriptors
  "descriptors:color_basic",
  "descriptors:color_extended",
  "descriptors:shape_general",
  "descriptors:shape_eye",
  "descriptors:hair_style",
  "descriptors:texture",
  "descriptors:firmness",
  "descriptors:projection",          // NEW: Add for surface projection
  "descriptors:build"
]
```

#### Update `descriptorValueKeys`

Add new keys for the descriptor properties:

```json
"descriptorValueKeys": [
  "value",
  "color",
  "size",
  "shape",
  "length",
  "style",
  "texture",
  "firmness",
  "build",
  "weight",
  "composition",     // NEW: For body_composition
  "density",         // NEW: For body_hair
  "projection"       // NEW: For projection
]
```

### 2. Body Description Composer Updates

**File**: `src/anatomy/bodyDescriptionComposer.js`

#### Add Body-Level Descriptor Extraction

Following the existing pattern of `extractBuildDescription()`, create new methods to extract body-level descriptors:

```javascript
/**
 * Extract body composition description from body entity
 * @param {object} bodyEntity - The body entity
 * @returns {string} Body composition description
 */
extractBodyCompositionDescription(bodyEntity) {
  if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
    return '';
  }
  const compositionComponent = bodyEntity.getComponentData('descriptors:body_composition');
  if (!compositionComponent || !compositionComponent.composition) {
    return '';
  }
  return compositionComponent.composition;
}

/**
 * Extract body hair description from body entity
 * @param {object} bodyEntity - The body entity
 * @returns {string} Body hair description
 */
extractBodyHairDescription(bodyEntity) {
  if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
    return '';
  }
  const bodyHairComponent = bodyEntity.getComponentData('descriptors:body_hair');
  if (!bodyHairComponent || !bodyHairComponent.density) {
    return '';
  }
  return bodyHairComponent.density;
}
```

#### Update `composeDescription` Method

Modify the description composition logic to handle new body-level descriptors in the same pattern as the existing "build" handler:

```javascript
// Process parts in configured order
for (const partType of descriptionOrder) {
  if (processedTypes.has(partType)) {
    continue;
  }

  // Handle overall build (existing)
  if (partType === 'build') {
    const buildDescription = this.extractBuildDescription(bodyEntity);
    if (buildDescription) {
      lines.push(`Build: ${buildDescription}`);
    }
    processedTypes.add(partType);
    continue;
  }

  // Handle body composition (NEW)
  if (partType === 'body_composition') {
    const compositionDescription =
      this.extractBodyCompositionDescription(bodyEntity);
    if (compositionDescription) {
      lines.push(`Body composition: ${compositionDescription}`);
    }
    processedTypes.add(partType);
    continue;
  }

  // Handle body hair (NEW)
  if (partType === 'body_hair') {
    const bodyHairDescription = this.extractBodyHairDescription(bodyEntity);
    if (bodyHairDescription) {
      lines.push(`Body hair: ${bodyHairDescription}`);
    }
    processedTypes.add(partType);
    continue;
  }

  // Handle equipment descriptions (existing)
  if (partType === 'equipment' && this.equipmentDescriptionService) {
    // ... existing equipment handler
  }

  // Process body parts (existing)
  if (partsByType.has(partType)) {
    // ... existing body part handler
  }
}
```

### 3. Descriptor Formatter Updates

**File**: `src/anatomy/descriptorFormatter.js`

**No changes required** - The existing implementation already handles all descriptor components dynamically. The `extractDescriptors()` method automatically finds any component with the `descriptors:` prefix, and the `extractDescriptorValue()` method searches through the configured `descriptorValueKeys` to find the appropriate value property.

### 4. Part-Level Descriptor Handling

**Important Note**: Part-level descriptors like `descriptors:facial_hair` are automatically handled by the existing system. When attached to a part entity (e.g., a head part), they will be extracted and formatted by the `DescriptorFormatter` class without any code changes needed. The descriptor will appear in the part's description based on the configured `descriptorOrder`.

## Architecture Clarification

### Body-Level vs Part-Level Descriptors

The anatomy system distinguishes between two types of descriptors:

1. **Body-Level Descriptors**: Applied to the entire entity
   - Examples: `build`, `body_composition`, `body_hair`
   - Attached directly to the entity with the `anatomy:body` component
   - Require special handling in `BodyDescriptionComposer.composeDescription()`
   - Output format: `Label: value` (e.g., "Build: athletic")

2. **Part-Level Descriptors**: Applied to individual body parts
   - Examples: `facial_hair`, `shape_eye`, `texture`, `projection`
   - Attached to part entities (e.g., head, breast, buttocks)
   - Automatically handled by `DescriptorFormatter` during part description generation
   - Combined with other part descriptors in the configured order

### Processing Flow

1. `BodyDescriptionComposer` iterates through `descriptionOrder`
2. For known body-level descriptors (`build`, `body_composition`, `body_hair`):
   - Extract value directly from the body entity
   - Add formatted line to output
3. For body part types:
   - Delegate to `DescriptionTemplate`
   - Part descriptors are automatically extracted and formatted
4. For special entries like `equipment`:
   - Use dedicated service if available

## Implementation Guidelines

### 1. Entity Structure

Body-level descriptors should be attached directly to the entity with the `anatomy:body` component:

```json
{
  "components": {
    "anatomy:body": {
      /* body configuration */
    },
    "descriptors:body_composition": { "composition": "average" },
    "descriptors:body_hair": { "density": "moderate" }
  }
}
```

### 2. Part-Level Descriptors

Part-specific descriptors should be attached to the relevant part entities:

```json
{
  "id": "anatomy:humanoid_head_bearded",
  "components": {
    "anatomy:part": { "subType": "head" },
    "descriptors:facial_hair": { "style": "bearded" }
  }
}
```

### 3. Description Output Format

The enhanced description output should follow the existing capitalized label pattern:

```
Build: athletic
Body composition: average
Body hair: moderate
Hair: long, wavy blonde hair
Eyes: bright blue almond-shaped eyes
Face: bearded angular face
[... rest of anatomy ...]
```

Note: The labels follow the existing pattern where the first letter is capitalized (e.g., "Build:", "Hair:", "Eyes:").

## Test Scenarios

### 1. Basic Integration Test

- Create an entity with all new descriptors
- Verify descriptors appear in the generated description
- Confirm correct ordering

### 2. Partial Descriptor Test

- Create entities with only some of the new descriptors
- Verify graceful handling of missing descriptors
- Ensure no empty lines in output

### 3. Combined Descriptor Test

- Test entities with both new and existing descriptors
- Verify proper integration and ordering
- Check for formatting consistency

### 4. Edge Cases

- Test with invalid descriptor values
- Test with empty descriptor components
- Test with malformed component data

## Validation Requirements

### 1. Schema Validation

- All descriptor components must pass JSON schema validation
- Component IDs must follow the `descriptors:` namespace convention
- Values must match enumerated options

### 2. Runtime Validation

- Gracefully handle missing or invalid descriptor data
- Log warnings for unrecognized descriptor components
- Maintain backward compatibility with existing entities

### 3. Output Validation

- Generated descriptions must be grammatically correct
- No duplicate information in descriptions
- Consistent formatting across all descriptor types

## Migration Strategy

### 1. Backward Compatibility

- Existing entities without new descriptors should continue to work
- Default values should not be automatically applied
- Preserve existing description generation behavior

### 2. Progressive Enhancement

- New descriptors enhance descriptions when present
- Absence of new descriptors doesn't break functionality
- Modders can adopt new descriptors incrementally

### 3. Documentation Updates

- Update modding documentation with new descriptor examples
- Provide migration guide for existing mods
- Include best practices for descriptor usage

## Future Considerations

### 1. Additional Descriptors

- Consider adding more body-specific descriptors (posture, musculature, etc.)
- Explore dynamic descriptor generation based on other components
- Support for custom descriptor types

### 2. Localization

- Ensure descriptor values can be localized
- Support for language-specific formatting rules
- Handle grammatical variations across languages

### 3. Performance

- Monitor performance impact of additional descriptors
- Consider caching strategies for complex descriptions
- Optimize descriptor extraction for large entity counts
