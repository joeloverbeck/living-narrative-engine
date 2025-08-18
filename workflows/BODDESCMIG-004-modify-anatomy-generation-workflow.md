# BODDESCMIG-004: Modify AnatomyGenerationWorkflow

## Ticket ID

BODDESCMIG-004

## Title

Modify AnatomyGenerationWorkflow to apply body descriptors from recipes

## Status

READY FOR IMPLEMENTATION

## Priority

HIGH

## Estimated Effort

2-3 hours

## Dependencies

- BODDESCMIG-001: Update body component schema ✅
- BODDESCMIG-002: Update anatomy recipe schema ✅
- BODDESCMIG-003: Update sample recipes and validation ✅

## Related Specs

- specs/body-descriptor-migration.spec.md (Section 4.3, Section 3.3 Data Flow)

## Description

Modify the AnatomyGenerationWorkflow to read `bodyDescriptors` from recipes and apply them to the generated `anatomy:body` component. This implements the core functionality that transforms recipe-defined body descriptors into the component structure for use by the description system.

## Current State

**File**: `src/anatomy/workflows/anatomyGenerationWorkflow.js` (expected location based on spec)

Current workflow:
1. Reads recipe definition
2. Generates body parts from slots
3. Creates anatomy:body component with root and parts
4. Does NOT handle body-level descriptors

Missing functionality:
- Reading bodyDescriptors from recipe
- Applying descriptors to body component
- Validation of descriptor values
- Integration with existing generation process

## Technical Requirements

### Core Functionality Enhancement

#### 1. Body Descriptor Application

Add method to apply body descriptors from recipe to generated body component:

```javascript
/**
 * Applies body-level descriptors from recipe to the body component
 * @param {Object} bodyComponent - The generated body component data
 * @param {Object} recipe - The anatomy recipe with optional bodyDescriptors
 * @returns {Object} Enhanced body component with descriptors
 */
_applyBodyDescriptors(bodyComponent, recipe) {
  if (!recipe.bodyDescriptors) {
    return bodyComponent; // No descriptors to apply
  }
  
  // Apply body-level descriptors to the body component
  return {
    ...bodyComponent,
    body: {
      ...bodyComponent.body,
      descriptors: {
        ...recipe.bodyDescriptors
      }
    }
  };
}
```

#### 2. Integration with Main Generation Flow

Modify the main `generateAnatomy` method:

```javascript
async generateAnatomy(entityId, recipeId) {
  try {
    // ... existing validation and loading code ...
    
    const recipe = await this.recipeLoader.loadRecipe(recipeId);
    
    // ... existing body generation code ...
    
    // Generate base body component
    let bodyComponent = {
      recipeId: recipeId,
      body: {
        root: rootPartId,
        parts: generatedParts
      }
    };
    
    // NEW: Apply body descriptors from recipe
    bodyComponent = this._applyBodyDescriptors(bodyComponent, recipe);
    
    // ... continue with existing code ...
    
    return bodyComponent;
    
  } catch (error) {
    this.#logger.error(`Anatomy generation failed for entity ${entityId}`, error);
    throw new AnatomyGenerationError(`Failed to generate anatomy: ${error.message}`);
  }
}
```

#### 3. Descriptor Validation

Add validation of descriptor values during application:

```javascript
/**
 * Validates body descriptor values against allowed enums
 * @param {Object} bodyDescriptors - The descriptors to validate
 * @param {string} recipeId - Recipe ID for error context
 * @throws {AnatomyGenerationError} If descriptors are invalid
 */
_validateBodyDescriptors(bodyDescriptors, recipeId) {
  if (!bodyDescriptors) return;
  
  const validBuilds = ['skinny', 'slim', 'toned', 'athletic', 'shapely', 'thick', 'muscular', 'stocky'];
  const validDensities = ['hairless', 'sparse', 'light', 'moderate', 'hairy', 'very-hairy'];
  const validCompositions = ['underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese'];
  
  // Validate build
  if (bodyDescriptors.build && !validBuilds.includes(bodyDescriptors.build)) {
    throw new AnatomyGenerationError(
      `Invalid build descriptor '${bodyDescriptors.build}' in recipe '${recipeId}'. Must be one of: ${validBuilds.join(', ')}`
    );
  }
  
  // Validate density (body hair)
  if (bodyDescriptors.density && !validDensities.includes(bodyDescriptors.density)) {
    throw new AnatomyGenerationError(
      `Invalid density descriptor '${bodyDescriptors.density}' in recipe '${recipeId}'. Must be one of: ${validDensities.join(', ')}`
    );
  }
  
  // Validate composition
  if (bodyDescriptors.composition && !validCompositions.includes(bodyDescriptors.composition)) {
    throw new AnatomyGenerationError(
      `Invalid composition descriptor '${bodyDescriptors.composition}' in recipe '${recipeId}'. Must be one of: ${validCompositions.join(', ')}`
    );
  }
  
  // skinColor is free-form string - no enum validation needed
  
  // Log warnings for deprecated entity-level descriptors (if any detected)
  // Note: This workflow doesn't handle entity-level descriptors anymore
}
```

### Integration with Existing Architecture

#### Event System Integration

Enhance existing event dispatching:

```javascript
// At the end of successful generation
this.#eventBus.dispatch({
  type: 'ANATOMY_GENERATION_COMPLETED',
  payload: { 
    entityId, 
    recipeId,
    hasBodyDescriptors: Boolean(recipe.bodyDescriptors),
    bodyDescriptorCount: recipe.bodyDescriptors ? Object.keys(recipe.bodyDescriptors).length : 0
  }
});
```

#### Error Handling Enhancement

```javascript
// In error handling blocks
if (error instanceof AnatomyDescriptorValidationError) {
  this.#eventBus.dispatch({
    type: 'ANATOMY_DESCRIPTOR_VALIDATION_FAILED',
    payload: {
      entityId,
      recipeId,
      error: error.message
    }
  });
  throw error;
}
```

## Implementation Steps

1. **Locate AnatomyGenerationWorkflow**
   - Find the file (src/anatomy/workflows/anatomyGenerationWorkflow.js)
   - Examine current structure and dependencies
   - Understand existing generation process

2. **Add Descriptor Application Method**
   - Implement `_applyBodyDescriptors()` method
   - Handle missing bodyDescriptors gracefully
   - Ensure proper object structure creation

3. **Add Descriptor Validation Method**
   - Implement `_validateBodyDescriptors()` method
   - Use enum constants for validation
   - Provide clear error messages

4. **Modify Main Generation Flow**
   - Integrate descriptor application into generateAnatomy()
   - Add validation call before descriptor application
   - Maintain existing error handling patterns

5. **Enhance Event System**
   - Add body descriptor information to events
   - Ensure error events include descriptor context
   - Maintain existing event structure

6. **Test Integration**
   - Test with recipes containing bodyDescriptors
   - Test with recipes without bodyDescriptors
   - Test validation with invalid descriptors
   - Verify component structure correctness

## Validation Criteria

### Core Functionality Tests
- [ ] Recipes with bodyDescriptors generate correct body component structure
- [ ] Recipes without bodyDescriptors work unchanged (backward compatibility)
- [ ] body.descriptors object created only when recipe has bodyDescriptors
- [ ] All descriptor values copied correctly to body component
- [ ] Partial bodyDescriptors handled correctly (only specified ones applied)

### Validation Tests
- [ ] Invalid build enum values trigger AnatomyGenerationError
- [ ] Invalid density enum values trigger AnatomyGenerationError  
- [ ] Invalid composition enum values trigger AnatomyGenerationError
- [ ] skinColor values pass through without enum validation
- [ ] Error messages include recipe ID and invalid value
- [ ] Validation errors prevent body component creation

### Integration Tests
- [ ] Generated body components validate against updated schema
- [ ] Event system receives correct anatomy generation events
- [ ] Error handling works with descriptor validation failures
- [ ] Performance impact is minimal (no measurable overhead)

### Data Structure Tests
- [ ] Generated body component has correct structure:
  ```json
  {
    "recipeId": "anatomy:example",
    "body": {
      "root": "part_123",
      "parts": { "torso": "part_123" },
      "descriptors": {
        "build": "athletic",
        "density": "moderate",
        "skinColor": "olive"
      }
    }
  }
  ```

## Error Handling

### AnatomyGenerationError Enhancement
Add descriptor-specific error types:
- AnatomyDescriptorValidationError
- InvalidBodyDescriptorError
- MissingDescriptorEnumError

### Error Context
All errors should include:
- Entity ID being processed
- Recipe ID being used
- Specific descriptor that failed
- Valid values for enum fields

## Testing Requirements

### Unit Tests

**File**: `tests/unit/anatomy/workflows/AnatomyGenerationWorkflow.test.js`

Test cases:
- `_applyBodyDescriptors()` with complete descriptors
- `_applyBodyDescriptors()` with partial descriptors
- `_applyBodyDescriptors()` with no descriptors (undefined)
- `_validateBodyDescriptors()` with valid values
- `_validateBodyDescriptors()` with invalid enum values
- `generateAnatomy()` integration with body descriptors
- Error handling for descriptor validation failures
- Event dispatching with descriptor information

### Integration Tests

**File**: `tests/integration/anatomy/anatomyGeneration.test.js`

Test cases:
- End-to-end generation with body descriptors
- Recipe loading → generation → component validation
- Backward compatibility with existing recipes
- Error scenarios with invalid descriptors
- Performance impact measurement

## Files Modified

- `src/anatomy/workflows/anatomyGenerationWorkflow.js`
- Possibly related error classes (AnatomyGenerationError)

## Files Created

- Test files for enhanced functionality
- Error handling utilities if needed

## Integration Points

### With Previous Tickets
- Uses body component schema from BODDESCMIG-001
- Uses recipe schema from BODDESCMIG-002
- Works with sample recipes from BODDESCMIG-003

### With Future Tickets
- Generated components will be used by BODDESCMIG-006 & 007 (BodyDescriptionComposer)
- Validation logic may be shared with BODDESCMIG-005

### With Existing Systems
- Maintains compatibility with existing recipe loading
- Preserves part generation workflow
- Integrates with entity component system
- Uses existing event bus patterns

## Risk Assessment

**Medium Risk** - Modifies core generation logic:
- Changes to main anatomy generation workflow
- New validation logic could introduce failures
- Integration with existing generation process

**Mitigation Strategies**:
- Thorough testing of backward compatibility
- Gradual rollout with feature flags if needed
- Comprehensive error handling and logging
- Performance monitoring during implementation

## Success Criteria

1. **Core Functionality**:
   - Body descriptors from recipes applied to body components
   - Generated components validate against updated schema
   - Backward compatibility with existing recipes

2. **Data Quality**:
   - Proper validation prevents invalid descriptors
   - Clear error messages for debugging
   - Consistent data structure generation

3. **System Integration**:
   - Seamless integration with existing workflow
   - Event system enhancement working correctly
   - No performance degradation

## Next Steps

After completion:
- BODDESCMIG-005: Add body descriptor validation logic
- BODDESCMIG-006: Update BodyDescriptionComposer methods

## Notes

- This is a core implementation ticket affecting the main generation workflow
- Proper testing is critical due to integration with existing systems  
- Consider feature flag for gradual rollout if needed
- Maintain comprehensive logging for debugging during rollout
- Validation logic should be reusable across different systems