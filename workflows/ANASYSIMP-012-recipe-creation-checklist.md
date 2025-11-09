# ANASYSIMP-012: Recipe Creation Checklist Documentation

**Phase:** 1 (Quick Wins)
**Priority:** P1
**Effort:** Low (1 day)
**Impact:** Medium - Reduces trial-and-error
**Status:** Not Started

## Context

No step-by-step guide exists for recipe creation, leading to repeated mistakes and missed requirements.

## Solution Overview

Create comprehensive checklist document at `docs/anatomy/recipe-creation-checklist.md` covering:

1. **Before You Start**
   - Choose or create blueprint (V1 or V2)
   - For V2 blueprints: Identify or create structure template
   - List all part types needed
   - Check component availability (reuse existing when possible)
   - Review Body Descriptor Registry for valid body descriptors

2. **Step 1: Review/Create Component Schemas** (if needed)
   - Check if required components already exist in `data/mods/anatomy/components/`
   - If creating new: Define component schema file with dataSchema properties
   - Add to appropriate mod folder
   - Validate schema with `npm run validate`

3. **Step 2: Review/Create Entity Definitions**
   - Check if required part entities exist in `data/mods/anatomy/entities/definitions/`
   - If creating new entity definition files:
     - Add anatomy:part component with correct subType
     - Add descriptor components as needed (e.g., descriptors:texture, descriptors:body_hair)
     - Add core:name component
   - Validate entities with `npm run validate`

4. **Step 3: Create or Update Blueprint**
   - **For V1 Blueprints** (schemaVersion: "1.0" or omitted):
     - Define root entity reference
     - Define explicit slots with socket IDs and requirements
     - Add clothingSlotMappings if needed
   - **For V2 Blueprints** (schemaVersion: "2.0"):
     - Define root entity reference
     - Specify structureTemplate ID
     - Add additionalSlots only for parts beyond template generation
     - Add clothingSlotMappings if needed
   - Verify socket/slot compatibility with structure template
   - Validate blueprint with `npm run validate`

5. **Step 4: Create Recipe**
   - Define recipeId and blueprintId (must reference existing blueprint)
   - Add bodyDescriptors (optional, but validated against Body Descriptor Registry)
     - Use only descriptors from `src/anatomy/registries/bodyDescriptorRegistry.js`
     - Validate with `npm run validate:body-descriptors`
   - Configure explicit slots object (required, can be empty `{}`)
   - Add pattern matchers in patterns array (optional, for multi-slot configuration)
     - Use matchesGroup for template-generated limb sets/appendages
     - Use matchesPattern for wildcard matching
     - Use matchesAll for property-based filtering
   - Add constraints if needed (optional: requires/excludes)
   - Add clothingEntities if needed (optional)
   - Validate recipe with `npm run validate`

6. **Step 5: Test**
   - Load in anatomy visualizer (`/anatomy-visualizer.html`)
   - Verify graph generates without errors
   - Check anatomy description formatting
   - Validate all expected parts appear
   - Verify body descriptors display correctly

7. **Common Pitfalls**
   - Forgetting descriptor components on entity definitions
   - Using invalid body descriptor values (not in registry enum)
   - V2 blueprints: Missing sockets in structure template
   - Pattern mismatches between recipe and generated slots
   - Mixing V1 and V2 blueprint features
   - Empty slots object (must be present, use `{}` if no explicit slots)
   - Not validating with CLI tools before testing

## File Structure

```
docs/anatomy/
└── recipe-creation-checklist.md    # Main checklist
```

## Acceptance Criteria

- [ ] Checklist covers all steps from planning to testing
- [ ] Clearly distinguishes V1 vs V2 blueprint approaches
- [ ] Documents Body Descriptor Registry as source of truth
- [ ] Includes checkbox format for easy tracking
- [ ] Lists common pitfalls with solutions and prevention
- [ ] Provides examples for each step with actual file references
- [ ] References all validation tools (npm run validate, validate:body-descriptors)
- [ ] Links to related documentation (anatomy-system-guide.md, blueprints-and-templates.md, etc.)
- [ ] Clarifies when to create new vs reuse existing components/entities
- [ ] Documents required vs optional recipe fields

## Dependencies

**Depends On:** ANASYSIMP-001 through ANASYSIMP-009 (references validation tools)

## References

### Report
- **Report Section:** Recommendation 3.1
- **Report Pages:** Lines 898-965

### Anatomy Documentation
- `docs/anatomy/anatomy-system-guide.md` - Overall system architecture
- `docs/anatomy/blueprints-and-templates.md` - Blueprint V1 vs V2, structure templates
- `docs/anatomy/recipe-pattern-matching.md` - Pattern matching reference
- `docs/anatomy/body-descriptors-complete.md` - Body Descriptor Registry

### Key Files
- Body Descriptor Registry: `src/anatomy/registries/bodyDescriptorRegistry.js`
- Recipe Schema: `data/schemas/anatomy.recipe.schema.json`
- Blueprint Schema: `data/schemas/anatomy.blueprint.schema.json`
- Component Schema: `data/schemas/component.schema.json`
- Entity Definition Schema: `data/schemas/entity-definition.schema.json`

### Example Files
- Example Recipe: `data/mods/anatomy/recipes/giant_forest_spider.recipe.json`
- Example V2 Blueprint: `data/mods/anatomy/blueprints/giant_spider.blueprint.json`
- Example Structure Template: `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json`
- Example Entity: `data/mods/anatomy/entities/definitions/spider_leg.entity.json`
- Example Component: `data/mods/anatomy/components/part.component.json`
