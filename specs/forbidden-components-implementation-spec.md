# Forbidden Components Implementation Specification

## Overview

This specification outlines the implementation of the `forbidden_components` feature for the Living Narrative Engine's action system. This feature will enable high-performance pre-filtering of actions based on components that must NOT be present on actors, complementing the existing `required_components` mechanism.

## Goals

1. **Performance Optimization**: Move negative component filtering from runtime scope evaluation to pre-filtering stage
2. **Simplicity**: Reduce complexity in scope definitions by handling component exclusions declaratively
3. **Clarity**: Make action requirements more explicit and self-documenting
4. **Backward Compatibility**: Ensure existing actions continue to work without modification

## Technical Implementation

### 1. Schema Updates

#### action.schema.json Modification

Add the following property to the action schema after the `required_components` field:

```json
"forbidden_components": {
  "type": "object",
  "description": "HIGH-LEVEL PRE-FILTERING. Specifies component IDs that must NOT be present on the actor for this action to be considered for discovery. This is evaluated at the same pre-filtering stage as required_components for optimal performance.",
  "properties": {
    "actor": {
      "type": "array",
      "description": "A list of component IDs that the actor must NOT possess for this action to be a candidate.",
      "items": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$"
      }
    }
  },
  "additionalProperties": false
}
```

**Rationale**:

- Mirrors the structure of `required_components` for consistency
- Uses the same namespaced component ID pattern
- Allows future extension to target components if needed

### 2. ActionIndex Enhancement

#### File: src/actions/actionIndex.js

**New Private Field**:

```javascript
/**
 * A map where keys are component IDs and values are arrays of ActionDefinitions
 * that forbid that component on the actor.
 *
 * @type {Map<string, ActionDefinition[]>}
 */
#byForbiddenComponent = new Map();
```

**buildIndex() Method Updates**:

Add the following logic after processing required_components:

```javascript
// Process forbidden components
const forbiddenActorComponents = actionDef.forbidden_components?.actor;

if (
  forbiddenActorComponents &&
  Array.isArray(forbiddenActorComponents) &&
  forbiddenActorComponents.length > 0
) {
  for (const componentId of forbiddenActorComponents) {
    if (typeof componentId === 'string' && componentId.trim()) {
      if (!this.#byForbiddenComponent.has(componentId)) {
        this.#byForbiddenComponent.set(componentId, []);
      }
      this.#byForbiddenComponent.get(componentId).push(actionDef);
    }
  }
}
```

Also update the clear operation:

```javascript
this.#byForbiddenComponent.clear();
```

**getCandidateActions() Method Updates**:

Add forbidden component filtering after building the initial candidate set:

```javascript
// Filter out actions with forbidden components
const forbiddenCandidates = new Set();
for (const componentType of actorComponentTypes) {
  const actionsWithForbiddenComponent =
    this.#byForbiddenComponent.get(componentType);
  if (actionsWithForbiddenComponent) {
    trace?.info(
      `Found ${actionsWithForbiddenComponent.length} actions forbidden by component '${componentType}'.`,
      source
    );
    for (const action of actionsWithForbiddenComponent) {
      forbiddenCandidates.add(action);
    }
  }
}

// Remove forbidden actions from candidates
for (const forbiddenAction of forbiddenCandidates) {
  candidateSet.delete(forbiddenAction);
}

if (forbiddenCandidates.size > 0) {
  trace?.info(
    `Removed ${forbiddenCandidates.size} actions due to forbidden components.`,
    source,
    { removedActionIds: Array.from(forbiddenCandidates).map((a) => a.id) }
  );
}
```

### 3. Action Definition Updates

#### Files to Update:

1. **data/mods/intimacy/actions/place_hand_on_waist.action.json**

   ```json
   {
     "id": "intimacy:place_hand_on_waist",
     "scope": "intimacy:close_actors_facing_forward", // Changed from close_actors_in_front
     "required_components": {
       "actor": ["intimacy:closeness"]
     },
     "forbidden_components": {
       "actor": ["intimacy:facing_away"]
     }
     // ... rest of the definition
   }
   ```

2. **data/mods/intimacy/actions/turn_around.action.json**
   ```json
   {
     "id": "intimacy:turn_around_to_face",
     "scope": "intimacy:close_actors_facing_forward", // Changed from close_actors_in_front
     "required_components": {
       "actor": ["intimacy:closeness"]
     },
     "forbidden_components": {
       "actor": ["intimacy:facing_away"]
     }
     // ... rest of the definition
   }
   ```

### 4. Cleanup Tasks

#### Files to Remove:

1. **data/mods/intimacy/conditions/actor-has-facing-away.condition.json**
   - No longer needed as the check is handled by forbidden_components
   - Ensure no other files reference this condition before removal

2. **data/mods/intimacy/scopes/close_actors_in_front.scope**
   - Replaced by the simpler close_actors_facing_forward.scope
   - All actions using this scope should be updated first

#### Files to Verify:

Check if any other files reference the removed condition or scope:

- Run grep for "actor-has-facing-away"
- Run grep for "close_actors_in_front"

### 5. Testing Requirements

#### Unit Tests

**File: tests/unit/actions/actionIndex.test.js**

Add test cases for:

1. **Building index with forbidden components**:

   ```javascript
   it('should build index with forbidden components', () => {
     const actionDefinitions = [
       {
         id: 'action1',
         name: 'Restricted Action',
         forbidden_components: {
           actor: ['core:paralyzed', 'core:unconscious'],
         },
       },
     ];
     // Test that forbidden component maps are created correctly
   });
   ```

2. **Filtering actions with forbidden components**:

   ```javascript
   it('should exclude actions when actor has forbidden components', () => {
     // Setup actor with forbidden component
     // Verify action is excluded from candidates
   });
   ```

3. **Mixed required and forbidden components**:

   ```javascript
   it('should handle actions with both required and forbidden components', () => {
     // Test complex scenarios with both types of requirements
   });
   ```

4. **Tracing forbidden component filtering**:
   ```javascript
   it('should trace forbidden component filtering', () => {
     // Verify trace messages are generated correctly
   });
   ```

#### Integration Tests

**File: tests/integration/actions/forbiddenComponents.integration.test.js**

Create new integration test file to verify:

1. End-to-end action discovery with forbidden components
2. Correct interaction between required and forbidden components
3. Performance comparison vs scope-based filtering
4. Mod loading and validation of forbidden components

#### Existing Test Updates

Update any tests that:

- Reference the removed condition file
- Use the removed scope
- Test actions that will be modified

### 6. Migration Guide

For mod developers updating existing actions:

1. **Identify actions using component-checking conditions in scopes**
2. **Add forbidden_components to action definition**
3. **Simplify scope to remove condition checks**
4. **Test action discovery still works correctly**

Example migration:

```javascript
// Before: Complex scope with condition
"scope": "intimacy:close_actors_in_front"

// After: Simple scope with forbidden_components
"scope": "intimacy:close_actors_facing_forward",
"forbidden_components": {
  "actor": ["intimacy:facing_away"]
}
```

### 7. Performance Expectations

- **Pre-filtering Performance**: O(n) where n is number of actor components
- **Memory Usage**: Additional Map with size proportional to unique forbidden components
- **Expected Improvement**: 20-40% faster action discovery for actions with complex scopes

### 8. Future Considerations

1. **Target Forbidden Components**: The schema supports adding target forbidden components in the future
2. **Validation**: Consider adding validation to ensure forbidden and required components don't overlap
3. **Documentation**: Update modding guide with forbidden_components examples

## Implementation Checklist

- [ ] Update action.schema.json with forbidden_components field
- [ ] Enhance ActionIndex class with forbidden component tracking
- [ ] Update place_hand_on_waist.action.json
- [ ] Update turn_around.action.json
- [ ] Remove actor-has-facing-away.condition.json
- [ ] Remove close_actors_in_front.scope
- [ ] Write unit tests for ActionIndex changes
- [ ] Create integration tests for forbidden components
- [ ] Update any affected existing tests
- [ ] Run full test suite to ensure no regressions
- [ ] Update documentation if needed

## Risk Assessment

**Low Risk**:

- Feature is optional and backward compatible
- Localized changes to ActionIndex
- Clear migration path

**Mitigation**:

- Comprehensive testing before deployment
- Keep old files during transition period if needed
- Clear documentation of changes

## Conclusion

The forbidden_components feature provides a clean, performant solution for negative component filtering in action discovery. By moving this logic to the pre-filtering stage, we improve both performance and maintainability while keeping the implementation simple and consistent with existing patterns.
