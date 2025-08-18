# Body Descriptor Enhancement Specification

## Implementation Status

**Status**: PROPOSED - Additive Enhancement  
**Date**: 2025-08-18  
**Version**: 1.1.0  
**Author**: Architecture Team

## 1. Overview

### 1.1 Executive Summary

This specification defines the addition of optional body-level descriptors to the `anatomy:body` component that will be displayed as prefixes to existing part-level descriptions. This enhancement provides a convenient way to define overall body characteristics while preserving the flexibility of part-specific descriptors. The body-level descriptors will be purely additive to the description output and will not modify how part-level descriptors are displayed.

### 1.2 Current State

Currently, descriptors exist on individual body PART entities, not on the main entity:

```
Entity (e.g., "actor_123")
└── anatomy:body (component)
    └── body.parts
        ├── torso: "part_123_torso" → Entity with descriptors:build
        ├── arms: "part_124_arm" → Entity with descriptors:build
        └── legs: "part_125_leg" → Entity with descriptors:build
```

Example part entity (e.g., `human_male_torso_muscular`):
```
Part Entity
├── anatomy:part (component)
├── descriptors:build { build: "muscular" }
└── core:name { text: "torso" }
```

### 1.3 Proposed State

Optional body-level descriptors will be added to the `anatomy:body` component as overall characteristics, displayed BEFORE part descriptions:

```
Entity (e.g., "actor_123")
└── anatomy:body (component)
    ├── body.descriptors (NEW - optional overall characteristics)
    │   ├── build: "athletic"
    │   ├── density: "moderate"  // body hair
    │   ├── skinColor: "white"
    │   └── composition: "average"
    └── body.parts (UNCHANGED - parts still have their own descriptors)
        └── torso: "part_123_torso" → Entity with descriptors:build
```

Output format:
```
Skin color: white
Build: athletic
Body hair: moderate
Head: bearded face...
Torso: stocky, hairy...
```

### 1.4 Business Value

- **Convenience**: Easy way to set overall body characteristics
- **Flexibility Preserved**: Part-level descriptors continue to work unchanged
- **Additive Enhancement**: No breaking changes to existing content
- **Clear Hierarchy**: Body-level characteristics shown first, then part details
- **Cleaner Code**: Removes deprecated entity-level descriptor pattern

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: Descriptor Integration

- The `anatomy:body` component SHALL support an optional `descriptors` field within its `body` property
- The `descriptors` field SHALL contain body-level descriptor properties
- Each descriptor property SHALL be optional
- Descriptor values SHALL match existing enum definitions from current descriptor components

#### FR-2: Supported Body Descriptors

The following body-level descriptors SHALL be supported:

- `build`: Body build type (skinny, slim, toned, athletic, shapely, thick, muscular, stocky)
- `density`: Body hair density (hairless, sparse, light, moderate, hairy, very-hairy) - maps to "Body hair" in output
- `composition`: Body composition (underweight, lean, average, soft, chubby, overweight, obese)
- `skinColor`: Skin color (using basic color values or specific skin tones)

#### FR-3: Description Generation

- Body-level descriptors SHALL be displayed BEFORE part-level descriptions
- Description format SHALL be: `"[Label]: [value]"` (e.g., "Skin color: white")
- Each body descriptor SHALL appear on its own line
- Part-level descriptions SHALL remain unchanged in format and content
- The complete output SHALL be: body descriptors + existing part descriptions

#### FR-4: Recipe Support

- Anatomy recipes SHALL support a `bodyDescriptors` field at the root level
- Body descriptors in recipes SHALL be applied to the generated body component
- Part-specific descriptors SHALL remain on individual parts

### 2.2 Non-Functional Requirements

#### NFR-1: Backward Compatibility

- The system SHALL NOT support entity-level descriptors (deprecated pattern removed)
- Existing content without body descriptors SHALL continue to function normally
- Part-level descriptors SHALL continue to work exactly as before

#### NFR-2: Performance

- Descriptor access SHALL not add measurable overhead to description generation
- The new structure SHALL reduce the number of component lookups required

#### NFR-3: Data Integrity

- Descriptor values SHALL be validated against defined enums
- Invalid descriptor values SHALL be rejected during validation
- The system SHALL provide clear error messages for invalid descriptors

#### NFR-4: Maintainability

- The implementation SHALL follow existing project patterns
- Code changes SHALL maintain or improve test coverage (80%+ branches)
- The migration SHALL be reversible if issues are discovered

### 2.3 Constraints

- Must maintain compatibility with existing mod content
- Schema changes must be additive only (no breaking changes)
- Implementation must follow the project's ECS architecture
- All changes must be thoroughly tested before deployment

## 3. Technical Design

### 3.1 Schema Modifications

#### 3.1.1 Updated Body Component Schema

File: `data/mods/anatomy/components/body.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:body",
  "description": "Links an entity to an anatomy recipe and stores the generated body structure",
  "dataSchema": {
    "type": "object",
    "properties": {
      "recipeId": {
        "type": "string",
        "description": "The namespaced ID of the anatomy recipe to use",
        "pattern": "^[a-zA-Z][a-zA-Z0-9_]*:[a-zA-Z][a-zA-Z0-9_]*$"
      },
      "body": {
        "type": ["object", "null"],
        "description": "The generated anatomy structure with integrated descriptors",
        "properties": {
          "root": {
            "type": "string",
            "description": "Entity instance ID of the root body part"
          },
          "parts": {
            "type": "object",
            "description": "Map of part identifiers to entity instance IDs",
            "additionalProperties": {
              "type": "string"
            }
          },
          "descriptors": {
            "type": "object",
            "description": "Body-level descriptors that apply to the whole body",
            "properties": {
              "build": {
                "type": "string",
                "description": "Body build type",
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
                "description": "Body hair density (displayed as 'Body hair' in output)",
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
                "description": "Body composition type (displayed as 'Body composition' in output)",
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
                "type": "string",
                "description": "Skin color descriptor"
              }
            },
            "additionalProperties": false
          }
        },
        "required": ["root", "parts"],
        "additionalProperties": false
      }
    },
    "required": ["recipeId"],
    "additionalProperties": false
  }
}
```

#### 3.1.2 Recipe Schema Enhancement

Anatomy recipes will support body-level descriptors at the root level:

```json
{
  "recipeId": "anatomy:example_human",
  "bodyDescriptors": {
    "build": "athletic",
    "density": "moderate",
    "composition": "average",
    "skinColor": "white"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_male_torso_muscular",
      "properties": {
        // Part-specific descriptors remain here and work independently
        "descriptors:build": { "build": "muscular" }
      }
    }
  }
}
```

### 3.2 Component Architecture

```
┌─────────────────────────────────────┐
│        Entity (e.g., actor_123)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      anatomy:body Component         │
├─────────────────────────────────────┤
│ recipeId: "anatomy:human"           │
│ body: {                             │
│   root: "part_123_torso",          │
│   parts: { ... },                   │
│   descriptors: {                    │
│     build: "athletic",              │
│     density: "moderate",            │
│     composition: "average",         │
│     skinColor: "white"              │
│   }                                 │
│ }                                   │
└─────────────────────────────────────┘
```

### 3.3 Data Flow

```
Recipe Definition
    ↓ [includes bodyDescriptors]
AnatomyGenerationWorkflow
    ↓ [applies descriptors to body component]
Body Component with Descriptors
    ↓ [stored in entity]
BodyDescriptionComposer
    ↓ [reads descriptors from body.descriptors]
Generated Description Text
```

## 4. Implementation Guidelines

### 4.1 Phase 1: Schema Updates

#### Step 1.1: Update Body Component Schema

**File**: `data/mods/anatomy/components/body.component.json`

- Add optional `descriptors` field to the `body` property
- Define all body-level descriptor properties as optional
- Ensure backward compatibility by keeping existing structure

#### Step 1.2: Validate Schema Changes

- Test that existing body components without descriptors still validate
- Test that new structure with descriptors validates correctly
- Ensure invalid descriptor values are rejected

### 4.2 Phase 2: Recipe Format Updates

#### Step 2.1: Update Recipe Schema

**File**: `data/schemas/anatomy-recipe.schema.json`

- Add optional `bodyDescriptors` field at root level
- Define structure matching body component descriptors
- Maintain backward compatibility for existing recipes

#### Step 2.2: Update Sample Recipes

- Add `bodyDescriptors` examples to demonstrate usage
- Show both with and without body descriptors

### 4.3 Phase 3: Anatomy Generation Updates

#### Step 3.1: Modify AnatomyGenerationWorkflow

**File**: `src/anatomy/workflows/anatomyGenerationWorkflow.js`

```javascript
// In generateAnatomy method
_applyBodyDescriptors(bodyComponent, recipe) {
  if (!recipe.bodyDescriptors) {
    return bodyComponent;
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

#### Step 3.2: Add Validation

- Validate descriptor values against schema enums
- Handle missing or invalid descriptors gracefully
- Log warnings for deprecated entity-level descriptors

### 4.4 Phase 4: Description Composer Updates

#### Step 4.1: Update BodyDescriptionComposer

**File**: `src/anatomy/bodyDescriptionComposer.js`

```javascript
extractBuildDescription(bodyEntity) {
  const bodyComponent = bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
  
  // Only check body.descriptors - no entity-level fallback
  if (bodyComponent?.body?.descriptors?.build) {
    return bodyComponent.body.descriptors.build;
  }
  
  return '';
}

extractBodyHairDescription(bodyEntity) {
  const bodyComponent = bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
  
  // Only check body.descriptors.density - no entity-level fallback
  if (bodyComponent?.body?.descriptors?.density) {
    return bodyComponent.body.descriptors.density;
  }
  
  return '';
}

extractBodyCompositionDescription(bodyEntity) {
  const bodyComponent = bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
  
  // Only check body.descriptors.composition
  if (bodyComponent?.body?.descriptors?.composition) {
    return bodyComponent.body.descriptors.composition;
  }
  
  return '';
}

extractSkinColorDescription(bodyEntity) {
  const bodyComponent = bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
  
  // Only check body.descriptors.skinColor
  if (bodyComponent?.body?.descriptors?.skinColor) {
    return bodyComponent.body.descriptors.skinColor;
  }
  
  return '';
}

async composeDescription(bodyEntity) {
  // ... existing validation code ...
  
  const lines = [];
  
  // FIRST: Add body-level descriptors (new)
  const skinColor = this.extractSkinColorDescription(bodyEntity);
  if (skinColor) {
    lines.push(`Skin color: ${skinColor}`);
  }
  
  const build = this.extractBuildDescription(bodyEntity);
  if (build) {
    lines.push(`Build: ${build}`);
  }
  
  const bodyHair = this.extractBodyHairDescription(bodyEntity);
  if (bodyHair) {
    lines.push(`Body hair: ${bodyHair}`);
  }
  
  const composition = this.extractBodyCompositionDescription(bodyEntity);
  if (composition) {
    lines.push(`Body composition: ${composition}`);
  }
  
  // THEN: Add existing part-level descriptions (unchanged)
  // ... existing part description generation code ...
  
  return lines.join('\n');
}
```

### 4.5 Phase 5: Migration and Cleanup

#### Step 5.1: Content Migration

- Update existing recipes to use `bodyDescriptors`
- Remove body-level descriptors from part definitions
- Document changes for modders

#### Step 5.2: Cleanup

- Remove all entity-level descriptor support (no deprecation period)
- Provide migration guide for mod developers
- Set timeline for removing backward compatibility

#### Step 5.3: Final Cleanup

- Clean up any remaining references to entity-level descriptors
- Update all documentation
- Verify all tests pass

## 5. Testing Requirements

### 5.1 Unit Tests

#### Test Suite: Body Component Schema Validation

**File**: `tests/unit/anatomy/components/bodyComponent.test.js`

- Test valid body component with descriptors
- Test valid body component without descriptors
- Test invalid descriptor values are rejected
- Test additional properties are not allowed

#### Test Suite: BodyDescriptionComposer

**File**: `tests/unit/anatomy/services/BodyDescriptionComposer.test.js`

- Test extraction from new descriptor structure
- Test fallback to entity-level descriptors
- Test handling of missing descriptors
- Test generation of description text with all descriptors
- Test generation with partial descriptors

#### Test Suite: AnatomyGenerationWorkflow

**File**: `tests/unit/anatomy/workflows/AnatomyGenerationWorkflow.test.js`

- Test application of body descriptors from recipe
- Test generation without body descriptors
- Test validation of descriptor values
- Test error handling for invalid descriptors

### 5.2 Integration Tests

#### Test Suite: End-to-End Anatomy Generation

**File**: `tests/integration/anatomy/anatomyGeneration.test.js`

- Test complete flow from recipe to generated body with descriptors
- Test backward compatibility with existing recipes
- Test description generation from new structure
- Test migration path scenarios

#### Test Suite: Recipe Processing

**File**: `tests/integration/anatomy/recipeProcessing.test.js`

- Test loading recipes with body descriptors
- Test validation of recipe body descriptors
- Test application to generated anatomy

### 5.3 Test Data

Create test fixtures for:

- Recipe with all body descriptors
- Recipe with partial body descriptors
- Recipe without body descriptors (backward compatibility)
- Invalid descriptor values for validation testing

## 6. Migration Strategy

### 6.1 Rollout Phases

#### Phase 1: Schema Addition (Version 1.x)
- Deploy schema changes (purely additive)
- Support new body.descriptors structure
- No support for entity-level descriptors

#### Phase 2: Content Enhancement (Version 1.x+1)
- Update core mod recipes to use bodyDescriptors where appropriate
- Provide examples for modders
- Document new functionality

#### Phase 3: Finalization (Version 2.0)
- Complete documentation updates
- Performance optimizations
- Full testing coverage

### 6.2 Migration Guide for Modders

#### Before Enhancement:
```json
// Only part-level descriptors on individual parts
{
  "components": {
    "anatomy:body": { 
      "recipeId": "anatomy:human",
      "body": { "root": "part_123_torso", "parts": {"torso": "part_123_torso"} }
    }
  }
}
// Part entity (part_123_torso) has descriptors:build component
```

#### After Enhancement:
```json
// Body-level descriptors PLUS existing part descriptors
{
  "components": {
    "anatomy:body": {
      "recipeId": "anatomy:human",
      "body": {
        "root": "part_123_torso",
        "parts": {"torso": "part_123_torso"},
        "descriptors": {
          "build": "athletic",
          "density": "moderate",
          "skinColor": "olive"
        }
      }
    }
  }
}
// Part entities still have their own descriptors (unchanged)
```

### 6.3 Validation Checklist

- [ ] Schema changes are backward compatible
- [ ] Existing content continues to work
- [ ] New structure validates correctly
- [ ] Description generation works with both structures
- [ ] All tests pass (unit, integration, e2e)
- [ ] Performance metrics remain acceptable
- [ ] Documentation is updated
- [ ] Migration guide is available

## 7. Examples & Usage Patterns

### 7.1 Complete Body Component with Descriptors

```json
{
  "id": "anatomy:body",
  "data": {
    "recipeId": "anatomy:human_adult",
    "body": {
      "root": "part_123_torso",
      "parts": {
        "torso": "part_123_torso",
        "head": "part_124_head",
        "left_arm": "part_125_left_arm",
        "right_arm": "part_126_right_arm"
      },
      "descriptors": {
        "build": "athletic",
        "density": "moderate",
        "composition": "average",
        "skinColor": "olive"
      }
    }
  }
}
```

### 7.2 Recipe with Body Descriptors

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
      "properties": {
        "descriptors:size": { "size": "large" }
      }
    }
  }
}
```

### 7.3 Generated Description Output

With the new structure, the description generation would produce:

```
Skin color: olive
Build: athletic
Body hair: moderate
Head: bearded face with piercing blue eyes
Torso: well-proportioned, connecting to strong arms
Arms: muscular and defined
```

### 7.4 Partial Descriptors

Only specified descriptors appear in the description:

```json
{
  "descriptors": {
    "build": "slim",
    "skinColor": "pale"
  }
}
```

Output:
```
Skin color: pale
Build: slim
Head: youthful face...
Torso: slender...
```

## 8. Performance Considerations

### 8.1 Optimization Opportunities

- **Reduced Component Lookups**: Single component access instead of multiple
- **Cached Descriptor Access**: Store descriptors reference for repeated use
- **Lazy Loading**: Only process descriptors when description is needed

### 8.2 Performance Metrics

- Descriptor access time: <1ms
- Description generation: <5ms for complete body
- Memory overhead: Negligible (few string properties)

## 9. Security Considerations

### 9.1 Input Validation

- All descriptor values must match defined enums
- Reject any unexpected properties in descriptors object
- Sanitize descriptor values before use in descriptions

### 9.2 Data Integrity

- Descriptors are immutable once set
- Changes require complete component update
- Validation at multiple levels (schema, runtime, output)

## 10. Future Enhancements

### 10.1 Potential Extensions

1. **Dynamic Descriptors**: Descriptors that change based on conditions
2. **Composite Descriptors**: Combine multiple descriptors for richer descriptions
3. **Localized Descriptors**: Support for multiple languages
4. **Conditional Visibility**: Show/hide descriptors based on observer perspective
5. **Custom Descriptor Types**: Allow mods to define new descriptor categories

### 10.2 Long-term Vision

The descriptor system could evolve into a more sophisticated appearance system that:
- Supports gradual changes over time
- Integrates with equipment and clothing systems
- Provides hooks for AI-generated descriptions
- Enables player customization interfaces

## 11. Success Criteria

The implementation will be considered successful when:

1. **Functionality**:
   - Body descriptors can be defined in body component
   - Descriptions generate correctly from new structure
   - Backward compatibility is maintained

2. **Quality**:
   - All tests pass with 80%+ coverage
   - No performance degradation
   - Clean, maintainable code

3. **Documentation**:
   - Technical documentation updated
   - Migration guide available
   - Examples provided for modders

4. **Migration**:
   - Core content migrated successfully
   - Clear deprecation timeline communicated
   - Smooth transition for existing mods

## 12. Risk Assessment

### 12.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing mods | Low | High | Dual support period, extensive testing |
| Performance regression | Low | Medium | Performance testing, optimization |
| Complex migration | Medium | Medium | Clear guides, migration tools |
| Incomplete adoption | Medium | Low | Deprecation warnings, benefits documentation |

### 12.2 Contingency Plans

- **Rollback Strategy**: Revert schema changes if critical issues found
- **Extended Support**: Extend dual support period if migration is slow
- **Gradual Deprecation**: Phase out old structure more slowly if needed

## 13. Dependencies

### 13.1 Technical Dependencies

- AJV schema validator (existing)
- Entity Component System (existing)
- Description generation system (existing)

### 13.2 Content Dependencies

- Existing anatomy recipes
- Descriptor component definitions
- Description templates

## 14. Timeline

### Estimated Development Time

- **Phase 1 (Schema Enhancement)**: 1-2 days
- **Phase 2 (Recipe Updates)**: 1-2 days
- **Phase 3 (Generation Logic)**: 2-3 days
- **Phase 4 (Description Composer)**: 2-3 days
- **Phase 5 (Entity-Level Cleanup)**: 1-2 days
- **Testing Updates**: 2-3 days
- **Documentation**: 1-2 days

**Total**: 10-17 days (reduced due to additive nature)

## 15. Appendices

### Appendix A: Current Descriptor Components

The following descriptor components are currently used at part level and will have body-level equivalents added:

- `descriptors:build` - Body build types (property: `build`)
- `descriptors:body_hair` - Body hair density (property: `density`)
- `descriptors:body_composition` - Body composition types (property: `composition`)
- `descriptors:color_basic` - Basic color descriptors (body-level: `skinColor`)

### Appendix B: Glossary

- **Body-level descriptors**: Properties in anatomy:body component describing overall characteristics
- **Part-specific descriptors**: Properties that describe individual body parts (unchanged)
- **Entity-level descriptors**: Deprecated pattern (being removed)
- **ECS**: Entity Component System architecture
- **Additive Enhancement**: New features that don't break existing functionality

### Appendix C: References

- Architecture Report: `reports/descriptor-system-architecture-report.md`
- Body Component: `data/mods/anatomy/components/body.component.json`
- Description Composer: `src/anatomy/services/BodyDescriptionComposer.js`

---

**Document Status**: CORRECTED - Aligned with Codebase
**Approval Status**: Ready for Implementation  
**Target Release**: Version 1.2.0 (additive feature)  
**Last Updated**: 2025-08-18