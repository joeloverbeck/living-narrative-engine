name: "Test Adaptation for Movement Component Migration to Anatomy System"
description: |

## Purpose
The "core:movement" component has been migrated from character entities to body part entities (specifically legs) within the anatomy system. This PRP documents the test adaptations required to support this architectural change.

## Core Principles
1. **Test mocks must reflect production behavior**
2. **Anatomy structure must be consistent across all tests**
3. **Backward compatibility preserved where needed**
4. **All tests must pass without regression**

---

## Background
The movement component migration has already been implemented:
- ✅ "core:movement" removed from character entities (hero, ninja, receptionist, sidekick)
- ✅ "core:movement" added to leg body part entities (human_leg, human_leg_muscular, human_leg_shapely)
- ✅ Conditions updated to use anatomy system (actor-is-not-rooted.condition.json)
- ✅ Movement utilities updated to handle anatomy-based movement

## Goal
Update all integration tests to work with the new anatomy-based movement system by:
- Providing proper bodyGraphService mocks
- Using correct anatomy:body component structure
- Ensuring movement checks traverse the body part graph correctly

## What Was Implemented
### Success Criteria (All Completed)
- ✅ All failing tests now pass
- ✅ bodyGraphService mocks check entity components correctly
- ✅ Test data uses proper anatomy:body structure
- ✅ Movement utilities work with anatomy system
- ✅ No regression in test coverage

## Key Implementation Details

### 1. Mock bodyGraphService Implementation
All SystemLogicInterpreter instances require a bodyGraphService mock that checks body parts for component values:

```javascript
const mockBodyGraphService = {
  hasPartWithComponentValue: jest.fn((bodyComponent, componentId, propertyPath, expectedValue) => {
    // Check if valid body component exists with correct structure
    if (!bodyComponent || !bodyComponent.body || !bodyComponent.body.root) {
      return { found: false };
    }
    
    // Check all entities in the manager for matching component
    const allEntities = entityManager.getAllEntities();
    for (const entity of allEntities) {
      if (entity.components && entity.components[componentId]) {
        const component = entity.components[componentId];
        const actualValue = propertyPath ? component[propertyPath] : component;
        if (actualValue === expectedValue) {
          return { found: true, partId: entity.id };
        }
      }
    }
    
    return { found: false };
  })
};
```

### 2. Correct Anatomy Body Component Structure
Based on `data/mods/anatomy/components/body.component.json`, the proper structure is:

```javascript
{
  'anatomy:body': {
    recipeId: 'anatomy:human',
    body: {
      root: 'body-entity-id',        // NOT rootEntityId
      parts: {                       // Map of part types to entity IDs
        torso: 'body-entity-id',
        leg_left: 'leg-left-entity-id',
        leg_right: 'leg-right-entity-id'
      }
    }
  }
}
```

### 3. Movement Utilities Update
The `updateMovementLock` function in `src/utils/movementUtils.js` was updated to:
- Check for `body.root` (not `rootEntityId`)
- Iterate through `body.parts` map to find and update movement components
- Update movement on all body parts that have the component

### Current Codebase Structure
```
src/
├── anatomy/
│   ├── bodyGraphService.js         # Key service for querying body parts
│   └── anatomyOrchestrator.js      # Manages anatomy operations
├── logic/
│   ├── jsonLogicEvaluationService.js  # Add custom operations here
│   ├── operationHandlers/          # Directory for operation handlers
│   └── operationRegistry.js        # Registry for operations
├── utils/
│   └── movementUtils.js            # Utility for movement modifications
└── dependencyInjection/
    └── registrations/
        └── interpreterRegistrations.js  # Register new handlers here

data/
└── mods/
    ├── core/
    │   ├── components/
    │   │   └── movement.component.json  # Movement component definition
    │   ├── conditions/
    │   │   └── actor-is-not-rooted.condition.json  # Movement condition
    │   └── actions/
    │       ├── follow.action.json      # Uses movement prerequisite
    │       ├── go.action.json          # Uses movement prerequisite
    │       └── get_close.action.json   # Uses movement prerequisite
    └── isekai/
        └── entities/               # Character entities with movement
```

### Entities Currently with "core:movement"
- data/mods/isekai/entities/hero.entity.json
- data/mods/isekai/entities/ninja.entity.json
- data/mods/isekai/entities/receptionist.entity.json
- data/mods/isekai/entities/sidekick.entity.json

### Leg Body Part Entities to Receive "core:movement"
- data/mods/anatomy/entities/human_leg.entity.json
- data/mods/anatomy/entities/human_leg_muscular.entity.json
- data/mods/anatomy/entities/human_leg_shapely.entity.json

### Known Gotchas
```javascript
// CRITICAL: BodyGraphService methods require the bodyComponent, not entityId
// Get body component first: entity.getComponentData('anatomy:body')

// CRITICAL: JsonLogic custom operations must return boolean for conditions
// Ensure the operation handles null/undefined gracefully

// CRITICAL: Movement utils expects entity to have movement directly
// Will need to find body parts first, then modify their movement

// CRITICAL: Tests mock entities with movement component
// All test mocks need to include anatomy structure with legs
```

## Implementation Blueprint

### Data Models and Structure
The movement component remains unchanged in structure:
```json
{
  "locked": false,
  "forcedOverride": false
}
```

### List of Tasks to Complete (in order)

```yaml
Task 1: Create Custom JsonLogic Operation for Body Part Queries
CREATE src/logic/operationHandlers/hasBodyPartWithComponentValueHandler.js:
  - MIRROR pattern from: src/logic/operationHandlers/mergeClosenessCircleHandler.js
  - Use BodyGraphService.hasPartWithComponentValue method
  - Handle cases where entity has no body component gracefully
  - Register in interpreterRegistrations.js with token

Task 2: Update JsonLogicEvaluationService to Add Custom Operation
MODIFY src/logic/jsonLogicEvaluationService.js:
  - In constructor or initialization, add custom operation
  - Operation name: "hasBodyPartWithComponentValue"
  - Delegate to the handler created in Task 1

Task 3: Remove Movement from Character Entities
MODIFY data/mods/isekai/entities/hero.entity.json:
  - REMOVE "core:movement" from components object
MODIFY data/mods/isekai/entities/ninja.entity.json:
  - REMOVE "core:movement" from components object
MODIFY data/mods/isekai/entities/receptionist.entity.json:
  - REMOVE "core:movement" from components object
MODIFY data/mods/isekai/entities/sidekick.entity.json:
  - REMOVE "core:movement" from components object

Task 4: Add Movement to Leg Body Parts
MODIFY data/mods/anatomy/entities/human_leg.entity.json:
  - ADD "core:movement": { "locked": false, "forcedOverride": false } to components
MODIFY data/mods/anatomy/entities/human_leg_muscular.entity.json:
  - ADD "core:movement": { "locked": false, "forcedOverride": false } to components
MODIFY data/mods/anatomy/entities/human_leg_shapely.entity.json:
  - ADD "core:movement": { "locked": false, "forcedOverride": false } to components

Task 5: Update Movement Condition
MODIFY data/mods/core/conditions/actor-is-not-rooted.condition.json:
  - REPLACE {"==": [{"var": "actor.components.core:movement.locked"}, false]}
  - WITH {"hasBodyPartWithComponentValue": ["actor", "core:movement", "locked", false]}

Task 6: Update Movement Utils
MODIFY src/utils/movementUtils.js:
  - In updateMovementLock function:
    - Check if entity has 'anatomy:body' component
    - If yes, find all parts with 'core:movement' using BodyGraphService
    - Update 'locked' property on all found parts
    - If no body component, log warning and skip

Task 7: Update Tests - Movement Utils
MODIFY tests/unit/utils/movementUtils.test.js:
  - Mock entities need anatomy structure with legs containing movement
  - Update expectations to check leg components, not entity components

Task 8: Update Tests - Operation Handlers
MODIFY tests/unit/logic/operationHandlers/mergeClosenessCircleHandler.test.js:
  - Add anatomy structure to test entities
MODIFY tests/unit/logic/operationHandlers/removeFromClosenessCircleHandler.test.js:
  - Add anatomy structure to test entities

Task 9: Update Integration Tests
MODIFY tests/integration/rules/goRule.integration.test.js:
  - Add anatomy structure with legs to test entities
MODIFY tests/integration/rules/closenessActionAvailability.integration.test.js:
  - Add anatomy structure with legs to test entities
MODIFY tests/integration/rules/stepBackRule.integration.test.js:
  - Add anatomy structure with legs to test entities
MODIFY tests/integration/actions/prerequisiteEvaluation.test.js:
  - Add anatomy structure with legs to test entities
MODIFY tests/integration/scopes/actionDiscoveryIntegration.integration.test.js:
  - Add anatomy structure with legs to test entities

Task 10: Create Unit Tests for New Handler
CREATE tests/unit/logic/operationHandlers/hasBodyPartWithComponentValueHandler.test.js:
  - Test successful case: entity with body and leg with movement
  - Test edge case: entity without body component
  - Test failure case: entity with body but no parts with component
  - MIRROR test structure from other handler tests
```

### Pseudocode for Key Components

#### Task 1: hasBodyPartWithComponentValueHandler.js
```javascript
class HasBodyPartWithComponentValueHandler extends BaseOperationHandler {
  constructor(entityManager, bodyGraphService) {
    // Store dependencies
  }

  async handle(context, parameters) {
    // Extract: entityRef, componentId, propertyPath, expectedValue from parameters
    // Resolve entity from entityRef using context
    // Get body component from entity
    // If no body component, return false
    // Use bodyGraphService.hasPartWithComponentValue
    // Return boolean result
  }
}
```

#### Task 6: Updated movementUtils.js
```javascript
updateMovementLock: (entity, locked, services) => {
  const bodyComponent = entity.getComponentData('anatomy:body');
  
  if (!bodyComponent) {
    // Legacy path: check entity directly (for backward compatibility)
    const movementComponent = entity.getComponentData('core:movement');
    if (movementComponent) {
      // Update directly on entity
    }
    return;
  }

  // New path: find all body parts with movement
  const allParts = bodyGraphService.getAllParts(bodyComponent);
  for (const partId of allParts) {
    const partEntity = entityManager.getEntity(partId);
    const movement = partEntity?.getComponentData('core:movement');
    if (movement) {
      // Update movement.locked
      // Dispatch component update event
    }
  }
}
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint

# Expected: No errors in modified files
```

### Level 2: Unit Tests
```bash
# Run unit tests first to catch basic issues
npm run test:unit

# Focus on these test files that will need updates:
# - tests/unit/utils/movementUtils.test.js
# - tests/unit/logic/operationHandlers/mergeClosenessCircleHandler.test.js
# - tests/unit/logic/operationHandlers/removeFromClosenessCircleHandler.test.js
# - tests/unit/logic/operationHandlers/hasBodyPartWithComponentValueHandler.test.js (new)
```

### Level 3: Integration Tests
```bash
# Run all tests including integration
npm run test

# Key integration tests that must pass:
# - tests/integration/rules/goRule.integration.test.js
# - tests/integration/rules/closenessActionAvailability.integration.test.js
# - tests/integration/actions/prerequisiteEvaluation.test.js
```

## Final Validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] Movement actions work correctly (go, follow, get_close)
- [ ] Movement can be locked/unlocked via body parts
- [ ] Backward compatibility maintained for entities without anatomy
- [ ] All character entities updated
- [ ] All leg entities have movement component

---

## Anti-Patterns to Avoid
- ❌ Don't modify the movement component schema
- ❌ Don't break backward compatibility completely
- ❌ Don't hardcode entity IDs or component IDs
- ❌ Don't skip null checks for body components
- ❌ Don't modify anatomy generation logic
- ❌ Don't add movement to non-leg body parts

## Confidence Score
**8/10** - High confidence for one-pass implementation

The task is well-scoped with clear patterns to follow. The main complexity lies in:
1. Creating the custom JsonLogic operation (follows existing patterns)
2. Updating all tests with proper anatomy mocks (mechanical but numerous)

The codebase has good examples of similar operations and clear service interfaces. The BodyGraphService already provides the exact method needed (hasPartWithComponentValue), making the implementation straightforward.