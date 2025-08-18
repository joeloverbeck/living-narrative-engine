# BODDESCMIG-007: Implement Description Generation with Body Descriptors

## Ticket ID

BODDESCMIG-007

## Title

Update BodyDescriptionComposer to generate descriptions with body-level descriptors first

## Status

READY FOR IMPLEMENTATION

## Priority

HIGH

## Estimated Effort

2-3 hours

## Dependencies

- BODDESCMIG-005: Add body descriptor validation logic ✅
- BODDESCMIG-006: Update BodyDescriptionComposer methods ✅

## Related Specs

- specs/body-descriptor-migration.spec.md (Section 4.4.1, Section 2.1 FR-3)

## Description

Update the main `composeDescription` method in BodyDescriptionComposer to generate body descriptions with body-level descriptors displayed FIRST, followed by existing part-level descriptions. This implements the core user-facing functionality that provides the enhanced description format.

## Current State

**File**: `src/anatomy/services/BodyDescriptionComposer.js`

Current `composeDescription` method likely:
- Generates part-level descriptions only
- Does not include body-level descriptors
- May have complex formatting logic for parts

Updated method should:
- Generate body-level descriptors FIRST (in specific order)
- Continue with existing part-level description logic
- Maintain backward compatibility with entities without body descriptors

## Technical Requirements

### 1. Enhanced Description Generation Method

#### Updated composeDescription Method
```javascript
/**
 * Composes complete body description with body descriptors first, then part descriptions
 * @param {Object} bodyEntity - Entity with anatomy:body component
 * @returns {Promise<string>} Complete formatted body description
 */
async composeDescription(bodyEntity) {
  try {
    // ... existing validation code ...
    this.#validateEntity(bodyEntity);
    
    const lines = [];
    
    // FIRST: Add body-level descriptors (NEW)
    await this.#addBodyLevelDescriptors(lines, bodyEntity);
    
    // THEN: Add existing part-level descriptions (UNCHANGED)
    await this.#addPartLevelDescriptions(lines, bodyEntity);
    
    return lines.join('\n');
    
  } catch (error) {
    this.#logger.error(`Description composition failed for entity ${bodyEntity?.id}`, error);
    throw new BodyDescriptionError(`Failed to compose body description: ${error.message}`);
  }
}
```

#### Body-Level Descriptor Addition
```javascript
/**
 * Adds body-level descriptors to description lines in specified order
 * @param {string[]} lines - Array to add description lines to
 * @param {Object} bodyEntity - Entity with anatomy:body component
 * @private
 */
async #addBodyLevelDescriptors(lines, bodyEntity) {
  // Extract descriptors using updated extraction methods
  const skinColor = this.extractSkinColorDescription(bodyEntity);
  const build = this.extractBuildDescription(bodyEntity);
  const bodyHair = this.extractBodyHairDescription(bodyEntity);  // density → "Body hair"
  const composition = this.extractBodyCompositionDescription(bodyEntity);
  
  // Add descriptors in specified order, only if they exist
  if (skinColor) {
    lines.push(formatDescriptorForDisplay('skinColor', skinColor));  // "Skin color: olive"
  }
  
  if (build) {
    lines.push(formatDescriptorForDisplay('build', build));  // "Build: athletic"
  }
  
  if (bodyHair) {
    lines.push(formatDescriptorForDisplay('density', bodyHair));  // "Body hair: moderate"
  }
  
  if (composition) {
    lines.push(formatDescriptorForDisplay('composition', composition));  // "Body composition: lean"
  }
}
```

#### Part-Level Description Addition (Preserved)
```javascript
/**
 * Adds part-level descriptions to description lines (existing logic preserved)
 * @param {string[]} lines - Array to add description lines to
 * @param {Object} bodyEntity - Entity with anatomy:body component
 * @private
 */
async #addPartLevelDescriptions(lines, bodyEntity) {
  // ... existing part description generation logic ...
  // This method preserves all existing part description functionality
  // Part descriptions continue to work exactly as before
  
  const bodyComponent = this.#getBodyComponent(bodyEntity);
  if (!bodyComponent?.body?.parts) {
    return;
  }
  
  // Process each body part (existing logic)
  for (const [partId, partEntityId] of Object.entries(bodyComponent.body.parts)) {
    try {
      const partEntity = await this.#entityManager.getEntity(partEntityId);
      const partDescription = await this.#generatePartDescription(partEntity);
      
      if (partDescription) {
        lines.push(partDescription);
      }
    } catch (error) {
      this.#logger.warn(`Failed to generate description for part ${partId}:`, error);
      // Continue with other parts
    }
  }
}
```

### 2. Output Format Examples

#### Complete Description Output
```
Skin color: olive
Build: athletic
Body hair: moderate
Body composition: lean
Head: bearded face with piercing blue eyes
Torso: well-proportioned chest, connecting to strong arms
Arms: muscular and defined
Legs: powerful and sturdy
```

#### Partial Descriptors Output
```
Build: slim
Skin color: pale
Head: youthful face with bright green eyes
Torso: slender frame
```

#### No Body Descriptors (Backward Compatibility)
```
Head: average face with brown eyes
Torso: typical build
Arms: normal proportions
```

### 3. Integration with Utility Functions

Use centralized formatting and validation:

```javascript
import { 
  formatDescriptorForDisplay,
  filterValidDescriptors,
  getActiveDescriptorProperties
} from '../utils/bodyDescriptorUtils.js';

/**
 * Alternative implementation using utility functions
 * @param {string[]} lines - Array to add description lines to
 * @param {Object} bodyEntity - Entity with anatomy:body component
 * @private
 */
async #addBodyLevelDescriptorsUsingUtils(lines, bodyEntity) {
  const bodyComponent = this.#getBodyComponent(bodyEntity);
  const bodyDescriptors = bodyComponent?.body?.descriptors;
  
  if (!bodyDescriptors) {
    return; // No descriptors to add
  }
  
  // Filter and validate descriptors
  const validDescriptors = filterValidDescriptors(bodyDescriptors);
  
  // Add descriptors in specified order (not object iteration order)
  const orderedProperties = ['skinColor', 'build', 'density', 'composition'];
  
  for (const property of orderedProperties) {
    if (validDescriptors[property]) {
      const displayLine = formatDescriptorForDisplay(property, validDescriptors[property]);
      lines.push(displayLine);
    }
  }
}
```

### 4. Error Handling Enhancement

```javascript
/**
 * Validates entity has required components for description generation
 * @param {Object} bodyEntity - Entity to validate
 * @throws {BodyDescriptionError} If validation fails
 * @private
 */
#validateEntity(bodyEntity) {
  if (!bodyEntity) {
    throw new BodyDescriptionError('Body entity is required');
  }
  
  if (!bodyEntity.hasComponent(this.#constants.ANATOMY_BODY_COMPONENT_ID)) {
    throw new BodyDescriptionError(`Entity ${bodyEntity.id} missing anatomy:body component`);
  }
}

/**
 * Custom error for body description generation failures
 */
class BodyDescriptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BodyDescriptionError';
  }
}
```

## Implementation Steps

1. **Analyze Current composeDescription Method**
   - Understand existing description generation logic
   - Identify part-level description generation code
   - Determine integration points for body descriptors

2. **Extract Part Description Logic**
   - Separate part-level description logic into private method
   - Preserve all existing part description functionality
   - Ensure no breaking changes to part descriptions

3. **Implement Body Descriptor Addition**
   - Create method to add body-level descriptors
   - Use extraction methods from BODDESCMIG-006
   - Implement proper ordering (skinColor, build, density, composition)

4. **Update Main composeDescription Method**
   - Add body descriptors first
   - Follow with part descriptions
   - Maintain proper error handling

5. **Integrate Utility Functions**
   - Use formatting utilities from BODDESCMIG-005
   - Implement proper validation integration
   - Ensure consistent formatting

6. **Test Description Generation**
   - Test with various descriptor combinations
   - Test backward compatibility
   - Test error handling scenarios
   - Verify output formatting

## Validation Criteria

### Description Format Tests
- [ ] Body descriptors appear BEFORE part descriptions
- [ ] Descriptor order: skinColor, build, density (body hair), composition
- [ ] Each descriptor formatted as "Label: value"
- [ ] Empty lines not added for missing descriptors
- [ ] Part descriptions unchanged in format and content

### Content Validation Tests
- [ ] All present body descriptors included in output
- [ ] Missing body descriptors skipped (no empty lines)
- [ ] Partial descriptors handled correctly
- [ ] skinColor displayed as "Skin color: [value]"
- [ ] density displayed as "Body hair: [value]" (label mapping)
- [ ] build displayed as "Build: [value]"
- [ ] composition displayed as "Body composition: [value]"

### Backward Compatibility Tests
- [ ] Entities without body descriptors work unchanged
- [ ] Part-level descriptions continue to work exactly as before
- [ ] No breaking changes to existing description format
- [ ] Performance impact minimal

### Integration Tests
- [ ] Works with body components from AnatomyGenerationWorkflow
- [ ] Integrates with extraction methods from BODDESCMIG-006
- [ ] Uses validation utilities from BODDESCMIG-005
- [ ] Error handling works correctly

## Expected Output Examples

### Complete Example
Input body.descriptors:
```json
{
  "build": "athletic",
  "density": "moderate",
  "composition": "lean",
  "skinColor": "olive"
}
```

Output:
```
Skin color: olive
Build: athletic
Body hair: moderate
Body composition: lean
Head: bearded face with piercing blue eyes
Torso: well-proportioned, connecting to strong arms
```

### Partial Example
Input body.descriptors:
```json
{
  "build": "slim",
  "skinColor": "pale"
}
```

Output:
```
Skin color: pale
Build: slim
Head: youthful face
Torso: slender frame
```

### Backward Compatibility Example
Input: No body.descriptors

Output:
```
Head: average appearance
Torso: typical build
Arms: normal proportions
```

## Testing Requirements

### Unit Tests

**File**: `tests/unit/anatomy/services/BodyDescriptionComposer.test.js`

Enhanced test cases:
- `composeDescription()` with complete body descriptors
- `composeDescription()` with partial body descriptors
- `composeDescription()` without body descriptors (backward compatibility)
- Body descriptor ordering verification
- Integration with extraction methods
- Error handling for invalid entities
- Performance testing with realistic body components

### Test Data
```javascript
const mockEntityWithFullDescriptors = {
  id: 'test_entity',
  getComponentData: jest.fn().mockReturnValue({
    recipeId: 'anatomy:test',
    body: {
      root: 'part_123',
      parts: { torso: 'part_123', head: 'part_124' },
      descriptors: {
        build: 'athletic',
        density: 'moderate', 
        composition: 'lean',
        skinColor: 'olive'
      }
    }
  }),
  hasComponent: jest.fn().mockReturnValue(true)
};
```

### Integration Tests

**File**: `tests/integration/anatomy/bodyDescriptionGeneration.test.js`

Test cases:
- End-to-end description generation with body descriptors
- Integration with complete anatomy generation workflow
- Performance with realistic entity structures
- Comparison with expected output formats

## Files Modified

- `src/anatomy/services/BodyDescriptionComposer.js`

## Files Created

- Enhanced test files with updated test cases
- Test fixtures for various descriptor combinations

## Integration Points

### With Previous Tickets
- Uses extraction methods from BODDESCMIG-006
- Uses validation utilities from BODDESCMIG-005
- Works with body components from BODDESCMIG-004

### With Future Tickets
- Provides foundation for BODDESCMIG-008 testing
- Final implementation for complete body descriptor migration

### With Existing Systems
- Maintains compatibility with existing description consumers
- Preserves part description functionality
- Integrates with entity management system

## Risk Assessment

**Medium Risk** - Core description generation modification:
- Changes to main user-facing functionality
- Integration of multiple previous enhancements
- Potential impact on existing description consumers

**Mitigation Strategies**:
- Comprehensive testing of output format
- Gradual rollout with monitoring
- Backward compatibility validation
- Performance impact assessment

## Success Criteria

1. **Description Quality**:
   - Body descriptors appear first in correct order
   - Proper formatting and labeling
   - No impact on part description quality

2. **System Integration**:
   - Seamless integration with all previous tickets
   - No breaking changes to existing functionality
   - Proper error handling and validation

3. **Performance**:
   - No measurable performance degradation
   - Efficient description generation
   - Proper resource usage

## Next Steps

After completion:
- BODDESCMIG-008: Comprehensive testing and documentation
- Integration testing with complete feature set
- Performance validation and optimization if needed

## Notes

- This ticket completes the core user-facing functionality
- Focus on preserving existing part description behavior exactly
- Body descriptor ordering is critical for consistent output
- Consider caching formatted descriptors if performance becomes an issue
- Ensure clear separation between body and part description generation logic