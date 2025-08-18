# BODDESCMIG-003: Update Sample Recipes and Validation

## Ticket ID

BODDESCMIG-003

## Title

Update sample recipes and enhance validation for body descriptor support

## Status

READY FOR IMPLEMENTATION

## Priority

MEDIUM

## Estimated Effort

1-2 hours

## Dependencies

- BODDESCMIG-001: Update body component schema ✅
- BODDESCMIG-002: Update anatomy recipe schema ✅

## Related Specs

- specs/body-descriptor-migration.spec.md (Section 4.2, Section 7 Examples)

## Description

Update existing sample anatomy recipes to demonstrate the new `bodyDescriptors` functionality and enhance recipe validation to support the new body-level descriptor structure. This provides concrete examples for modders and ensures proper validation of the enhanced recipe format.

## Current State

**Sample Recipe Files**:

- Location: `data/mods/anatomy/recipes/`
- Current recipes lack bodyDescriptors examples
- Need demonstration recipes for modder guidance

**Recipe Validation**:

- RecipeLoader validates against schema
- Need enhanced validation for body descriptors
- Error handling for new descriptor format

## Technical Requirements

### 1. Sample Recipe Updates

#### Create Enhanced Recipe Examples

**File**: `data/mods/anatomy/recipes/example_warrior.recipe.json`

```json
{
  "recipeId": "anatomy:example_warrior",
  "name": "Warrior Body Example",
  "description": "Example recipe demonstrating body descriptors",
  "bodyDescriptors": {
    "build": "muscular",
    "density": "hairy",
    "composition": "lean",
    "skinColor": "tanned"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_male_torso_muscular",
      "properties": {
        "descriptors:build": { "build": "muscular" }
      }
    },
    "head": {
      "partType": "head",
      "preferId": "anatomy:human_male_head_bearded"
    }
  }
}
```

**File**: `data/mods/anatomy/recipes/example_athletic.recipe.json`

```json
{
  "recipeId": "anatomy:example_athletic",
  "name": "Athletic Body Example",
  "description": "Example recipe with partial body descriptors",
  "bodyDescriptors": {
    "build": "athletic",
    "composition": "lean",
    "skinColor": "olive"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "properties": {
        "descriptors:build": { "build": "toned" }
      }
    }
  }
}
```

**File**: `data/mods/anatomy/recipes/example_basic.recipe.json`

```json
{
  "recipeId": "anatomy:example_basic",
  "name": "Basic Human Example",
  "description": "Example recipe without body descriptors (backward compatibility)",
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_male_torso_average"
    },
    "head": {
      "partType": "head"
    }
  }
}
```

### 2. Recipe Validation Enhancement

#### Validate Body Descriptors in Recipe Loading

**File**: `src/loaders/recipeLoader.js` (if exists) or appropriate recipe validation component

Enhanced validation should:

1. **Validate descriptor values against enums**
   - Ensure build values match allowed enum
   - Validate density values against body hair enum
   - Check composition values
   - Validate skinColor format

2. **Provide clear error messages**
   - "Invalid build descriptor: 'invalid-build'. Must be one of: skinny, slim, toned..."
   - "Unknown body descriptor property: 'unknownProp'"
   - "Body descriptor validation failed for recipe: anatomy:example"

3. **Graceful handling of missing descriptors**
   - bodyDescriptors field is optional
   - Empty bodyDescriptors object is valid
   - Partial bodyDescriptors are valid

#### Error Handling Implementation

```javascript
validateBodyDescriptors(bodyDescriptors, recipeId) {
  if (!bodyDescriptors) return; // Optional field

  const validBuilds = ['skinny', 'slim', 'toned', 'athletic', 'shapely', 'thick', 'muscular', 'stocky'];
  const validDensities = ['hairless', 'sparse', 'light', 'moderate', 'hairy', 'very-hairy'];
  const validCompositions = ['underweight', 'lean', 'average', 'soft', 'chubby', 'overweight', 'obese'];

  // Validate build
  if (bodyDescriptors.build && !validBuilds.includes(bodyDescriptors.build)) {
    throw new RecipeValidationError(
      `Invalid build descriptor: '${bodyDescriptors.build}' in recipe '${recipeId}'. Must be one of: ${validBuilds.join(', ')}`
    );
  }

  // Validate density
  if (bodyDescriptors.density && !validDensities.includes(bodyDescriptors.density)) {
    throw new RecipeValidationError(
      `Invalid density descriptor: '${bodyDescriptors.density}' in recipe '${recipeId}'. Must be one of: ${validDensities.join(', ')}`
    );
  }

  // Validate composition
  if (bodyDescriptors.composition && !validCompositions.includes(bodyDescriptors.composition)) {
    throw new RecipeValidationError(
      `Invalid composition descriptor: '${bodyDescriptors.composition}' in recipe '${recipeId}'. Must be one of: ${validCompositions.join(', ')}`
    );
  }

  // skinColor is free-form string - no validation needed

  // Check for unknown properties
  const knownProps = ['build', 'density', 'composition', 'skinColor'];
  const unknownProps = Object.keys(bodyDescriptors).filter(prop => !knownProps.includes(prop));
  if (unknownProps.length > 0) {
    throw new RecipeValidationError(
      `Unknown body descriptor properties in recipe '${recipeId}': ${unknownProps.join(', ')}`
    );
  }
}
```

## Implementation Steps

1. **Create Example Recipes**
   - Create warrior example with all descriptors
   - Create athletic example with partial descriptors
   - Create basic example without descriptors
   - Add clear descriptions explaining each example

2. **Enhance Recipe Validation**
   - Locate recipe validation logic
   - Add bodyDescriptors validation function
   - Implement enum value checking
   - Add clear error messages
   - Handle optional field gracefully

3. **Update Recipe Loading Process**
   - Integrate descriptor validation into loading workflow
   - Ensure validation happens before recipe usage
   - Provide helpful error context (recipe ID, descriptor name)

4. **Test Validation Logic**
   - Test valid recipes with descriptors
   - Test invalid descriptor values
   - Test unknown descriptor properties
   - Test backward compatibility

## Validation Criteria

### Sample Recipe Tests

- [ ] All example recipes validate against updated schema
- [ ] Example recipes demonstrate different usage patterns
- [ ] Recipes provide clear documentation for modders
- [ ] Backward compatibility maintained with basic example

### Recipe Validation Tests

- [ ] Valid body descriptors pass validation
- [ ] Invalid enum values are caught and reported clearly
- [ ] Unknown properties are rejected with helpful messages
- [ ] Optional bodyDescriptors field handled correctly
- [ ] Empty bodyDescriptors object is valid
- [ ] Partial bodyDescriptors validate successfully

### Error Message Quality

- [ ] Error messages include recipe ID for context
- [ ] Error messages suggest valid values for enums
- [ ] Error messages are clear and actionable
- [ ] Validation errors don't crash recipe loading

## Testing Requirements

### Unit Tests

**File**: `tests/unit/recipes/recipeValidation.test.js`

Test cases:

- Valid recipes with all descriptor types
- Valid recipes with partial descriptors
- Valid recipes without descriptors
- Invalid build enum values
- Invalid density enum values
- Invalid composition enum values
- Unknown descriptor properties
- Empty bodyDescriptors object
- Error message content and clarity

### Integration Tests

**File**: `tests/integration/recipes/recipeLoading.test.js`

Test cases:

- Loading example recipes successfully
- Recipe validation integration with schema
- Error handling in recipe loading workflow
- Backward compatibility with existing recipes

## Files Created/Modified

### New Files

- `data/mods/anatomy/recipes/example_warrior.recipe.json`
- `data/mods/anatomy/recipes/example_athletic.recipe.json`
- `data/mods/anatomy/recipes/example_basic.recipe.json`

### Modified Files

- Recipe validation logic (location TBD based on codebase structure)
- Recipe loader integration
- Test files for validation

## Documentation Updates

### Recipe Examples Documentation

Create or update documentation explaining:

- How to use bodyDescriptors in recipes
- Available descriptor values and their meanings
- Examples of complete vs. partial descriptors
- Migration from part-level to body-level descriptors

### Modder Guidelines

- When to use body-level vs. part-level descriptors
- How body descriptors interact with part descriptors
- Best practices for descriptor usage

## Risk Assessment

**Low Risk** - Additive enhancement with clear fallbacks:

- Example recipes are demonstrative only
- Validation enhancement improves error handling
- Backward compatibility maintained
- Clear error messages help debugging

## Success Criteria

1. **Example Recipes**:
   - All examples validate successfully
   - Examples demonstrate key usage patterns
   - Clear documentation for modders

2. **Enhanced Validation**:
   - Proper validation of new descriptor format
   - Clear, actionable error messages
   - Graceful handling of edge cases

3. **Backward Compatibility**:
   - Existing recipes continue to work
   - Optional bodyDescriptors handled correctly
   - No breaking changes to recipe format

## Next Steps

After completion:

- BODDESCMIG-004: Modify AnatomyGenerationWorkflow
- BODDESCMIG-005: Add body descriptor validation logic

## Notes

- Example recipes serve as documentation and testing aids
- Enhanced validation prevents common descriptor errors
- Clear error messages improve modder experience
- Validation logic should be reusable across recipe systems
- Consider adding validation utilities for descriptor enums
