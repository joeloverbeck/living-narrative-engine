# BODDESCMIG-002: Update Anatomy Recipe Schema

## Ticket ID

BODDESCMIG-002

## Title

Update anatomy recipe schema to support body-level descriptors

## Status

READY FOR IMPLEMENTATION

## Priority

HIGH

## Estimated Effort

1-2 hours

## Dependencies

- BODDESCMIG-001: Update body component schema ✅

## Related Specs

- specs/body-descriptor-migration.spec.md (Section 3.1.2, Section 4.2)

## Description

Update the anatomy recipe schema to support an optional `bodyDescriptors` field at the root level. This allows recipe authors to define body-level descriptors that will be applied to the generated body component, providing a convenient way to set overall body characteristics in recipes.

## Current State

**File**: `data/schemas/anatomy-recipe.schema.json`

Current recipe schema supports:
- Recipe metadata (recipeId, name, description)
- Slot definitions with part types and properties
- Part-specific descriptors within slot properties

Missing:
- Body-level descriptor support
- Integration with new body component descriptor structure

## Technical Requirements

### Schema Enhancement

Add optional `bodyDescriptors` field at the root level of recipes:

```json
{
  "type": "object",
  "properties": {
    "recipeId": { "type": "string" },
    "name": { "type": "string" },
    "bodyDescriptors": {
      "type": "object",
      "description": "Body-level descriptors applied to the generated body component",
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
    },
    "slots": { /* existing slot definitions */ }
  }
}
```

### Integration Points

The `bodyDescriptors` will be:
1. Validated against the schema during recipe loading
2. Applied to the generated `anatomy:body` component by AnatomyGenerationWorkflow
3. Used independently from part-specific descriptors

## Implementation Steps

1. **Locate Recipe Schema File**
   - Find `data/schemas/anatomy-recipe.schema.json`
   - Backup current schema

2. **Update Schema Structure**
   - Add optional `bodyDescriptors` property at root level
   - Define descriptor properties matching body component schema
   - Set `additionalProperties: false` for validation
   - Maintain existing schema structure

3. **Coordinate with Body Component Schema**
   - Ensure descriptor enums match BODDESCMIG-001 exactly
   - Maintain consistent property names and types
   - Align validation rules

4. **Test Schema Validation**
   - Existing recipes without bodyDescriptors validate
   - New recipes with bodyDescriptors validate
   - Invalid descriptor values are rejected
   - Schema prevents unexpected properties

## Example Recipe Structures

### Complete Recipe with Body Descriptors
```json
{
  "recipeId": "anatomy:warrior",
  "name": "Warrior Body Type",
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

### Minimal Recipe (Backward Compatibility)
```json
{
  "recipeId": "anatomy:basic_human",
  "name": "Basic Human",
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_male_torso_average"
    }
  }
}
```

### Partial Body Descriptors
```json
{
  "recipeId": "anatomy:athletic",
  "name": "Athletic Build",
  "bodyDescriptors": {
    "build": "athletic",
    "composition": "lean"
  },
  "slots": {
    "torso": {
      "partType": "torso"
    }
  }
}
```

## Validation Criteria

### Schema Validation Tests
- [ ] Existing recipes validate without changes
- [ ] Recipes with bodyDescriptors validate correctly
- [ ] Invalid descriptor enum values are rejected
- [ ] Additional properties in bodyDescriptors are rejected
- [ ] All bodyDescriptor properties are optional
- [ ] Empty bodyDescriptors object is valid
- [ ] Missing bodyDescriptors field is valid (backward compatibility)

### Invalid Examples (Should Fail)
```json
{
  "bodyDescriptors": {
    "build": "invalid-build",  // Invalid enum
    "unknownProp": "value"     // Additional property
  }
}
```

## Data Flow Integration

```
Recipe Definition (bodyDescriptors)
    ↓
AnatomyGenerationWorkflow.generateAnatomy()
    ↓
Apply bodyDescriptors to body component
    ↓
Body Component (with body.descriptors)
    ↓
BodyDescriptionComposer.composeDescription()
    ↓
Generated description with body-level descriptors first
```

## Testing Requirements

### Unit Tests
Create test file: `tests/unit/schemas/anatomyRecipeSchema.test.js`

Test cases:
- Valid recipe without bodyDescriptors (backward compatibility)
- Valid recipe with all bodyDescriptors
- Valid recipe with partial bodyDescriptors
- Invalid bodyDescriptor enum values (should fail)
- Additional properties in bodyDescriptors (should fail)
- Empty bodyDescriptors object
- Recipe validation integration

### Schema Loading Tests
- Test recipe schema loading in validation system
- Test recipe parsing with new bodyDescriptors
- Verify schema validation error messages

## Files Modified

- `data/schemas/anatomy-recipe.schema.json`

## Integration Points

### With BODDESCMIG-001
- Uses identical descriptor property definitions
- Matches enum values exactly
- Consistent validation rules

### With BODDESCMIG-004 (Future)
- AnatomyGenerationWorkflow will read bodyDescriptors
- Apply to generated body component
- Preserve part-specific descriptors independently

### With Recipe Loading System
- RecipeLoader validates against updated schema
- RecipeValidator processes bodyDescriptors
- Error handling for invalid descriptors

## Risk Assessment

**Low Risk** - Additive schema enhancement:
- Only adds optional field
- Maintains all existing recipe structure
- Clear validation prevents invalid data
- Backward compatible with existing recipes

## Success Criteria

1. **Schema Enhancement**:
   - bodyDescriptors field added and validated
   - Enum constraints properly enforced
   - Additional properties rejected

2. **Backward Compatibility**:
   - All existing recipes continue to validate
   - Recipe loading system unaffected
   - No breaking changes to recipe format

3. **Integration Readiness**:
   - Schema supports AnatomyGenerationWorkflow integration
   - Consistent with body component schema
   - Ready for implementation workflows

## Next Steps

After completion:
- BODDESCMIG-003: Update sample recipes and validation
- BODDESCMIG-004: Modify AnatomyGenerationWorkflow

## Notes

- bodyDescriptors is completely optional for backward compatibility
- Descriptor values must match body component schema exactly
- Part-specific descriptors in slots remain unchanged
- Schema follows project's validation patterns
- Supports both complete and partial descriptor definitions