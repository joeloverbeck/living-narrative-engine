# Movement System Migration Report

## Current Implementation Analysis

### 1. Core:Movement Component Structure

The `core:movement` component is currently structured as follows in character entities:

```json
{
  "core:movement": {
    "locked": false
  }
}
```

**Location**: Character entities (e.g., `/data/mods/isekai/entities/definitions/hero.character.json`)

**Key characteristics**:
- Simple boolean flag indicating whether movement is locked
- Component exists directly on character entities, not on body parts
- Used in condition `core:actor-is-not-rooted` to check if movement is allowed

### 2. Current Movement Check Implementation

The condition `actor-is-not-rooted.condition.json` currently uses:
```json
{
  "logic": {
    "==": [
      {
        "var": "actor.components.core:movement.locked"
      },
      false
    ]
  }
}
```

This directly accesses the movement component on the actor entity.

### 3. hasPartWithComponentValue Implementation Pattern

The existing `hasPartWithComponentValue` custom operator follows this pattern:

```javascript
jsonLogicEvaluationService.addOperation('hasPartWithComponentValue', function(entityPath, componentId, propertyPath, expectedValue) {
  // 1. Navigate entity path to get entity
  // 2. Get entity's anatomy:body component
  // 3. Use BodyGraphService to check all body parts for matching component value
  // 4. Return boolean result
});
```

**Key implementation details**:
- Uses `this` context from JSON Logic evaluation
- Handles nested entity paths (e.g., "actor", "event.target")
- Requires entity to have `anatomy:body` component
- Traverses all body parts using `BodyGraphService.getAllParts()`
- Supports nested property paths in components

### 4. Existing Test Coverage

The `hasPartWithComponentValue` operator has comprehensive tests covering:
- ✅ Successful matches when entity has matching part
- ✅ False results when no matching part exists
- ✅ Handling entities without body components
- ✅ Invalid entity paths
- ✅ Nested entity paths (e.g., "event.target")
- ✅ Error handling with graceful fallback to false

## Migration Strategy

### Option 1: Move core:movement to Body Parts (Recommended)

1. **Add movement component to leg entities**:
   ```json
   // In human_leg.entity.json
   {
     "components": {
       "anatomy:part": { "subType": "leg" },
       "core:movement": { "enabled": true }
     }
   }
   ```

2. **Update the condition to use hasPartWithComponentValue**:
   ```json
   {
     "logic": {
       "hasPartWithComponentValue": ["actor", "core:movement", "enabled", true]
     }
   }
   ```

3. **Benefits**:
   - More realistic modeling (movement depends on having functioning legs)
   - Allows for partial mobility (e.g., one injured leg)
   - Consistent with anatomy-based approach

### Option 2: Create New hasComponentValue Operator

1. **Implement a simpler operator for direct component checks**:
   ```javascript
   jsonLogicEvaluationService.addOperation('hasComponentValue', function(entityPath, componentId, propertyPath, expectedValue) {
     // Direct component check without body parts
   });
   ```

2. **Use in condition**:
   ```json
   {
     "logic": {
       "hasComponentValue": ["actor", "core:movement", "locked", false]
     }
   }
   ```

3. **Benefits**:
   - Minimal change to existing system
   - Useful for non-anatomy components
   - Simpler implementation

### Option 3: Hybrid Approach

1. **Implement both operators**
2. **Use hasComponentValue for simple checks**
3. **Use hasPartWithComponentValue for anatomy-based checks**

## Implementation Steps for Recommended Approach (Option 1)

1. **Update leg entity definitions** to include movement component
2. **Create migration script** to add movement components to existing leg parts in saved games
3. **Update actor-is-not-rooted condition** to use hasPartWithComponentValue
4. **Add tests** for movement-based conditions
5. **Update any movement-locking logic** to target leg parts instead of character entity

## Testing Requirements

1. **Unit tests for new movement checks**
2. **Integration tests for movement conditions**
3. **Migration tests for existing save games**
4. **Edge cases**:
   - Characters without legs
   - Characters with damaged/disabled legs
   - Non-humanoid entities

## Considerations

- **Performance**: hasPartWithComponentValue traverses all body parts, which could impact performance with complex anatomies
- **Backwards compatibility**: Need migration for existing save games
- **Flexibility**: Consider whether other body parts might affect movement (e.g., paralysis affecting nervous system)
- **Current implementation**: The hasPartWithComponentValue operator is already fully implemented and tested, making this migration straightforward