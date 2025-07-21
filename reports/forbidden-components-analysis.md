# Forbidden Components Analysis: Enhancing Action Pre-filtering

## Executive Summary

This report analyzes the feasibility and benefits of adding a `forbidden_components` parameter to the action schema for pre-filtering actions based on components that must NOT be present on actors. This would complement the existing `required_components` mechanism and could simplify scope definitions in certain scenarios.

## Current Architecture Overview

### Component-Based Pre-filtering

The Living Narrative Engine currently uses a two-stage filtering process for action discovery:

1. **Component Pre-filtering** (ActionIndex): High-performance filtering based on required components
2. **Scope Evaluation**: More complex filtering using the scope DSL with JSON Logic conditions

### How `required_components` Works

The `required_components` parameter in action.schema.json:

```json
"required_components": {
  "type": "object",
  "description": "HIGH-LEVEL PRE-FILTERING. Specifies component IDs required on the actor...",
  "properties": {
    "actor": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

The ActionIndex service processes this by:

1. Building an index mapping component IDs to actions that require them
2. When discovering actions, it retrieves all components on the actor
3. Returns actions that either have no requirements or match the actor's components

```javascript
// ActionIndex.js implementation
#byActorComponent = new Map(); // componentId -> [actions]
#noActorRequirement = [];      // actions with no requirements

getCandidateActions(actorEntity) {
  const actorComponents = this.#entityManager.getAllComponentTypesForEntity(actorEntity.id);
  const candidateSet = new Set(this.#noActorRequirement);
  
  for (const componentType of actorComponents) {
    const actionsForComponent = this.#byActorComponent.get(componentType);
    if (actionsForComponent) {
      candidateSet.add(...actionsForComponent);
    }
  }
  
  return Array.from(candidateSet);
}
```

## The Problem: Negative Component Filtering

Currently, to filter out actors with specific components (e.g., `intimacy:facing_away`), mods must use complex scope definitions:

```javascript
// Current approach in close_actors_in_front.scope
intimacy:close_actors_in_front := actor.intimacy:closeness.partners[][{
  "or": [
    {"not": {"condition_ref": "intimacy:actor-has-facing-away"}},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

This requires:
- Creating separate scope files for positive and negative filtering
- More complex JSON Logic conditions
- Runtime evaluation of conditions rather than pre-filtering

## Proposed Solution: `forbidden_components`

### Schema Addition

```json
"forbidden_components": {
  "type": "object",
  "description": "HIGH-LEVEL PRE-FILTERING. Specifies component IDs that must NOT be present on the actor for this action to be considered.",
  "properties": {
    "actor": {
      "type": "array",
      "description": "A list of component IDs that the actor must NOT possess for this action to be a candidate.",
      "items": {
        "type": "string"
      }
    }
  },
  "additionalProperties": false
}
```

### Implementation Approach

The ActionIndex would need to be enhanced to:

1. Track forbidden components separately
2. Filter out actions when actors have forbidden components

```javascript
// Enhanced ActionIndex structure
class ActionIndex {
  #byActorComponent = new Map();      // Required components
  #byForbiddenComponent = new Map();  // NEW: Forbidden components
  #noRequirement = [];                // No requirements
  
  buildIndex(allActionDefinitions) {
    // ... existing code ...
    
    const forbiddenActorComponents = actionDef.forbidden_components?.actor;
    if (forbiddenActorComponents?.length > 0) {
      for (const componentId of forbiddenActorComponents) {
        if (!this.#byForbiddenComponent.has(componentId)) {
          this.#byForbiddenComponent.set(componentId, []);
        }
        this.#byForbiddenComponent.get(componentId).push(actionDef);
      }
    }
  }
  
  getCandidateActions(actorEntity, trace) {
    // ... existing code ...
    
    // NEW: Remove actions with forbidden components
    const actorComponents = this.#entityManager.getAllComponentTypesForEntity(actorEntity.id);
    for (const componentType of actorComponents) {
      const forbiddenActions = this.#byForbiddenComponent.get(componentType);
      if (forbiddenActions) {
        for (const action of forbiddenActions) {
          candidateSet.delete(action);
        }
      }
    }
    
    return Array.from(candidateSet);
  }
}
```

## Benefits Analysis

### 1. Performance Benefits

**Pre-filtering Efficiency**: Component checking happens at the index level, before any scope evaluation or JSON Logic processing. This is significantly faster than runtime condition evaluation.

**Reduced Scope Complexity**: Simpler scopes mean faster evaluation:

```javascript
// Before: Complex scope with condition checking
intimacy:close_actors_in_front := actor.intimacy:closeness.partners[][{
  "or": [
    {"not": {"condition_ref": "intimacy:actor-has-facing-away"}},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]

// After: Simpler scope, forbidden check handled at index level
intimacy:close_actors_facing_forward := actor.intimacy:closeness.partners[]
```

### 2. Maintainability Benefits

**Clearer Intent**: Action definitions explicitly state what components prevent their use:

```json
{
  "id": "intimacy:kiss_cheek",
  "scope": "intimacy:close_actors",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:facing_away"]
  }
}
```

**Reduced Duplication**: No need for multiple scope variations based on component presence/absence.

### 3. Developer Experience

**Simpler Mental Model**: Developers can think in terms of "must have" and "must not have" directly in the action definition.

**Better Validation**: The schema can validate forbidden components at load time, catching errors early.

## Potential Drawbacks

### 1. Index Complexity

The ActionIndex becomes more complex with dual tracking of required/forbidden components. However, this complexity is localized and well-contained.

### 2. Memory Overhead

Additional Map structure for forbidden components increases memory usage. Given the typically small number of actions and components, this is negligible.

### 3. Migration Effort

Existing mods would need updating to take advantage of this feature, though it would be backward compatible.

## Alternative Approaches Considered

### 1. Enhanced Scope DSL

Instead of adding to the schema, enhance the scope DSL to support negative component filters:

```javascript
// Hypothetical DSL enhancement
intimacy:close_actors := actor.intimacy:closeness.partners[]
  [has_components: ["intimacy:closeness"]]
  [lacks_components: ["intimacy:facing_away"]]
```

**Pros**: Keeps filtering logic in scopes
**Cons**: Still requires runtime evaluation, more complex DSL

### 2. Component Conditions

Add component presence/absence checks as built-in conditions:

```json
{
  "prerequisites": [{
    "logic": {
      "not": {
        "actor_has_component": "intimacy:facing_away"
      }
    }
  }]
}
```

**Pros**: Uses existing prerequisite system
**Cons**: Evaluated after initial filtering, less performant

## Recommendations

### 1. Implement `forbidden_components`

The benefits outweigh the drawbacks. The implementation is straightforward and provides clear performance and maintainability advantages.

### 2. Implementation Priority

Given the current intimacy mod patterns and the explicit example in the request, this feature would provide immediate value.

### 3. Schema Design

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "properties": {
    // ... existing properties ...
    "forbidden_components": {
      "type": "object",
      "description": "Components that must NOT be present for action availability",
      "properties": {
        "actor": {
          "type": "array",
          "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$" }
        }
      },
      "additionalProperties": false
    }
  }
}
```

### 4. Migration Path

1. Add the schema field as optional
2. Update ActionIndex to support forbidden components
3. Update existing intimacy mod actions to use forbidden_components
4. Simplify affected scopes to remove component checking logic

### 5. Testing Requirements

- Unit tests for ActionIndex forbidden component handling
- Integration tests for action discovery with mixed required/forbidden components
- Performance benchmarks comparing scope-based vs index-based filtering

## Conclusion

Adding `forbidden_components` to the action schema is a beneficial enhancement that:

1. **Improves Performance**: Moves filtering to the pre-processing stage
2. **Simplifies Scope Definitions**: Reduces complexity in the scope DSL
3. **Enhances Clarity**: Makes component requirements explicit in action definitions
4. **Maintains Backward Compatibility**: Optional parameter doesn't break existing actions

The implementation effort is moderate and well-defined, with clear benefits for both current mods and future development. The feature aligns well with the engine's philosophy of declarative, data-driven game mechanics.

## Example Implementation

### Before (Current Approach)

```json
// place_hand_on_waist.action.json
{
  "id": "intimacy:place_hand_on_waist",
  "scope": "intimacy:close_actors_in_front",  // Complex scope
  "required_components": {
    "actor": ["intimacy:closeness"]
  }
}
```

### After (With forbidden_components)

```json
// place_hand_on_waist.action.json
{
  "id": "intimacy:place_hand_on_waist",
  "scope": "intimacy:close_actors",  // Simpler scope
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:facing_away"]
  }
}
```

This change would allow the removal of the `intimacy:close_actors_in_front` scope entirely, with all consumers using the simpler `intimacy:close_actors_facing_forward` scope instead.