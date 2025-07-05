name: "Iker Aguirre Anatomy Recipe Implementation"
description: |

## Purpose
Create an anatomy recipe for character Iker Aguirre with muscular torso, arms, and legs using the existing anatomy system and descriptor components.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Create an anatomy recipe for `.private/data/mods/p_erotica/iker_aguirre.character.json` that specifies muscular torso, arms, and legs. The recipe should be stored in `.private/data/mods/p_erotica/recipes/` and follow the pattern of the existing `amaia_castillo.recipe.json`.

## Why
- Enables character-specific anatomy customization for Iker Aguirre
- Demonstrates the flexibility of the anatomy recipe system
- Provides a muscular male character variant in the p_erotica mod

## What
Create a recipe that:
- References the `anatomy:human_male` blueprint
- Overrides torso, arms, and legs to have "muscular" descriptor
- Uses the existing `descriptors:build` component with value "muscular"
- Creates new entity definitions for muscular variants if needed

### Success Criteria
- [ ] Recipe file created at `.private/data/mods/p_erotica/recipes/iker_aguirre.recipe.json`
- [ ] New muscular entity definitions created if needed
- [ ] All existing anatomy tests continue to pass
- [ ] Recipe can be loaded and generates anatomy with muscular descriptors

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: .private/data/mods/p_erotica/recipes/amaia_castillo.recipe.json
  why: Example recipe pattern to follow, shows slot and pattern usage
  
- file: data/schemas/anatomy.recipe.schema.json
  why: Recipe schema showing all valid properties and structure
  
- file: data/mods/descriptors/components/build.component.json
  why: Contains "muscular" as valid enum value for build descriptor
  
- file: data/mods/anatomy/entities/definitions/human_male_torso.entity.json
  why: Base male torso entity to understand structure
  
- file: data/mods/anatomy/entities/definitions/humanoid_arm.entity.json
  why: Base arm entity structure
  
- file: data/mods/anatomy/entities/definitions/human_leg.entity.json
  why: Base leg entity structure

- file: tests/integration/anatomy/torsoOverrideIntegration.test.js
  why: Shows pattern for testing recipe overrides
  
- file: tests/integration/anatomy/gorgeousMilfGeneration.integration.test.js
  why: Shows recipe with descriptor properties pattern
```

### Current Codebase Structure
```bash
.private/data/mods/p_erotica/
├── recipes/
│   └── amaia_castillo.recipe.json  # Existing recipe example
└── iker_aguirre.character.json     # Target character

data/mods/
├── anatomy/
│   ├── entities/
│   │   └── definitions/
│   │       ├── human_male_torso.entity.json
│   │       ├── humanoid_arm.entity.json
│   │       └── human_leg.entity.json
│   └── blueprints/
│       └── human_male.blueprint.json
└── descriptors/
    └── components/
        └── build.component.json  # Contains "muscular" enum value
```

### Desired Codebase Structure
```bash
.private/data/mods/p_erotica/
├── recipes/
│   ├── amaia_castillo.recipe.json
│   └── iker_aguirre.recipe.json    # NEW: Recipe for Iker

data/mods/anatomy/entities/definitions/
├── human_male_torso.entity.json
├── human_male_torso_muscular.entity.json  # NEW: Muscular variant
├── humanoid_arm.entity.json
├── humanoid_arm_muscular.entity.json      # NEW: Muscular variant
├── human_leg.entity.json
└── human_leg_muscular.entity.json         # NEW: Muscular variant
```

### Known Gotchas & Patterns
```javascript
// CRITICAL: Descriptor components use namespaced format
// Example: "descriptors:build" not just "build"

// PATTERN: Recipes can either:
// 1. Use preferId to specify exact entity (if muscular variants exist)
// 2. Use properties to add/override components on base entities

// GOTCHA: The anatomy system validates that referenced entities exist
// Must create entity definitions before referencing in recipe

// PATTERN: Entity definitions follow strict structure:
// - Must have "anatomy:part" component with partType
// - Must have "anatomy:sockets" for connection points
// - Must have "core:name" for display
```

## Implementation Blueprint

### Data Models and Structure

1. **Entity Definition Structure** (for muscular variants):
```json
{
  "entityId": "anatomy:human_male_torso_muscular",
  "components": {
    "anatomy:part": { "partType": "torso" },
    "anatomy:sockets": { /* copy from base */ },
    "core:name": { "name": "muscular torso" },
    "descriptors:build": { "build": "muscular" }
  }
}
```

2. **Recipe Structure**:
```json
{
  "recipeId": "p_erotica:iker_aguirre",
  "blueprintId": "anatomy:human_male",
  "slots": {
    "torso": {
      "partType": "torso",
      "properties": {
        "descriptors:build": { "build": "muscular" }
      }
    }
  },
  "patterns": [
    {
      "pattern": "arm_*",
      "config": {
        "partType": "arm",
        "properties": {
          "descriptors:build": { "build": "muscular" }
        }
      }
    },
    {
      "pattern": "leg_*", 
      "config": {
        "partType": "leg",
        "properties": {
          "descriptors:build": { "build": "muscular" }
        }
      }
    }
  ]
}
```

### List of Tasks to Complete

```yaml
Task 1: Analyze existing patterns and decide implementation approach
  - Read gorgeous_milf.recipe.json to see properties usage pattern
  - Determine if using properties or creating new entities is better
  - Decision: Use properties approach (simpler, follows existing patterns)

Task 2: Create the recipe file
CREATE .private/data/mods/p_erotica/recipes/iker_aguirre.recipe.json:
  - MIRROR pattern from: amaia_castillo.recipe.json
  - MODIFY to use properties for muscular build descriptor
  - USE patterns for arms and legs (left/right pairs)

Task 3: Create muscular entity variants (if properties approach doesn't work)
CREATE data/mods/anatomy/entities/definitions/human_male_torso_muscular.entity.json:
  - COPY from: human_male_torso.entity.json
  - ADD component: "descriptors:build": { "build": "muscular" }
  - MODIFY core:name to "muscular torso"

CREATE data/mods/anatomy/entities/definitions/humanoid_arm_muscular.entity.json:
  - COPY from: humanoid_arm.entity.json
  - ADD component: "descriptors:build": { "build": "muscular" }
  - MODIFY core:name to "muscular arm"

CREATE data/mods/anatomy/entities/definitions/human_leg_muscular.entity.json:
  - COPY from: human_leg.entity.json
  - ADD component: "descriptors:build": { "build": "muscular" }
  - MODIFY core:name to "muscular leg"

Task 4: Test the implementation
  - Run existing anatomy tests to ensure no regression
  - Manually verify recipe loads and generates expected anatomy
```

### Implementation Approach Decision Tree

```
1. First try: Use properties in recipe (simpler approach)
   └─ If validation fails because entities need build descriptor pre-defined:
      └─ Then: Create muscular entity variants (Task 3)
         └─ Update recipe to use preferId instead of properties
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors in the files you've modified
npm run lint

# Expected: No errors in JSON files or any modified code
```

### Level 2: Schema Validation
```bash
# Validate JSON files against schemas
# The anatomy system will validate on load, but we can check manually:
# - Recipe must match anatomy.recipe.schema.json
# - Entity definitions must match entity-definition.schema.json
```

### Level 3: Integration Tests
```bash
# Run all anatomy tests to ensure no regression:
npm run test -- tests/integration/anatomy/

# If failing: Read error, check if recipe/entity references are correct
# Common issues:
# - Missing required components in entity definitions
# - Incorrect component namespacing (use "descriptors:build" not "build")
# - Recipe referencing non-existent entities
```

### Level 4: Manual Verification
```javascript
// Create a test to verify the recipe generates expected anatomy:
// 1. Load the recipe
// 2. Generate anatomy for an entity using the recipe
// 3. Verify torso, arms, and legs have "descriptors:build" with "muscular"
```

## Final Validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] Recipe file validates against schema
- [ ] Entity definitions (if created) validate against schema
- [ ] Generated anatomy has muscular descriptors on torso, arms, and legs
- [ ] No regression in existing anatomy functionality

---

## Anti-Patterns to Avoid
- ❌ Don't modify existing entity definitions - create new variants
- ❌ Don't skip the properties approach - try it first before creating entities
- ❌ Don't forget to namespace components (descriptors:build, not build)
- ❌ Don't create entities without all required components
- ❌ Don't use invalid descriptor values not in the enum

## URLs for Additional Context
- Anatomy System Documentation: Search for "ECS anatomy system" patterns
- Component-based Entity Systems: https://en.wikipedia.org/wiki/Entity_component_system
- JSON Schema Validation: https://json-schema.org/understanding-json-schema/

## Confidence Score
**8/10** - High confidence in successful one-pass implementation

The task is well-defined with clear examples to follow. The main uncertainty is whether the properties approach will work or if new entity definitions are needed. The implementation blueprint provides both paths with clear fallback strategy.