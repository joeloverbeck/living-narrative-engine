# Lying-in-Furniture System Specification

## Overview

This specification defines a new positioning system for actors to lie down on furniture (e.g., beds, couches) and get up from that furniture. The system follows the **marker-based pattern** similar to `bending_over`, where components serve as state markers rather than using slot allocation like the sitting system.

### Design Philosophy

**Marker-Based vs Slot-Based Approach:**

- **Sitting System (Slot-Based)**: Uses `allows_sitting.spots` array with atomic modifications for concurrent access control. Suitable when multiple actors need specific positional slots.

- **Lying System (Marker-Based)**: Uses simple component markers (`allows_lying_on` for furniture, `lying_down` for actors) without slot management. Multiple actors can lie on the same furniture without positional tracking.

**Key Design Decision:** Unlike sitting, lying does not use slots because:
1. Beds/couches don't need precise positional tracking
2. Multiple people can lie on furniture without specific spot assignments
3. Simpler implementation reduces complexity and potential race conditions
4. Component presence/absence is sufficient for action gating

## Requirements

### Functional Requirements

1. **Furniture Capability**: Furniture can be marked as allowing lying via the `positioning:allows_lying_on` component

2. **Actor State Tracking**: Actors lying on furniture have `positioning:lying_down` component tracking which furniture they're on

3. **Action Gating**: The `lying_down` component serves as a marker to:
   - Block actions that require standing/freedom of movement
   - Enable actions that specifically require lying down
   - Prevent conflicting positional states (sitting, bending, kneeling)

4. **Movement Control**: Lying locks movement; getting up unlocks it

5. **Clean State Transitions**: Getting up properly removes the lying state and restores mobility

### Non-Functional Requirements

1. **Consistency**: Follow existing positioning mod patterns and conventions
2. **Simplicity**: Minimize complexity compared to slot-based sitting
3. **Extensibility**: Allow future enhancements (e.g., lying with partners, closeness)
4. **Testability**: All components and actions must be unit and integration tested

## Component Definitions

### 1. `positioning:allows_lying_on` Component

**Purpose:** Marks furniture entities that can be lain upon (beds, couches, etc.)

**File:** `data/mods/positioning/components/allows_lying_on.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:allows_lying_on",
  "description": "Indicates that this furniture entity can be lain upon by actors",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

**Design Decisions:**
- Empty properties object - acts as a pure capability marker
- Similar to `allows_bending_over` component pattern
- No slot tracking needed

### 2. `positioning:lying_down` Component

**Purpose:** Tracks which furniture entity an actor is currently lying on

**File:** `data/mods/positioning/components/lying_down.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:lying_down",
  "description": "Tracks which furniture entity this actor is currently lying on",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["furniture_id"],
    "properties": {
      "furniture_id": {
        "description": "The furniture entity being lain upon",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      }
    }
  }
}
```

**Design Decisions:**
- Single `furniture_id` field to track reference
- No `spot_index` unlike `sitting_on` component
- Pattern matches `bending_over` component structure

## Action Definitions

### 1. `positioning:lie_down` Action

**Purpose:** Allow actor to lie down on available furniture

**File:** `data/mods/positioning/actions/lie_down.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:lie_down",
  "name": "Lie down",
  "description": "Lie down on available furniture",
  "targets": "positioning:available_lying_furniture",
  "required_components": {
    "actor": []
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:bending_over",
      "positioning:kneeling_before",
      "positioning:lying_down"
    ]
  },
  "template": "lie down on {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Design Decisions:**
- Forbidden components prevent lying while in other positional states
- `lying_down` is forbidden to prevent lying on multiple furniture simultaneously
- Brown color scheme (#bf360c) consistent with all positioning actions
- Template follows pattern: "{verb} on {target}"

### 2. `positioning:get_up_from_lying` Action

**Purpose:** Allow actor to get up from lying position

**File:** `data/mods/positioning/actions/get_up_from_lying.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:get_up_from_lying",
  "name": "Get up",
  "description": "Get up from the furniture you're lying on",
  "targets": "positioning:furniture_im_lying_on",
  "required_components": {
    "actor": ["positioning:lying_down"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "get up from {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Design Decisions:**
- Requires `lying_down` component - only available when lying
- Targets the specific furniture actor is lying on
- Template matches `get_up_from_furniture` pattern for consistency

## Scope Definitions

### 1. `positioning:available_lying_furniture` Scope

**Purpose:** Query all furniture in the actor's location that can be lain upon

**File:** `data/mods/positioning/scopes/available_lying_furniture.scope`

```
positioning:available_lying_furniture := entities(positioning:allows_lying_on)[][{
  "==": [
    {"var": "entity.components.core:position.locationId"},
    {"var": "actor.components.core:position.locationId"}
  ]
}]
```

**Design Decisions:**
- Filters for same location as actor
- Only includes entities with `allows_lying_on` component
- No availability checking (unlike sitting slots) - multiple actors can lie on same furniture

### 2. `positioning:furniture_im_lying_on` Scope

**Purpose:** Reference the specific furniture the actor is currently lying on

**File:** `data/mods/positioning/scopes/furniture_im_lying_on.scope`

```
positioning:furniture_im_lying_on := entities(positioning:allows_lying_on)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.positioning:lying_down.furniture_id"}
  ]
}]
```

**Design Decisions:**
- Matches furniture ID from actor's `lying_down` component
- Ensures target exists and still has `allows_lying_on` capability
- Pattern identical to `furniture_im_sitting_on` scope

## Condition Definitions

### 1. Event Detection: Lie Down

**File:** `data/mods/positioning/conditions/event-is-action-lie-down.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-lie-down",
  "description": "Checks if the event is attempting the 'Lie down' action.",
  "logic": {
    "==": [{"var": "event.payload.actionId"}, "positioning:lie_down"]
  }
}
```

### 2. Event Detection: Get Up From Lying

**File:** `data/mods/positioning/conditions/event-is-action-get-up-from-lying.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-get-up-from-lying",
  "description": "Checks if the event is attempting the 'Get up from lying' action.",
  "logic": {
    "==": [{"var": "event.payload.actionId"}, "positioning:get_up_from_lying"]
  }
}
```

## Rule Definitions

### 1. Handle Lie Down

**File:** `data/mods/positioning/rules/handle_lie_down.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_lie_down",
  "comment": "Handles the 'positioning:lie_down' action. Adds lying_down component, locks movement, dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-lie-down"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "furnitureName"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add lying_down component to actor",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:lying_down",
        "value": {
          "furniture_id": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "LOCK_MOVEMENT",
      "comment": "Lock movement while lying",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} lies down on {context.furnitureName}."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_self_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Design Decisions:**
- Pattern matches `bend_over.rule.json` closely
- ADD_COMPONENT creates lying state
- LOCK_MOVEMENT prevents actor from moving while lying
- Perception type is `action_self_general` matching marker-based pattern (bend_over)
- This indicates a self-directed positional change without modifying target entity state
- Uses standard success macro

### 2. Handle Get Up From Lying

**File:** `data/mods/positioning/rules/handle_get_up_from_lying.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_get_up_from_lying",
  "comment": "Handles the 'positioning:get_up_from_lying' action. Removes lying_down component, unlocks movement, dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-get-up-from-lying"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor's lying position info",
      "parameters": {
        "entity_ref": "{event.payload.actorId}",
        "component_type": "positioning:lying_down",
        "result_variable": "lyingInfo"
      }
    },
    {
      "type": "IF",
      "comment": "Only proceed if actor is actually lying down",
      "parameters": {
        "condition": {"!!": [{"var": "context.lyingInfo"}]},
        "then_actions": [
          {
            "type": "GET_NAME",
            "parameters": {
              "entity_ref": "actor",
              "result_variable": "actorName"
            }
          },
          {
            "type": "GET_NAME",
            "parameters": {
              "entity_ref": "target",
              "result_variable": "furnitureName"
            }
          },
          {
            "type": "QUERY_COMPONENT",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "core:position",
              "result_variable": "actorPosition"
            }
          },
          {
            "type": "REMOVE_COMPONENT",
            "comment": "Remove lying_down from actor",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:lying_down"
            }
          },
          {
            "type": "UNLOCK_MOVEMENT",
            "comment": "Restore movement capability",
            "parameters": {
              "actor_id": "{event.payload.actorId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} gets up from {context.furnitureName}."
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "perceptionType",
              "value": "action_self_general"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "locationId",
              "value": "{context.actorPosition.locationId}"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "targetId",
              "value": "{event.payload.targetId}"
            }
          },
          {
            "macro": "core:logSuccessAndEndTurn"
          }
        ],
        "else_actions": [
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "Actor is not lying down on anything."
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "perceptionType",
              "value": "error"
            }
          },
          {
            "macro": "core:logFailureAndEndTurn"
          }
        ]
      }
    }
  ]
}
```

**Design Decisions:**
- Pattern matches `straighten_up.rule.json` for defensive checking
- Validates actor is actually lying before proceeding
- REMOVE_COMPONENT clears lying state
- UNLOCK_MOVEMENT restores mobility
- Error handling for edge cases
- Uses standard success/failure macros

## Integration Points

### Action Gating via Components

The `positioning:lying_down` component enables sophisticated action control:

**Actions Blocked When Lying:**
- Any action with `"forbidden_components": {"actor": ["positioning:lying_down"]}`
- Examples: `positioning:sit_down`, `positioning:bend_over`, `positioning:kneel_before`
- Movement actions are blocked via LOCK_MOVEMENT

**Actions Enabled When Lying:**
- Any action with `"required_components": {"actor": ["positioning:lying_down"]}`
- Examples: Future intimate actions that require lying, sleeping actions, etc.

**Example Integration in Other Actions:**

```json
{
  "id": "some_mod:intimate_action_requiring_lying",
  "required_components": {
    "actor": ["positioning:lying_down"]
  }
}
```

```json
{
  "id": "some_mod:action_requiring_standing",
  "forbidden_components": {
    "actor": ["positioning:lying_down", "positioning:sitting_on", "positioning:bending_over"]
  }
}
```

### Movement Locking

The lying system integrates with the core movement locking mechanism:

1. **Lie Down** → LOCK_MOVEMENT prevents actor from changing location
2. **Get Up** → UNLOCK_MOVEMENT restores location change capability
3. Other systems can check movement lock state to determine actor mobility

### Future Enhancements (Not Included in Initial Implementation)

**Potential Closeness Integration:**
- Similar to `ESTABLISH_SITTING_CLOSENESS` operation
- Could add `ESTABLISH_LYING_CLOSENESS` for actors lying on same furniture
- Would track partners lying together for relationship/intimacy actions

**Potential Slot System (If Needed Later):**
- If precise positioning becomes important (e.g., left/right side of bed)
- Could migrate to hybrid approach with optional slot tracking
- Not recommended unless gameplay explicitly requires it

## Testing Strategy

### Unit Tests

**Component Tests:**
```javascript
// tests/unit/mods/positioning/components/allows_lying_on.test.js
// tests/unit/mods/positioning/components/lying_down.test.js
```
- Schema validation
- Component structure verification
- Data integrity checks

**Action Tests:**
```javascript
// tests/unit/mods/positioning/actions/lie_down.test.js
// tests/unit/mods/positioning/actions/get_up_from_lying.test.js
```
- Action definition validation
- Required/forbidden component verification
- Visual properties validation
- Target scope references

**Scope Tests:**
```javascript
// tests/unit/mods/positioning/scopes/available_lying_furniture.test.js
// tests/unit/mods/positioning/scopes/furniture_im_lying_on.test.js
```
- Scope query logic validation
- JSON Logic correctness
- Filter criteria verification

**Condition Tests:**
```javascript
// tests/unit/mods/positioning/conditions/event-is-action-lie-down.test.js
// tests/unit/mods/positioning/conditions/event-is-action-get-up-from-lying.test.js
```
- Event type matching
- Logic validation

### Integration Tests

**Workflow Tests:**
```javascript
// tests/integration/mods/positioning/lie_down_action.test.js
describe('Lie Down Action Integration', () => {
  it('should successfully lie down on available furniture', () => {
    // 1. Create actor and furniture in same location
    // 2. Add allows_lying_on to furniture
    // 3. Discover lie_down action
    // 4. Execute action
    // 5. Verify lying_down component added
    // 6. Verify movement locked
    // 7. Verify perception event dispatched
  });

  it('should not allow lying when already lying', () => {
    // Verify forbidden_components prevents double lying
  });

  it('should not allow lying when sitting', () => {
    // Verify forbidden_components prevents lying while sitting
  });

  it('should not allow lying when bending', () => {
    // Verify forbidden_components prevents lying while bending
  });
});
```

```javascript
// tests/integration/mods/positioning/get_up_from_lying_action.test.js
describe('Get Up From Lying Action Integration', () => {
  it('should successfully get up from furniture', () => {
    // 1. Set up actor lying on furniture
    // 2. Execute get_up action
    // 3. Verify lying_down component removed
    // 4. Verify movement unlocked
    // 5. Verify perception event dispatched
  });

  it('should handle getting up when not lying gracefully', () => {
    // Test error path in rule
  });
});
```

**Complete Workflow Test:**
```javascript
// tests/integration/mods/positioning/lying_workflow.test.js
describe('Complete Lying Workflow', () => {
  it('should handle lie down → get up cycle', () => {
    // Full workflow from standing → lying → standing
  });

  it('should prevent other positional actions while lying', () => {
    // Verify sitting, bending, kneeling are blocked
  });

  it('should restore full action availability after getting up', () => {
    // Verify all actions available again
  });
});
```

**Cross-System Integration:**
```javascript
// tests/integration/positioning/movement_lock_integration.test.js
describe('Movement Lock Integration', () => {
  it('should prevent movement while lying', () => {
    // Verify LOCK_MOVEMENT prevents location changes
  });

  it('should restore movement after getting up', () => {
    // Verify UNLOCK_MOVEMENT enables location changes
  });
});
```

### Edge Case Tests

**Concurrency:**
- Multiple actors lying on same furniture simultaneously (should work)
- Actor trying to lie on furniture that no longer exists
- Furniture losing `allows_lying_on` while actor is lying

**State Conflicts:**
- Attempting to sit while lying
- Attempting to lie while sitting
- Attempting to bend while lying

**Data Integrity:**
- Getting up from furniture that was deleted
- Actor with `lying_down` component but furniture_id references non-existent entity
- Movement lock/unlock state consistency

## Implementation Checklist

### Phase 1: Component Creation
- [ ] Create `allows_lying_on.component.json`
- [ ] Create `lying_down.component.json`
- [ ] Write component unit tests

### Phase 2: Scope Creation
- [ ] Create `available_lying_furniture.scope`
- [ ] Create `furniture_im_lying_on.scope`
- [ ] Write scope unit tests
- [ ] Run `npm run scope:lint` to validate

### Phase 3: Action Creation
- [ ] Create `lie_down.action.json`
- [ ] Create `get_up_from_lying.action.json`
- [ ] Write action unit tests

### Phase 4: Condition Creation
- [ ] Create `event-is-action-lie-down.condition.json`
- [ ] Create `event-is-action-get-up-from-lying.condition.json`
- [ ] Write condition unit tests

### Phase 5: Rule Creation
- [ ] Create `handle_lie_down.rule.json`
- [ ] Create `handle_get_up_from_lying.rule.json`
- [ ] Write rule unit tests

### Phase 6: Integration Testing
- [ ] Write lie down action integration tests
- [ ] Write get up action integration tests
- [ ] Write complete workflow integration tests
- [ ] Write movement lock integration tests
- [ ] Write edge case tests

### Phase 7: Validation & Documentation
- [ ] Run all tests and verify >80% coverage
- [ ] Run `npm run lint` and fix any issues
- [ ] Run `npm run typecheck` and fix any issues
- [ ] Manually test in-game
- [ ] Update mod documentation if needed

## File Summary

**Components (2 files):**
1. `data/mods/positioning/components/allows_lying_on.component.json`
2. `data/mods/positioning/components/lying_down.component.json`

**Actions (2 files):**
1. `data/mods/positioning/actions/lie_down.action.json`
2. `data/mods/positioning/actions/get_up_from_lying.action.json`

**Scopes (2 files):**
1. `data/mods/positioning/scopes/available_lying_furniture.scope`
2. `data/mods/positioning/scopes/furniture_im_lying_on.scope`

**Conditions (2 files):**
1. `data/mods/positioning/conditions/event-is-action-lie-down.condition.json`
2. `data/mods/positioning/conditions/event-is-action-get-up-from-lying.condition.json`

**Rules (2 files):**
1. `data/mods/positioning/rules/handle_lie_down.rule.json`
2. `data/mods/positioning/rules/handle_get_up_from_lying.rule.json`

**Total: 10 new mod files**

## References

### Existing Code Patterns

**Marker-Based Component Pattern:**
- `positioning:allows_bending_over` - Simple capability marker
- `positioning:bending_over` - Actor state with entity reference

**Slot-Based Component Pattern (For Comparison):**
- `positioning:allows_sitting` - Furniture with spots array
- `positioning:sitting_on` - Actor state with furniture_id + spot_index

**Action Patterns:**
- `positioning:bend_over` - Simple action with target
- `positioning:sit_down` - Action with slot allocation
- `positioning:get_up_from_furniture` - Reversal action with cleanup

**Rule Patterns:**
- `handle_bend_over` - ADD_COMPONENT + LOCK_MOVEMENT
- `handle_sit_down` - ATOMIC_MODIFY_COMPONENT + ADD_COMPONENT
- `handle_get_up_from_furniture` - Spot clearing + REMOVE_COMPONENT
- `handle_straighten_up` - REMOVE_COMPONENT + UNLOCK_MOVEMENT

**Scope Patterns:**
- `available_surfaces` - Same location filter
- `available_furniture` - Same location + availability check
- `furniture_im_sitting_on` - Component reference match

## Appendix: Design Comparisons

### Why Not Use Slots Like Sitting?

**Sitting Advantages:**
- Precise positional tracking (spot 0, 1, 2)
- Concurrent access control via ATOMIC_MODIFY_COMPONENT
- Prevents overbooking of limited spots

**Sitting Disadvantages:**
- Complex rule logic with multiple IF branches
- Requires atomic operations for thread safety
- Limited to predefined spot count (max 10)
- Harder to maintain and debug

**Lying Advantages:**
- Simpler implementation
- No concurrency concerns
- Unlimited capacity (realistic for beds)
- Easier to test and maintain
- Clear, readable rules

**Lying Trade-offs:**
- No precise positional tracking (left/right side)
- Can't limit capacity (but rarely needed for beds)
- No automatic partner detection (but can be added via closeness)

**Conclusion:** Marker-based approach is superior for lying because:
1. Gameplay doesn't require precise positioning on beds
2. Multiple people lying on furniture is acceptable
3. Simpler code is more maintainable
4. Can add closeness system later if partner tracking needed
