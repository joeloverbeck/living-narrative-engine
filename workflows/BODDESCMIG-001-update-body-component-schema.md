# BODDESCMIG-001: Update Body Component Schema

## Ticket ID

BODDESCMIG-001

## Title

Update anatomy:body component schema to support optional body-level descriptors

## Status

READY FOR IMPLEMENTATION

## Priority

HIGH

## Estimated Effort

1-2 hours

## Dependencies

**Implementation Dependencies:**
- Requires coordination with BodyDescriptionComposer updates
- Must verify anatomy generation workflow location and structure
- Integration with existing descriptor extraction patterns

**Completion Dependencies:**  
- This is the foundation ticket for the body descriptor migration
- BODDESCMIG-002 and subsequent tickets depend on this implementation

## Related Specs

- specs/body-descriptor-migration.spec.md (Section 3.1.1)

## Description

Update the `anatomy:body` component schema to add an optional `descriptors` field within the `body` property. This enhancement enables body-level descriptors (build, density, composition, skinColor) to be stored directly on the body component, providing a more convenient way to define overall body characteristics.

## Current State

**File**: `data/mods/anatomy/components/body.component.json`

Current schema only supports:
- `recipeId`: Recipe reference
- `body.root`: Root part entity ID
- `body.parts`: Map of part identifiers to entity IDs

**Current Descriptor Extraction**: The `BodyDescriptionComposer` already extracts body descriptors from entity-level components:
- `extractBuildDescription()` - extracts from `descriptors:build` component
- `extractDensityDescription()` - extracts from `descriptors:body_hair` component  
- `extractCompositionDescription()` - extracts from `descriptors:body_composition` component
- Missing: `extractSkinColorDescription()` method needs to be added

**Integration Note**: This schema change will require updating the extraction logic to check `body.descriptors` first, then fallback to entity-level components for backward compatibility.

## Technical Requirements

### Recipe Schema Update

Update `data/schemas/anatomy.recipe.schema.json` to add optional `bodyDescriptors` field:

```json
{
  "bodyDescriptors": {
    "type": "object",
    "description": "Optional body-level descriptors to apply to generated body",
    "properties": {
      "build": {
        "type": "string",
        "enum": ["skinny", "slim", "toned", "athletic", "shapely", "thick", "muscular", "stocky"]
      },
      "density": {
        "type": "string",
        "enum": ["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"]
      },
      "composition": {
        "type": "string",
        "enum": ["underweight", "lean", "average", "soft", "chubby", "overweight", "obese"]
      },
      "skinColor": {
        "type": "string"
      }
    },
    "additionalProperties": false
  }
}
```

### Body Component Schema Enhancement

Add optional `descriptors` object to the `body` property with the following supported descriptors:

1. **build** - Body build type
   - Enum: `["skinny", "slim", "toned", "athletic", "shapely", "thick", "muscular", "stocky"]`
   - Output label: "Build"

2. **density** - Body hair density
   - Enum: `["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"]`
   - Output label: "Body hair" (note: maps from density to "Body hair")

3. **composition** - Body composition
   - Enum: `["underweight", "lean", "average", "soft", "chubby", "overweight", "obese"]`
   - Output label: "Body composition"

4. **skinColor** - Skin color descriptor
   - Type: `string`
   - Output label: "Skin color"

### Updated Schema Structure

```json
{
  "body": {
    "type": ["object", "null"],
    "properties": {
      "root": { "type": "string" },
      "parts": { 
        "type": "object",
        "additionalProperties": { "type": "string" }
      },
      "descriptors": {
        "type": "object",
        "description": "Body-level descriptors that apply to the whole body",
        "properties": {
          "build": {
            "type": "string",
            "enum": ["skinny", "slim", "toned", "athletic", "shapely", "thick", "muscular", "stocky"]
          },
          "density": {
            "type": "string", 
            "enum": ["hairless", "sparse", "light", "moderate", "hairy", "very-hairy"]
          },
          "composition": {
            "type": "string",
            "enum": ["underweight", "lean", "average", "soft", "chubby", "overweight", "obese"]
          },
          "skinColor": {
            "type": "string"
          }
        },
        "additionalProperties": false
      }
    },
    "required": ["root", "parts"]
  }
}
```

## Implementation Steps

1. **Phase 1: Schema Updates**
   - Backup existing `body.component.json`
   - Update anatomy recipe schema to add optional `bodyDescriptors` field
   - Update body component schema to add optional `body.descriptors` field
   - Define all descriptor properties as optional with proper validation

2. **Phase 2: Update BodyDescriptionComposer**
   - Add missing `extractSkinColorDescription()` method
   - Modify existing extraction methods to check `body.descriptors` first
   - Implement fallback to entity-level components for backward compatibility
   - Update extraction priority logic:
     ```javascript
     // Check body.descriptors first, fallback to entity-level
     const bodyComponent = bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
     if (bodyComponent?.body?.descriptors?.build) {
       return bodyComponent.body.descriptors.build;
     }
     // Fallback to existing entity-level extraction
     const buildComponent = bodyEntity.getComponentData('descriptors:build');
     return buildComponent?.build || '';
     ```

3. **Phase 3: Update Anatomy Generation**
   - Locate anatomy generation workflow/service
   - Add logic to apply recipe `bodyDescriptors` to generated body components
   - Ensure generated bodies include descriptors when specified in recipes

4. **Phase 4: Comprehensive Testing**
   - Test backward compatibility (entity-level descriptors still work)
   - Test new body.descriptors structure takes precedence
   - Test recipe bodyDescriptors application during generation
   - Integration testing across all descriptor extraction points

## Validation Criteria

### Schema Validation Tests
- [ ] Existing body components validate without changes
- [ ] New descriptors structure validates correctly
- [ ] Invalid descriptor values are rejected (e.g., invalid enum values)
- [ ] Additional properties in descriptors are rejected
- [ ] All descriptor properties are optional
- [ ] Schema allows body components with no descriptors
- [ ] Schema allows body components with partial descriptors

### Example Valid Structures

**Without descriptors (backward compatibility)**:
```json
{
  "recipeId": "anatomy:human",
  "body": {
    "root": "part_123_torso",
    "parts": { "torso": "part_123_torso" }
  }
}
```

**With all descriptors**:
```json
{
  "recipeId": "anatomy:human", 
  "body": {
    "root": "part_123_torso",
    "parts": { "torso": "part_123_torso" },
    "descriptors": {
      "build": "athletic",
      "density": "moderate", 
      "composition": "average",
      "skinColor": "olive"
    }
  }
}
```

**With partial descriptors**:
```json
{
  "recipeId": "anatomy:human",
  "body": {
    "root": "part_123_torso", 
    "parts": { "torso": "part_123_torso" },
    "descriptors": {
      "build": "slim",
      "skinColor": "pale"
    }
  }
}
```

### Example Invalid Structures

**Invalid enum value**:
```json
{
  "descriptors": {
    "build": "invalid-build-type"  // Should be rejected
  }
}
```

**Additional property**:
```json
{
  "descriptors": {
    "build": "athletic",
    "unknownProperty": "value"  // Should be rejected
  }
}
```

## Testing Requirements

### Unit Tests
Create/update test files:
- `tests/unit/anatomy/components/bodyComponent.test.js` - Schema validation tests
- `tests/unit/anatomy/services/BodyDescriptionComposer.test.js` - Update extraction logic tests

Test cases for body component schema:
- Valid body component without descriptors
- Valid body component with all descriptors  
- Valid body component with partial descriptors
- Invalid descriptor enum values
- Additional properties in descriptors (should fail)
- Missing required fields (root, parts)
- Null body property (allowed)

Test cases for BodyDescriptionComposer updates:
- Extraction from body.descriptors when present
- Fallback to entity-level components when body.descriptors absent
- Precedence behavior when both body.descriptors and entity-level exist
- New extractSkinColorDescription() method functionality

### Integration Tests
- Test schema loading and validation in SchemaValidator
- Test component validation in EntityManager  
- Test anatomy generation with recipe bodyDescriptors
- Test end-to-end descriptor extraction across all integration points
- Verify no breaking changes to existing mod loading

## Files Modified

### Schema Files
- `data/mods/anatomy/components/body.component.json` - Add body.descriptors field
- `data/schemas/anatomy.recipe.schema.json` - Add bodyDescriptors field

### Source Code Files  
- `src/anatomy/services/BodyDescriptionComposer.js` - Update extraction logic and add skinColor method
- Anatomy generation workflow/service (location TBD) - Apply recipe bodyDescriptors

### Test Files
- `tests/unit/anatomy/components/bodyComponent.test.js` - Schema validation tests
- `tests/unit/anatomy/services/BodyDescriptionComposer.test.js` - Updated extraction tests
- Integration test files for end-to-end validation

## Risk Assessment

**Medium Risk** - Coordinated updates across multiple systems:

**Low Risk Components:**
- Schema additions are purely additive and optional
- Backward compatibility maintained for existing content
- Clear validation rules prevent invalid data

**Medium Risk Components:**
- Requires updating BodyDescriptionComposer extraction logic
- Coordination between recipe schema and body component schema
- Integration with anatomy generation workflow
- Potential behavior changes in descriptor extraction priority
- Need to add missing `extractSkinColorDescription()` method

**Mitigation Strategies:**
- Implement fallback logic for backward compatibility
- Comprehensive testing of both new and existing extraction paths
- Phase implementation to validate each component independently
- Maintain existing entity-level descriptor support during transition

## Success Criteria

1. **Schema validates correctly**:
   - All test cases pass
   - Backward compatibility maintained  
   - Proper validation of new descriptors
   - Recipe schema accepts bodyDescriptors field

2. **Backward Compatibility Guaranteed**:
   - Existing body components continue to validate without changes
   - Entity-level descriptor extraction still works when body.descriptors not present
   - Existing mods continue to load without modification
   - No performance regression in descriptor extraction

3. **End-to-End Integration Works**:
   - Recipe bodyDescriptors are applied during anatomy generation
   - Body.descriptors take precedence over entity-level descriptors when both present
   - BodyDescriptionComposer properly extracts from body.descriptors first
   - Missing extractSkinColorDescription() method is implemented and functional

4. **Clear validation rules**:
   - Invalid descriptor values rejected with clear error messages
   - Additional properties in descriptors are rejected
   - Proper enum constraint enforcement across both schemas

5. **Complete Feature Integration**:
   - All four descriptor types (build, density, composition, skinColor) work consistently
   - Fallback behavior is predictable and well-tested
   - Documentation accurately reflects the new extraction priority

## Next Steps

After completion:
- BODDESCMIG-002: Update anatomy recipe schema
- BODDESCMIG-003: Update sample recipes and validation

## Notes

- This is a purely additive enhancement
- All descriptor properties are optional
- Enum values match existing descriptor component definitions
- Schema follows project's JSON Schema patterns
- Maintains ECS architecture principles