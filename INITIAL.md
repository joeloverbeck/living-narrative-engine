## FEATURE:

Important: you shouldn't modify any code at this stage. The goal is to create a comprehensive PRP document.

We need to migrate the `core:movement` component from character entities to their body parts (specifically legs). The migration requires creating a custom JSON Logic operator that can query body graphs during action prerequisite evaluation.

Currently, movement capability is checked through:
- **Component Location**: `core:movement` component directly on character entities (e.g., `iker_aguirre.character.json`)
- **Condition Check**: `actor-is-not-rooted.condition.json` checks if `actor.components.core:movement.locked` equals `false`
- **Usage**: Actions like `follow.action.json` use this condition in their prerequisites

```json
// actor-is-not-rooted.condition.json
{
  "logic": {
    "==": [
      { "var": "actor.components.core:movement.locked" },
      false
    ]
  }
}
```

### 2. BodyGraphService Capabilities

The `BodyGraphService` already provides the necessary method for querying components within body graphs:

```javascript
hasPartWithComponentValue(bodyComponent, componentId, propertyPath, expectedValue) {
  const allParts = this.getAllParts(bodyComponent);
  for (const partId of allParts) {
    const componentData = this.#entityManager.getComponentData(partId, componentId);
    if (componentData !== null) {
      const value = this.#getNestedProperty(componentData, propertyPath);
      if (value === expectedValue) return { found: true, partId };
    }
  }
  return { found: false };
}
```

### 3. Prerequisite Evaluation Flow

The prerequisite evaluation system follows this flow:
1. `PrerequisiteEvaluationService` receives prerequisites from action definitions
2. `condition_ref` values are resolved to their actual logic definitions
3. `ActionValidationContextBuilder` creates an evaluation context with actor data
4. `ComponentAccessor` provides access to entity components via proxy objects
5. `JsonLogicEvaluationService` evaluates the resolved rules using json-logic-js


## Proposed Solution

### 1. Create a Custom JSON Logic Operator

Add a new custom operator `hasBodyPartWithComponent` to the JSON Logic evaluation service:

```javascript
// In JsonLogicEvaluationService constructor or a dedicated setup method
this.addOperation('hasBodyPartWithComponent', function(args, context) {
  // args would be an object like:
  // { componentId: "core:movement", propertyPath: "locked", expectedValue: false }
  
  const actorId = context.actor?.id;
  if (!actorId) return false;
  
  // Get the anatomy:body component from the actor
  const bodyComponent = entityManager.getComponentData(actorId, 'anatomy:body');
  if (!bodyComponent) return false;
  
  // Use BodyGraphService to check body parts
  const result = bodyGraphService.hasPartWithComponentValue(
    bodyComponent,
    args.componentId,
    args.propertyPath,
    args.expectedValue
  );
  
  return result.found;
});
```

### 2. Create a New Condition Definition

Create a new condition file `actor-can-move.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "core:actor-can-move",
  "description": "Checks if the actor has any body part capable of movement",
  "logic": {
    "hasBodyPartWithComponent": {
      "componentId": "core:movement",
      "propertyPath": "locked",
      "expectedValue": false
    }
  }
}
```

### 3. Update Action Prerequisites

Update actions to use the new condition:

```json
// In follow.action.json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "core:actor-can-move"
    },
    "failure_message": "You cannot move without functioning legs."
  },
  // ... other prerequisites
]
```

## Implementation Steps

### Step 1: Extend JsonLogicEvaluationService

1. Modify the constructor to accept `bodyGraphService` as a dependency
2. Add the custom operator registration in the constructor
3. Ensure the operator has access to both `entityManager` and `bodyGraphService`

### Step 2: Update Service Dependencies

1. Update the service initialization chain to provide `bodyGraphService` to `JsonLogicEvaluationService`
2. Ensure all necessary services are available during prerequisite evaluation

### Step 3: Create Migration Conditions

1. Create new condition files for body-part-based checks
2. Keep old conditions for backward compatibility during migration
3. Update actions incrementally to use new conditions

### Step 4: Move Components to Body Parts

1. Remove `core:movement` from character entities
2. Add `core:movement` to appropriate body part entities (legs). Currently there are only three leg entities: human_leg_muscular.entity.json , human_leg_shapely.entity.json , and human_leg.entity.json
3. Test thoroughly to ensure all movement-based actions still work

## Challenges and Considerations

### 1. Service Access in JSON Logic Context

**Challenge**: The JSON Logic evaluation context currently only has access to entity data through the component accessor, not to services.

**Solution**: The custom operator needs to be a closure that captures service references when registered, or the evaluation context needs to be extended to include service references.

## Conclusion

The migration from character-level to body-part-level components is achievable without modifying core logic modules. The key is to extend the JSON Logic evaluation system with custom operators that can query body graphs. This approach maintains the existing architecture while enabling the new anatomy system's capabilities.

The proposed solution provides a clear path forward that:
- Preserves the existing prerequisite evaluation system
- Leverages the already-implemented BodyGraphService capabilities
- Allows for gradual migration without breaking existing functionality
- Sets a pattern for migrating other resource/ability components in the future

## EXAMPLES:

You have plenty of integration suites for the anatomy system in tests/integration/anatomy/ .
We also have lots of integration suites for the actions nad their corresponding rules in tests/integration/rules/

## DOCUMENTATION:

To know in depth the capabilities of JsonLogic in my app, read the document docs/json-logic/json-logic for modders.md

## OTHER CONSIDERATIONS:

Once the new feature is implemented, it's imperative to ensure all tests pass. Run 'npm run test'. If any test suite fails (and likely plenty will), then fix them.
