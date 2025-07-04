name: "Anatomy System Fixes - Pubic Hair Part Type & Recipe Override Property Matching"
description: |

## Purpose
Fix two critical issues in the anatomy system:
1. Pubic hair socket using wrong part type causing inappropriate hair selection
2. Recipe override property matching bug preventing proper entity selection

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Fix the anatomy system to properly handle pubic hair as a distinct part type and ensure recipe overrides correctly match entities with required properties.

## Why
- **Problem 1**: Pubic hair currently uses partType "hair" causing inappropriate hair selections (long wavy hair for pubic areas)
- **Problem 2**: Recipe overrides fail to select entities that have required properties plus additional properties
- **User Impact**: Anatomy generation produces unrealistic body configurations
- **System Impact**: Undermines the precision of the anatomy system's entity selection

## What
**Issue 1 - Pubic Hair Part Type:**
- Change pubic_hair socket from partType "hair" to "pubic_hair" in both human blueprints
- Create dedicated human_pubic_hair.entity.json with appropriate descriptors
- Ensure pubic hair entities are properly categorized and selected

**Issue 2 - Recipe Override Property Matching:**
- Fix PartSelectionService.#matchesProperties() to use subset matching instead of exact matching
- Allow entities with additional properties to be selected if they contain ALL required properties
- Maintain backward compatibility with existing recipes

### Success Criteria
- [ ] Pubic hair socket uses partType "pubic_hair" in both human blueprints
- [ ] New human_pubic_hair.entity.json exists with "curly" hair style
- [ ] Recipe property matching allows entities with additional properties
- [ ] All existing tests pass
- [ ] New tests validate both fixes
- [ ] npm run test passes completely

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: /home/joeloverbeck/projects/living-narrative-engine/data/mods/anatomy/blueprints/human_female.blueprint.json
  why: Shows current pubic_hair socket definition using partType "hair" (line 97-104)
  
- file: /home/joeloverbeck/projects/living-narrative-engine/data/mods/anatomy/blueprints/human_male.blueprint.json
  why: Shows current pubic_hair socket definition using partType "hair" (line 97-104)
  
- file: /home/joeloverbeck/projects/living-narrative-engine/.private/data/mods/p_erotica/recipes/amaia_castillo.recipe.json
  why: Example recipe with property overrides that demonstrate the matching bug (scalp slot lines 41-54)

- file: /home/joeloverbeck/projects/living-narrative-engine/src/anatomy/partSelectionService.js
  why: Contains the buggy #matchesProperties() method that needs fixing
  critical: Current implementation uses exact matching instead of subset matching

- file: /home/joeloverbeck/projects/living-narrative-engine/data/mods/descriptors/components/hair_style.component.json
  why: Already contains "curly" hair style option for pubic hair entity
  
- file: /home/joeloverbeck/projects/living-narrative-engine/data/schemas/entity-definition.schema.json
  why: Schema for creating new pubic hair entity definition
  
- file: /home/joeloverbeck/projects/living-narrative-engine/data/schemas/anatomy.blueprint.schema.json
  why: Schema validation for blueprint changes
  
- file: /home/joeloverbeck/projects/living-narrative-engine/tests/integration/anatomy/
  why: Integration tests that validate anatomy system behavior - use these patterns for new tests
```

### Current Codebase Structure
```bash
/home/joeloverbeck/projects/living-narrative-engine/
├── data/
│   ├── mods/
│   │   ├── anatomy/
│   │   │   ├── blueprints/
│   │   │   │   ├── human_female.blueprint.json  # NEEDS MODIFICATION
│   │   │   │   └── human_male.blueprint.json    # NEEDS MODIFICATION
│   │   │   └── entities/
│   │   │       └── definitions/
│   │   │           └── [existing hair entities]  # REFERENCE FOR NEW ENTITY
│   │   └── descriptors/
│   │       └── components/
│   │           └── hair_style.component.json     # ALREADY HAS "curly"
│   └── schemas/
│       ├── anatomy.blueprint.schema.json
│       └── entity-definition.schema.json
├── src/
│   └── anatomy/
│       └── partSelectionService.js              # NEEDS BUG FIX
└── tests/
    └── integration/
        └── anatomy/                              # REFERENCE FOR TEST PATTERNS
```

### Desired Codebase Structure After Changes
```bash
/home/joeloverbeck/projects/living-narrative-engine/
├── data/
│   └── mods/
│       └── anatomy/
│           └── entities/
│               └── definitions/
│                   └── human_pubic_hair.entity.json  # NEW FILE
└── tests/
    └── integration/
        └── anatomy/
            ├── pubic_hair_part_type.test.js         # NEW TEST FILE
            └── recipe_property_matching.test.js     # NEW TEST FILE
```

### Known Gotchas & Library Quirks
```javascript
// CRITICAL: Entity selection property matching bug
// Current implementation in PartSelectionService.#matchesProperties()
// Uses strict equality which fails when entity has additional properties
// Example: Recipe requires { "color": "blonde" } but entity has { "color": "blonde", "intensity": "bright" }
// This causes perfectly valid entities to be rejected

// CRITICAL: Part type naming convention
// All part types use lowercase with underscores: "pubic_hair", "hair", "eye", etc.
// Socket names must match part types for proper selection

// CRITICAL: Entity ID naming convention
// Entity IDs follow pattern: "anatomy:human_[part_type]" or "anatomy:humanoid_[part_type]"
// Use "anatomy:human_pubic_hair" for new entity ID
```

## Implementation Blueprint

### Data Models and Structure
Entity definitions follow this structure:
```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "anatomy:entity_name",
  "description": "Human-readable description",
  "components": {
    "anatomy:part": {
      "subType": "part_type_name"
    },
    "descriptors:component_name": {
      "property": "value"
    },
    "core:name": {
      "text": "display_name"
    }
  }
}
```

### List of Tasks to Complete (in order)

```yaml
Task 1: Create New Pubic Hair Entity Definition
CREATE data/mods/anatomy/entities/definitions/human_pubic_hair.entity.json:
  - MIRROR pattern from: data/mods/anatomy/entities/definitions/human_hair.entity.json
  - MODIFY subType to "pubic_hair"
  - SET hair_style component to "curly"
  - USE appropriate color and length components
  - FOLLOW entity ID naming convention: "anatomy:human_pubic_hair"

Task 2: Update Human Female Blueprint
MODIFY data/mods/anatomy/blueprints/human_female.blueprint.json:
  - FIND: "pubic_hair" slot definition (lines 97-104)
  - CHANGE: "partType": "hair" to "partType": "pubic_hair"
  - KEEP all other properties identical

Task 3: Update Human Male Blueprint  
MODIFY data/mods/anatomy/blueprints/human_male.blueprint.json:
  - FIND: "pubic_hair" slot definition (lines 97-104)
  - CHANGE: "partType": "hair" to "partType": "pubic_hair"  
  - KEEP all other properties identical

Task 4: Fix Recipe Property Matching Bug
MODIFY src/anatomy/partSelectionService.js:
  - FIND: #matchesProperties() method (around line 234-246)
  - CHANGE: from exact object matching to subset matching
  - ENSURE: ALL required properties are present and match
  - ALLOW: entities to have additional properties not specified in recipe

Task 5: Create Integration Tests for Pubic Hair
CREATE tests/integration/anatomy/pubic_hair_part_type.test.js:
  - MIRROR pattern from: existing anatomy integration tests
  - TEST: pubic hair entity selection with new part type
  - VERIFY: only pubic_hair entities selected for pubic_hair sockets
  - VERIFY: regular hair entities not selected for pubic_hair sockets

Task 6: Create Integration Tests for Recipe Property Matching
CREATE tests/integration/anatomy/recipe_property_matching.test.js:
  - MIRROR pattern from: existing anatomy integration tests
  - TEST: recipe with multiple properties selects entities with ALL properties
  - TEST: recipe with partial properties selects entities with additional properties
  - VERIFY: backward compatibility maintained

Task 7: Update Existing Tests If Needed
ANALYZE tests/integration/anatomy/:
  - CHECK: if any existing tests explicitly test pubic hair behavior
  - UPDATE: any tests that might be affected by part type change
  - ENSURE: all existing tests continue to pass
```

### Task 1 Pseudocode: Create Pubic Hair Entity
```javascript
// NEW FILE: data/mods/anatomy/entities/definitions/human_pubic_hair.entity.json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "anatomy:human_pubic_hair",
  "description": "Human pubic hair with curly texture",
  "components": {
    "anatomy:part": {
      "subType": "pubic_hair"  // CRITICAL: Use new part type
    },
    "descriptors:hair_style": {
      "style": "curly"  // CRITICAL: Use curly as specified
    },
    "descriptors:color_basic": {
      "color": "brown"  // Default color
    },
    "descriptors:length_hair": {
      "length": "short"  // Appropriate for pubic hair
    },
    "core:name": {
      "text": "pubic hair"
    }
  }
}
```

### Task 4 Pseudocode: Fix Property Matching Bug
```javascript
// MODIFY: src/anatomy/partSelectionService.js
// FIND: #matchesProperties() method around line 234-246
// CHANGE FROM:
#matchesProperties(entityDef, propertyRequirements) {
  for (const [componentId, requiredProps] of Object.entries(propertyRequirements)) {
    const component = entityDef.components[componentId];
    if (!component) return false;
    
    // PROBLEM: This checks if objects are exactly equal
    if (JSON.stringify(component) !== JSON.stringify(requiredProps)) {
      return false;  // Fails if entity has additional properties
    }
  }
  return true;
}

// CHANGE TO:
#matchesProperties(entityDef, propertyRequirements) {
  for (const [componentId, requiredProps] of Object.entries(propertyRequirements)) {
    const component = entityDef.components[componentId];
    if (!component) return false;
    
    // SOLUTION: Check that ALL required properties are present and match
    for (const [propKey, propValue] of Object.entries(requiredProps)) {
      if (component[propKey] !== propValue) {
        return false;
      }
    }
    // Allow entity to have additional properties not specified in recipe
  }
  return true;
}
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint

# Expected: No errors in modified files. If errors, read and fix.
```

### Level 2: Unit Tests
```bash
# Run and iterate until passing:
npm run test

# Focus on these test suites:
npm run test -- tests/integration/anatomy/

# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Specific Validation for This Feature
```bash
# Test anatomy system specifically
npm run test -- tests/integration/anatomy/pubic_hair_part_type.test.js
npm run test -- tests/integration/anatomy/recipe_property_matching.test.js

# Test the amaia_castillo recipe to verify fix
npm run test -- tests/integration/anatomy/ --grep "amaia_castillo"
```

## Final Validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] Pubic hair entities use correct part type
- [ ] Recipe property matching works with additional properties
- [ ] Existing anatomy functionality unchanged
- [ ] New integration tests validate both fixes
- [ ] Documentation updated if needed

---

## Anti-Patterns to Avoid
- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation because "it should work"
- ❌ Don't ignore failing tests - fix them
- ❌ Don't modify existing hair entities - create new ones
- ❌ Don't break backward compatibility
- ❌ Don't use hardcoded values in tests

## Score: 9/10
**Confidence Level**: Very High - All necessary context provided, clear implementation path, comprehensive validation gates, and detailed references to existing patterns.