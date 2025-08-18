# BODDESCMIG-006: Update BodyDescriptionComposer Methods

## Ticket ID

BODDESCMIG-006

## Title

Update BodyDescriptionComposer extraction methods to support body-level descriptors

## Status

READY FOR IMPLEMENTATION

## Priority

HIGH

## Estimated Effort

2-3 hours

## Dependencies

- BODDESCMIG-001: Update body component schema ✅
- BODDESCMIG-004: Modify AnatomyGenerationWorkflow ✅
- BODDESCMIG-005: Add body descriptor validation logic ✅

## Related Specs

- specs/body-descriptor-migration.spec.md (Section 4.4.1, Section 2.1 FR-3)

## Description

Update the BodyDescriptionComposer service to extract body-level descriptors from the new `body.descriptors` structure in anatomy:body components. This removes the deprecated entity-level descriptor support and implements the new descriptor extraction methods that will be used for description generation.

## Current State

**File**: `src/anatomy/services/BodyDescriptionComposer.js` (expected location based on spec)

Current extraction methods likely support:

- Entity-level descriptors (deprecated pattern)
- Part-level descriptors from individual parts
- Multiple fallback mechanisms

Missing functionality:

- Extraction from body.descriptors structure
- Removal of entity-level descriptor support
- Integration with centralized validation utilities

## Technical Requirements

### 1. Updated Extraction Methods

#### Body Build Extraction

```javascript
/**
 * Extracts build description from body-level descriptors only
 * @param {Object} bodyEntity - The entity with anatomy:body component
 * @returns {string} Build descriptor value or empty string
 */
extractBuildDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Only check body.descriptors - no entity-level fallback
  if (bodyComponent?.body?.descriptors?.build) {
    return bodyComponent.body.descriptors.build;
  }

  return '';
}
```

#### Body Hair (Density) Extraction

```javascript
/**
 * Extracts body hair description from body-level descriptors only
 * Maps from 'density' property to 'Body hair' display
 * @param {Object} bodyEntity - The entity with anatomy:body component
 * @returns {string} Body hair density value or empty string
 */
extractBodyHairDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Only check body.descriptors.density - no entity-level fallback
  if (bodyComponent?.body?.descriptors?.density) {
    return bodyComponent.body.descriptors.density;
  }

  return '';
}
```

#### Body Composition Extraction

```javascript
/**
 * Extracts body composition description from body-level descriptors
 * @param {Object} bodyEntity - The entity with anatomy:body component
 * @returns {string} Body composition value or empty string
 */
extractBodyCompositionDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Only check body.descriptors.composition
  if (bodyComponent?.body?.descriptors?.composition) {
    return bodyComponent.body.descriptors.composition;
  }

  return '';
}
```

#### Skin Color Extraction

```javascript
/**
 * Extracts skin color description from body-level descriptors
 * @param {Object} bodyEntity - The entity with anatomy:body component
 * @returns {string} Skin color value or empty string
 */
extractSkinColorDescription(bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);

  // Only check body.descriptors.skinColor
  if (bodyComponent?.body?.descriptors?.skinColor) {
    return bodyComponent.body.descriptors.skinColor;
  }

  return '';
}
```

### 2. Helper Methods

#### Body Component Access

```javascript
/**
 * Safely gets the anatomy:body component from an entity
 * @param {Object} bodyEntity - The entity
 * @returns {Object|null} The body component data or null
 * @private
 */
#getBodyComponent(bodyEntity) {
  try {
    return bodyEntity.getComponentData(this.#constants.ANATOMY_BODY_COMPONENT_ID);
  } catch (error) {
    this.#logger.error('Failed to get anatomy:body component', error);
    return null;
  }
}
```

#### Descriptor Validation Integration

```javascript
/**
 * Validates body descriptors using centralized validation
 * @param {Object} bodyDescriptors - The descriptors to validate
 * @param {string} entityId - Entity ID for error context
 * @private
 */
#validateBodyDescriptors(bodyDescriptors, entityId) {
  try {
    BodyDescriptorValidator.validate(bodyDescriptors, `entity ${entityId}`);
  } catch (error) {
    this.#logger.warn(`Invalid body descriptors for entity ${entityId}:`, error.message);
    // Don't throw - gracefully handle invalid descriptors
  }
}
```

### 3. Integration with Validation Utils

Import and use centralized validation utilities:

```javascript
import { BodyDescriptorValidator } from '../utils/bodyDescriptorValidator.js';
import {
  formatDescriptorForDisplay,
  filterValidDescriptors,
} from '../utils/bodyDescriptorUtils.js';
```

### 4. Remove Entity-Level Support

**Complete removal of entity-level descriptor support**:

- Remove any fallback to entity-level descriptor components
- Remove helper methods for entity-level extraction
- Clean up any deprecated code paths
- Log warnings if entity-level descriptors are detected

```javascript
/**
 * Logs warning if deprecated entity-level descriptors are found
 * @param {Object} bodyEntity - The entity to check
 * @private
 */
#warnIfEntityLevelDescriptors(bodyEntity) {
  // Check for deprecated entity-level descriptor components
  const entityLevelDescriptors = ['descriptors:build', 'descriptors:body_hair', 'descriptors:body_composition'];

  for (const componentId of entityLevelDescriptors) {
    if (bodyEntity.hasComponent(componentId)) {
      this.#logger.warn(
        `Entity ${bodyEntity.id} has deprecated entity-level descriptor '${componentId}'. ` +
        'Please migrate to body-level descriptors in anatomy:body component.'
      );
    }
  }
}
```

## Implementation Steps

1. **Locate BodyDescriptionComposer**
   - Find the existing BodyDescriptionComposer service
   - Examine current method signatures and structure
   - Understand existing descriptor extraction patterns

2. **Update Extraction Methods**
   - Modify each extraction method to use body.descriptors only
   - Remove entity-level fallback logic
   - Ensure consistent error handling

3. **Add Helper Methods**
   - Implement safe body component access
   - Add validation integration
   - Create deprecation warning utilities

4. **Import Validation Utilities**
   - Add imports for centralized validation
   - Import utility functions for descriptor handling
   - Integrate with constants from BODDESCMIG-005

5. **Clean Up Deprecated Code**
   - Remove entity-level descriptor support completely
   - Remove unused helper methods
   - Update comments and documentation

6. **Add Logging and Error Handling**
   - Log warnings for deprecated usage patterns
   - Handle missing components gracefully
   - Provide clear error context

## Validation Criteria

### Extraction Method Tests

- [ ] extractBuildDescription() returns correct value from body.descriptors.build
- [ ] extractBodyHairDescription() returns correct value from body.descriptors.density
- [ ] extractBodyCompositionDescription() returns correct value from body.descriptors.composition
- [ ] extractSkinColorDescription() returns correct value from body.descriptors.skinColor
- [ ] All extraction methods return empty string when descriptors not present
- [ ] All extraction methods handle null/missing body component gracefully

### Entity-Level Deprecation Tests

- [ ] Entity-level descriptors are no longer used as fallback
- [ ] Warning logged when entity-level descriptors detected
- [ ] No breaking changes when entity-level descriptors present
- [ ] Clean extraction from body-level descriptors only

### Error Handling Tests

- [ ] Missing anatomy:body component handled gracefully
- [ ] Invalid descriptor values handled without throwing
- [ ] Component access errors logged appropriately
- [ ] Validation integration works correctly

### Integration Tests

- [ ] Works with body components generated by AnatomyGenerationWorkflow
- [ ] Integrates correctly with validation utilities from BODDESCMIG-005
- [ ] Extraction methods provide data for description generation
- [ ] Performance impact is minimal

## Expected Method Behavior

### With Body Descriptors Present

```javascript
// Input: anatomy:body component with
// body.descriptors = { build: "athletic", density: "moderate", skinColor: "olive" }

extractBuildDescription(bodyEntity); // Returns: "athletic"
extractBodyHairDescription(bodyEntity); // Returns: "moderate"
extractBodyCompositionDescription(bodyEntity); // Returns: ""
extractSkinColorDescription(bodyEntity); // Returns: "olive"
```

### With No Body Descriptors

```javascript
// Input: anatomy:body component with
// body = { root: "part_123", parts: {...} }  // No descriptors

extractBuildDescription(bodyEntity); // Returns: ""
extractBodyHairDescription(bodyEntity); // Returns: ""
extractBodyCompositionDescription(bodyEntity); // Returns: ""
extractSkinColorDescription(bodyEntity); // Returns: ""
```

### With Missing Component

```javascript
// Input: entity without anatomy:body component

extractBuildDescription(bodyEntity); // Returns: "" (no error thrown)
// Warning logged about missing component
```

## Testing Requirements

### Unit Tests

**File**: `tests/unit/anatomy/services/BodyDescriptionComposer.test.js`

Test cases:

- Extraction from valid body.descriptors structure
- Extraction with missing descriptors (empty strings)
- Extraction with partial descriptors
- Error handling for missing anatomy:body component
- Validation integration with invalid descriptors
- Warning generation for entity-level descriptors
- Performance of extraction methods

### Mock Test Data

```javascript
const mockBodyComponentWithDescriptors = {
  recipeId: 'anatomy:test',
  body: {
    root: 'part_123',
    parts: { torso: 'part_123' },
    descriptors: {
      build: 'athletic',
      density: 'moderate',
      composition: 'lean',
      skinColor: 'olive',
    },
  },
};

const mockBodyComponentWithoutDescriptors = {
  recipeId: 'anatomy:test',
  body: {
    root: 'part_123',
    parts: { torso: 'part_123' },
  },
};
```

### Integration Tests

**File**: `tests/integration/anatomy/bodyDescriptionExtraction.test.js`

Test cases:

- End-to-end extraction from generated body components
- Integration with AnatomyGenerationWorkflow output
- Integration with validation utilities
- Performance with realistic body components

## Files Modified

- `src/anatomy/services/BodyDescriptionComposer.js`

## Files Created

- Enhanced test files with updated test cases

## Integration Points

### With Previous Tickets

- Uses body component structure from BODDESCMIG-001
- Works with components generated by BODDESCMIG-004
- Integrates validation from BODDESCMIG-005

### With Future Tickets

- Extraction methods will be used by BODDESCMIG-007 for description generation
- Provides foundation for complete description composer update

### With Existing Systems

- Maintains compatibility with existing entity handling
- Uses existing component access patterns
- Integrates with existing logging system

## Risk Assessment

**Medium Risk** - Core service modification:

- Changes to critical description extraction methods
- Removal of existing fallback mechanisms
- Integration with new validation system

**Mitigation Strategies**:

- Comprehensive testing of extraction methods
- Gradual migration with deprecation warnings
- Thorough validation of integration points
- Performance monitoring during rollout

## Success Criteria

1. **Extraction Functionality**:
   - All extraction methods work with new body.descriptors structure
   - No entity-level descriptor fallback remains
   - Graceful handling of missing descriptors

2. **Integration Quality**:
   - Seamless integration with validation utilities
   - Proper error handling and logging
   - No performance regression

3. **Code Quality**:
   - Clean removal of deprecated code paths
   - Clear method signatures and behavior
   - Comprehensive test coverage

## Next Steps

After completion:

- BODDESCMIG-007: Implement description generation with body descriptors
- BODDESCMIG-008: Comprehensive testing and documentation

## Notes

- This ticket removes deprecated entity-level descriptor support completely
- Focus on extraction methods only - description generation comes in BODDESCMIG-007
- Important to maintain backward compatibility where possible
- Consider performance implications of component access patterns
- Validation integration should be optional to prevent description generation failures
