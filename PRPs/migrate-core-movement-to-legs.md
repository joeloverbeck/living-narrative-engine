name: "Migrate core:movement Component to Body Parts"
description: |

## Purpose
Migrate the `core:movement` component from character entities to their body parts (specifically legs) using the existing custom JSON Logic operator `hasPartWithComponentValue` for prerequisite evaluation.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Migrate movement capability checks from character-level components to body-part-level components, enabling the anatomy system to control movement through body parts (legs) rather than character entities.

## Why
- **Anatomical Realism**: Movement should depend on functioning legs, not character state
- **System Integration**: Leverages the existing anatomy system for more realistic simulation
- **Future Extensibility**: Sets pattern for migrating other capabilities (stamina, strength) to appropriate body parts
- **Existing Infrastructure**: The `hasPartWithComponentValue` operator is already implemented and tested

## What
- Move `core:movement` component from character entities to leg entities
- Create new condition using existing `hasPartWithComponentValue` operator
- Update all actions that check movement capability
- Ensure backward compatibility during migration

### Success Criteria
- [ ] All movement-based actions work with leg-based movement components
- [ ] No character entities have `core:movement` component
- [ ] All leg entities have `core:movement` component
- [ ] All existing tests pass
- [ ] New tests verify the migration

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: /home/joeloverbeck/projects/living-narrative-engine/docs/json-logic/json-logic for modders.md
  why: Complete JSON Logic documentation including custom operators
  
- file: /home/joeloverbeck/projects/living-narrative-engine/src/logic/jsonLogicCustomOperators.js
  why: Shows existing hasPartWithComponentValue implementation pattern
  
- file: /home/joeloverbeck/projects/living-narrative-engine/data/mods/core/conditions/actor-has-muscular-legs.condition.json
  why: Example of hasPartWithComponentValue usage in conditions
  
- file: /home/joeloverbeck/projects/living-narrative-engine/data/mods/core/actions/follow.action.json
  why: Shows how actions use condition_ref in prerequisites
  
- file: /home/joeloverbeck/projects/living-narrative-engine/tests/unit/logic/jsonLogicCustomOperators.test.js
  why: Test patterns for custom operators
  
- file: /home/joeloverbeck/projects/living-narrative-engine/tests/integration/anatomy/
  why: Integration test patterns for anatomy system
```

### Current Implementation Details
```javascript
// Current hasPartWithComponentValue operator signature
{"hasPartWithComponentValue": ["entityPath", "componentId", "propertyPath", "expectedValue"]}

// Example usage in existing condition
{
  "logic": {
    "hasPartWithComponentValue": ["actor", "descriptors:build", "build", "muscular"]
  }
}

// Current core:movement component structure
{
  "core:movement": {
    "locked": false
  }
}
```

### Existing Files to Modify
```yaml
Character Entities with core:movement:
- .private/data/mods/p_erotica/entities/definitions/iker_aguirre.character.json
- data/mods/isekai/entities/definitions/hero.character.json
- data/mods/isekai/entities/definitions/ninja.character.json
- data/mods/isekai/entities/definitions/receptionist.character.json
- data/mods/isekai/entities/definitions/sidekick.character.json

Leg Entities needing core:movement:
- /data/mods/anatomy/entities/definitions/human_leg.entity.json
- /data/mods/anatomy/entities/definitions/human_leg_muscular.entity.json
- /data/mods/anatomy/entities/definitions/human_leg_shapely.entity.json

Conditions to replace:
- /data/mods/core/conditions/actor-is-not-rooted.condition.json (referenced by 2 actions)

Actions using movement conditions:
- /data/mods/core/actions/follow.action.json
- /data/mods/core/actions/go.action.json
- /data/mods/intimacy/actions/get_close.action.json
```

### Known Gotchas
```javascript
// CRITICAL: hasPartWithComponentValue returns false if:
// 1. Entity doesn't exist
// 2. Entity has no anatomy:body component
// 3. No body parts have the component
// This is the desired behavior for movement checks

// IMPORTANT: The operator expects exact property paths
// For nested properties like "locked", use the exact path
```

## Implementation Blueprint

### Data models and structure
The `core:movement` component structure remains unchanged:
```json
{
  "core:movement": {
    "locked": false
  }
}
```

### List of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1: Create new movement condition
CREATE data/mods/core/conditions/actor-can-move.condition.json:
  - MIRROR pattern from: actor-has-muscular-legs.condition.json
  - MODIFY to check for core:movement.locked = false
  - USE hasPartWithComponentValue operator

Task 2: Add core:movement to all leg entities
MODIFY data/mods/anatomy/entities/definitions/human_leg.entity.json:
  - ADD core:movement component with locked: false
  
MODIFY data/mods/anatomy/entities/definitions/human_leg_muscular.entity.json:
  - ADD core:movement component with locked: false
  
MODIFY data/mods/anatomy/entities/definitions/human_leg_shapely.entity.json:
  - ADD core:movement component with locked: false

Task 3: Update actions to use new condition
MODIFY data/mods/core/actions/follow.action.json:
  - FIND prerequisite with condition_ref: "core:actor-is-not-rooted"
  - REPLACE with condition_ref: "core:actor-can-move"
  - UPDATE failure_message to: "You cannot move without functioning legs."

MODIFY data/mods/core/actions/go.action.json:
  - FIND prerequisite with condition_ref: "core:actor-is-not-rooted"
  - REPLACE with condition_ref: "core:actor-can-move"
  - UPDATE failure_message to: "You cannot move without functioning legs."

MODIFY data/mods/intimacy/actions/get_close.action.json:
  - FIND prerequisite with condition_ref: "core:actor-is-not-rooted"
  - REPLACE with condition_ref: "core:actor-can-move"
  - UPDATE failure_message to: "You cannot move without functioning legs."  

Task 4: Remove core:movement from character entities
MODIFY .private/data/mods/p_erotica/entities/definitions/iker_aguirre.character.json:
  - REMOVE core:movement component

Task 5: Create tests for the new condition
CREATE tests/unit/conditions/actor-can-move.test.js:
  - MIRROR pattern from: tests/unit/logic/jsonLogicCustomOperators.test.js
  - TEST condition evaluation with and without movement component
  - TEST with locked true/false values
  - TEST with missing body parts

Task 6: Update integration tests
MODIFY tests/integration/rules/action-prerequisites.test.js:
  - UPDATE tests that depend on movement to use new anatomy-based approach
  - ENSURE all movement-related tests still pass

Task 7: Mark old condition as deprecated
MODIFY data/mods/core/conditions/actor-is-not-rooted.condition.json:
  - ADD deprecation notice in description
  - KEEP for backward compatibility during migration
```

### Per task pseudocode

#### Task 1: New condition file structure
```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "core:actor-can-move",
  "description": "Checks if the actor has functioning legs capable of movement",
  "logic": {
    "hasPartWithComponentValue": ["actor", "core:movement", "locked", false]
  }
}
```

#### Task 5: Test structure
```javascript
describe('actor-can-move condition', () => {
  it('should return true when actor has legs with unlocked movement', () => {
    // Setup actor with anatomy:body component
    // Add legs with core:movement.locked = false
    // Evaluate condition
    // Expect true
  });
  
  it('should return false when movement is locked', () => {
    // Setup with core:movement.locked = true
    // Expect false
  });
  
  it('should return false when no legs have movement component', () => {
    // Setup legs without core:movement
    // Expect false
  });
});
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors in the files you've modified before proceeding
npm run lint # Auto-fix what's possible

# Expected: No errors in modified files. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```bash
# Run and iterate until passing:
npm run test

# Specific test suites to verify:
npm run test -- tests/unit/conditions/actor-can-move.test.js
npm run test -- tests/integration/rules/action-prerequisites.test.js
npm run test -- tests/integration/anatomy/

# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Manual Verification
```bash
# Start the game and verify:
# 1. Characters can still perform movement actions
# 2. Removing legs prevents movement
# 3. No errors in console during movement actions
```

## Final validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors in modified files: `npm run lint`
- [ ] New condition file validates against schema
- [ ] All character entities have core:movement removed
- [ ] All leg entities have core:movement added
- [ ] Actions use new condition and have updated messages
- [ ] Integration tests verify complete flow
- [ ] Old condition marked as deprecated

---

## Anti-Patterns to Avoid
- ❌ Don't modify the hasPartWithComponentValue operator - it's already working
- ❌ Don't delete actor-is-not-rooted.condition.json yet - mark as deprecated
- ❌ Don't forget to update failure messages in actions
- ❌ Don't skip testing missing/null cases
- ❌ Don't modify core:movement structure - keep it as { locked: boolean }
- ❌ Don't forget to run full test suite after changes

## Additional Notes
- The hasPartWithComponentValue operator is already fully implemented and tested
- It handles all null/missing cases gracefully returning false
- The operator logs detailed information for debugging
- Consider creating a migration script for save game compatibility if needed

## Confidence Score: 9/10
The implementation path is clear with existing infrastructure. The only minor uncertainty is potential edge cases in save game compatibility, but the core migration is straightforward using existing, tested components.