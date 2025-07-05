name: "Fix Missing humanoid_leg.entity.json and Add Foot Support"
description: |

## Purpose
Fix failing tests caused by removal of humanoid_leg.entity.json by creating a generic human leg entity and implementing foot support in the anatomy system.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Replace the removed humanoid_leg.entity.json with a generic human_leg.entity.json and implement foot support in the anatomy system to fix 5 failing test suites.

## Why
- **Immediate Need**: 5 test suites are failing due to missing humanoid_leg.entity.json import
- **System Completeness**: The anatomy formatting already expects "foot" as a body part type but no foot entity exists
- **Consistency**: Arms have hands, legs should have feet

## What
1. Create a generic human_leg.entity.json to replace humanoid_leg references in tests
2. Add ankle socket to both human_leg.entity.json and human_leg_shapely.entity.json
3. Create human_foot.entity.json body part entity
4. Update human_male.blueprint.json and human_female.blueprint.json to include foot slots

### Success Criteria
- [x] All 5 failing tests pass after changes
- [x] human_leg.entity.json exists and is imported by tests
- [x] Both leg entities have ankle sockets for foot attachment
- [x] human_foot.entity.json exists as a proper body part
- [x] Blueprints include left_foot and right_foot slots

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: data/mods/anatomy/components/sockets.component.json
  why: Defines the exact schema for socket components - required fields are id and allowedTypes
  
- file: data/mods/anatomy/entities/definitions/humanoid_arm.entity.json
  why: Shows socket pattern - wrist socket allows "hand" type, uses nameTpl "{{parent.name}} {{type}}"
  
- file: data/mods/anatomy/entities/definitions/human_hand.entity.json
  why: Terminal body part pattern - no sockets needed for foot entity
  
- file: data/mods/anatomy/entities/definitions/human_male_torso.entity.json
  why: Complex socket example showing orientation usage and multiple sockets

- file: data/mods/anatomy/blueprints/human_male.blueprint.json
  why: Shows hand slot pattern - parent: "left_arm", socket: "wrist", partType: "hand"

- file: data/mods/anatomy/anatomy-formatting/default.json
  why: Confirms "foot" is expected - listed in descriptionOrder, pairedParts, and has irregular plural "feet"
```

### Failing Test Files
These 5 test files import humanoid_leg.entity.json and need to be updated:
1. tests/integration/anatomy/gorgeousMilfGeneration.integration.test.js
2. tests/integration/anatomy/humanFemaleBodyGraph.integration.test.js
3. tests/integration/anatomy/humanMaleBodyDescription.integration.test.js
4. tests/integration/anatomy/humanMaleBodyGraph.integration.test.js
5. tests/integration/domUI/AnatomyVisualizerUI.integration.test.js

### Socket Component Schema
```json
{
  "sockets": {
    "type": "array",
    "items": {
      "properties": {
        "id": {"type": "string"},
        "orientation": {"enum": ["left", "right", "mid", "upper", "lower", "front", "back"]},
        "allowedTypes": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        "nameTpl": {"type": "string"}
      },
      "required": ["id", "allowedTypes"]
    }
  }
}
```

### Known Gotchas
```javascript
// CRITICAL: Entity files must follow exact schema format
// CRITICAL: Socket orientation is optional but helps with naming
// CRITICAL: Tests import entity files directly - file names must match exactly
// CRITICAL: Blueprint slots need parent reference for non-torso attachments
```

## Implementation Blueprint

### Data models and structure

All entity files follow this structure:
```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "anatomy:entity_name",
  "description": "Description",
  "components": {
    "anatomy:part": {"subType": "partType"},
    "core:name": {"text": "displayName"}
  }
}
```

### List of tasks to be completed in order

```yaml
Task 1: Create human_foot.entity.json
CREATE data/mods/anatomy/entities/definitions/human_foot.entity.json:
  - MIRROR pattern from: human_hand.entity.json
  - Set subType to "foot"
  - No sockets needed (terminal body part)

Task 2: Update human_leg_shapely.entity.json
MODIFY data/mods/anatomy/entities/definitions/human_leg_shapely.entity.json:
  - ADD anatomy:sockets component after anatomy:part component
  - Socket id: "ankle", allowedTypes: ["foot"], nameTpl: "{{parent.name}} {{type}}"

Task 3: Create human_leg.entity.json
CREATE data/mods/anatomy/entities/definitions/human_leg.entity.json:
  - MIRROR pattern from: human_leg_shapely.entity.json
  - REMOVE descriptor components (length_category, build)
  - KEEP anatomy:sockets with ankle socket

Task 4: Update all 5 test files
MODIFY each test file:
  - FIND: import humanoidLeg from '../../../data/mods/anatomy/entities/definitions/humanoid_leg.entity.json';
  - REPLACE WITH: import humanoidLeg from '../../../data/mods/anatomy/entities/definitions/human_leg.entity.json';

Task 5: Update human_male.blueprint.json
MODIFY data/mods/anatomy/blueprints/human_male.blueprint.json:
  - ADD left_foot slot after right_hand slot
  - ADD right_foot slot after left_foot slot
  - Both with parent referencing leg slots, socket: "ankle"

Task 6: Update human_female.blueprint.json
MODIFY data/mods/anatomy/blueprints/human_female.blueprint.json:
  - ADD left_foot slot after right_hand slot
  - ADD right_foot slot after left_foot slot
  - Both with parent referencing leg slots, socket: "ankle"
```

### Per task pseudocode

#### Task 1: human_foot.entity.json
```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "anatomy:human_foot",
  "description": "A human foot",
  "components": {
    "anatomy:part": {
      "subType": "foot"
    },
    "core:name": {
      "text": "foot"
    }
  }
}
```

#### Task 2-3: Socket structure for legs
```json
"anatomy:sockets": {
  "sockets": [
    {
      "id": "ankle",
      "allowedTypes": ["foot"],
      "nameTpl": "{{parent.name}} {{type}}"
    }
  ]
}
```

#### Task 5-6: Blueprint slot structure
```json
"left_foot": {
  "parent": "left_leg",
  "socket": "ankle",
  "requirements": {
    "partType": "foot",
    "components": ["anatomy:part"]
  }
},
"right_foot": {
  "parent": "right_leg",
  "socket": "ankle",
  "requirements": {
    "partType": "foot",
    "components": ["anatomy:part"]
  }
}
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Check JSON syntax is valid
npm run lint

# Expected: No JSON syntax errors in modified files
```

### Level 2: Run Tests
```bash
# Run all tests to verify the 5 failing tests now pass
npm run test

# If still failing: 
# 1. Check exact import paths match
# 2. Verify entity IDs are correct
# 3. Ensure socket definitions match blueprint expectations
```

## Final validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors in modified files: `npm run lint`
- [ ] human_foot.entity.json created
- [ ] human_leg.entity.json created (generic version)
- [ ] human_leg_shapely.entity.json has ankle socket
- [ ] All 5 test imports updated
- [ ] Both blueprints have foot slots

---

## Anti-Patterns to Avoid
- ❌ Don't change the entity ID format - must be "anatomy:entity_name"
- ❌ Don't add sockets to terminal body parts like foot
- ❌ Don't forget to update both male and female blueprints
- ❌ Don't change test logic - only update imports
- ❌ Don't add unnecessary descriptor components to generic leg

## Confidence Score: 9/10
High confidence due to:
- Clear existing patterns to follow
- All necessary files identified
- Simple JSON modifications
- Direct test import replacements