# Specification: Sit on Lap from Sitting Position Actions

## Overview

This specification defines new positioning actions that allow a sitting actor to transition from sitting on furniture to sitting on another sitting actor's lap. These actions are distinct from the existing `straddle_waist_facing` and `straddle_waist_facing_away` actions, which require the actor to be standing.

### Key Distinction from Existing Straddling Actions

| Aspect | Existing Actions | New Actions |
|--------|------------------|-------------|
| **Actor Initial State** | Standing close to target | Sitting close to target |
| **Actor Required Components** | `positioning:closeness` | `positioning:sitting_on`, `positioning:closeness` |
| **Critical Behavior** | Actor has no `sitting_on` to remove | **Actor's `sitting_on` MUST be removed** |
| **Target Scope** | `positioning:actors_sitting_close` | `positioning:actors_both_sitting_close` (NEW) |
| **Templates** | "sit on {target}'s lap (facing away/face-to-face)" | Same templates |

## Motivation

The existing straddling actions work well for scenarios where an actor approaches a sitting target from a standing position. However, they cannot handle scenarios where both actors are already sitting (e.g., sitting next to each other on a couch or in adjacent chairs). This creates a gap in the positioning system's expressiveness.

These new actions fill that gap by allowing an actor who is already sitting to transition smoothly onto another sitting actor's lap, removing the constraint that binds them to their furniture.

## New Game Content Required

### 1. Actions

#### Action: `positioning:sit_on_lap_from_sitting_facing_away`

**File**: `data/mods/positioning/actions/sit_on_lap_from_sitting_facing_away.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:sit_on_lap_from_sitting_facing_away",
  "name": "Sit on Lap from Sitting (Facing Away)",
  "description": "Transition from sitting on furniture to sitting on another sitting actor's lap while facing away from them",
  "targets": {
    "primary": {
      "scope": "positioning:actors_both_sitting_close",
      "placeholder": "target",
      "description": "Sitting actor to sit on"
    }
  },
  "required_components": {
    "actor": ["positioning:sitting_on", "positioning:closeness"],
    "primary": ["positioning:sitting_on", "positioning:closeness"]
  },
  "template": "sit on {target}'s lap (facing away)",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-mouth-available"
      },
      "failure_message": "You cannot do that while your mouth is engaged."
    }
  ],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

#### Action: `positioning:sit_on_lap_from_sitting_facing`

**File**: `data/mods/positioning/actions/sit_on_lap_from_sitting_facing.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:sit_on_lap_from_sitting_facing",
  "name": "Sit on Lap from Sitting (Facing)",
  "description": "Transition from sitting on furniture to sitting on another sitting actor's lap while facing them",
  "targets": {
    "primary": {
      "scope": "positioning:actors_both_sitting_close",
      "placeholder": "target",
      "description": "Sitting actor to sit on"
    }
  },
  "required_components": {
    "actor": ["positioning:sitting_on", "positioning:closeness"],
    "primary": ["positioning:sitting_on", "positioning:closeness"]
  },
  "template": "sit on {target}'s lap (face-to-face)",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-mouth-available"
      },
      "failure_message": "You cannot do that while your mouth is engaged."
    }
  ],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

### 2. Scope

#### Scope: `positioning:actors_both_sitting_close`

**File**: `data/mods/positioning/scopes/actors_both_sitting_close.scope`

**Purpose**: Filters the actor's closeness partners to only include those where BOTH the actor AND the partner have the `sitting_on` component. This ensures both entities are sitting before allowing the transition.

**Scope DSL Definition**:

```
positioning:actors_both_sitting_close := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "entity.components.positioning:sitting_on"}},
    {"!!": {"var": "actor.components.positioning:sitting_on"}}
  ]
}]
```

**Logic Explanation**:
1. Start with `actor.components.positioning:closeness.partners[]` - get all close partners
2. Filter using JSON Logic: `{"and": [...]}`
   - `{"!!": {"var": "entity.components.positioning:sitting_on"}}` - partner must have `sitting_on`
   - `{"!!": {"var": "actor.components.positioning:sitting_on"}}` - actor must have `sitting_on`
3. Result: Set of partner IDs where both actors are sitting

**Comparison with Existing Scope**:
- `positioning:actors_sitting_close`: Only checks if partner is sitting
- `positioning:actors_both_sitting_close`: Checks if BOTH actor and partner are sitting

### 3. Rules

#### Rule: `handle_sit_on_lap_from_sitting_facing_away`

**File**: `data/mods/positioning/rules/handle_sit_on_lap_from_sitting_facing_away.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_sit_on_lap_from_sitting_facing_away",
  "comment": "Handles the 'positioning:sit_on_lap_from_sitting_facing_away' action. REMOVES sitting_on from actor, adds straddling_waist component with facing_away=true, adds facing_away component, locks movement, and dispatches actor_turned_back event.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-sit-on-lap-from-sitting-facing-away"
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
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
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
      "comment": "CRITICAL: Remove actor's sitting_on component as they're no longer sitting on furniture",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:sitting_on"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add straddling_waist component with facing_away=true",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "value": {
          "target_id": "{event.payload.targetId}",
          "facing_away": true
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add facing_away component to track which entity actor is facing away from",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:facing_away",
        "value": {
          "facing_away_from": ["{event.payload.targetId}"]
        }
      }
    },
    {
      "type": "LOCK_MOVEMENT",
      "comment": "Lock movement while straddling",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Dispatch event indicating actor has turned their back to target",
      "parameters": {
        "eventType": "positioning:actor_turned_back",
        "payload": {
          "actor": "{event.payload.actorId}",
          "target": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} sits on {context.targetName}'s lap (facing away)."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
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

#### Rule: `handle_sit_on_lap_from_sitting_facing`

**File**: `data/mods/positioning/rules/handle_sit_on_lap_from_sitting_facing.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_sit_on_lap_from_sitting_facing",
  "comment": "Handles the 'positioning:sit_on_lap_from_sitting_facing' action. REMOVES sitting_on from actor, adds straddling_waist component with facing_away=false, locks movement.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-sit-on-lap-from-sitting-facing"
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
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
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
      "comment": "CRITICAL: Remove actor's sitting_on component as they're no longer sitting on furniture",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:sitting_on"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add straddling_waist component with facing orientation",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "value": {
          "target_id": "{event.payload.targetId}",
          "facing_away": false
        }
      }
    },
    {
      "type": "LOCK_MOVEMENT",
      "comment": "Lock movement while straddling",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} sits on {context.targetName}'s lap (face-to-face)."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
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

### 4. Conditions

#### Condition: `event-is-action-sit-on-lap-from-sitting-facing-away`

**File**: `data/mods/positioning/conditions/event-is-action-sit-on-lap-from-sitting-facing-away.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-sit-on-lap-from-sitting-facing-away",
  "description": "Checks if the event is an attempt_action for sit_on_lap_from_sitting_facing_away",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:sit_on_lap_from_sitting_facing_away"
    ]
  }
}
```

#### Condition: `event-is-action-sit-on-lap-from-sitting-facing`

**File**: `data/mods/positioning/conditions/event-is-action-sit-on-lap-from-sitting-facing.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-sit-on-lap-from-sitting-facing",
  "description": "Checks if the event is an attempt_action for sit_on_lap_from_sitting_facing",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:sit_on_lap_from_sitting_facing"
    ]
  }
}
```

## Testing Requirements

### Testing Methodology

All tests should follow the patterns established in the Living Narrative Engine test suite:

1. **Use ModTestFixture Pattern**: Follow `docs/testing/mod-testing-guide.md`
2. **Use ModEntityBuilder**: For creating test entities with fluent API
3. **Reference Existing Tests**: Use these as templates:
   - `tests/integration/mods/positioning/straddle_waist_facing_action.test.js`
   - `tests/integration/mods/positioning/straddle_waist_facing_action_discovery.test.js`

### Test Files Required

#### 1. Action Discovery Tests

**File**: `tests/integration/mods/positioning/sit_on_lap_from_sitting_facing_away_action_discovery.test.js`

**Purpose**: Prove that `positioning:sit_on_lap_from_sitting_facing_away` action is discoverable under correct conditions.

**Test Cases**:

```javascript
describe('sit_on_lap_from_sitting_facing_away action discovery', () => {
  // POSITIVE CASES

  it('should discover action when both actor and target are sitting and close', () => {
    // Setup: Actor sitting, target sitting, both close
    // Assert: Action appears in available actions
  });

  it('should discover action for multiple sitting close targets', () => {
    // Setup: Actor sitting, multiple sitting close targets
    // Assert: Action appears for each valid target
  });

  // NEGATIVE CASES

  it('should NOT discover action when actor is standing', () => {
    // Setup: Actor standing (no sitting_on), target sitting and close
    // Assert: Action does NOT appear
  });

  it('should NOT discover action when target is standing', () => {
    // Setup: Actor sitting, target standing (no sitting_on)
    // Assert: Action does NOT appear
  });

  it('should NOT discover action when actors are not close', () => {
    // Setup: Actor sitting, target sitting, NOT close (no closeness relationship)
    // Assert: Action does NOT appear
  });

  it('should NOT discover action when only actor has sitting_on', () => {
    // Setup: Actor sitting, target close but no sitting_on
    // Assert: Action does NOT appear (scope filters out)
  });

  it('should NOT discover action when actor mouth is engaged', () => {
    // Setup: Actor sitting and close to sitting target, but mouth engaged
    // Assert: Action prerequisite fails, action not available
  });
});
```

**File**: `tests/integration/mods/positioning/sit_on_lap_from_sitting_facing_action_discovery.test.js`

**Purpose**: Same as above but for face-to-face variant.

**Test Cases**: Mirror the facing_away tests with face-to-face action ID.

#### 2. Action Execution Tests

**File**: `tests/integration/mods/positioning/sit_on_lap_from_sitting_facing_away_action.test.js`

**Purpose**: Verify correct behavior when `positioning:sit_on_lap_from_sitting_facing_away` action executes.

**Test Cases**:

```javascript
describe('sit_on_lap_from_sitting_facing_away - Action Execution', () => {
  // COMPONENT MANIPULATION

  it('should remove sitting_on component from actor', () => {
    // Setup: Actor sitting on chair, target sitting on different chair, both close
    // Execute: Action
    // Assert: Actor no longer has sitting_on component
  });

  it('should add straddling_waist component with facing_away=true', () => {
    // Setup: Standard scenario
    // Execute: Action
    // Assert: Actor has straddling_waist with target_id and facing_away=true
  });

  it('should add facing_away component to actor', () => {
    // Setup: Standard scenario
    // Execute: Action
    // Assert: Actor has facing_away component with target in facing_away_from array
  });

  it('should keep target sitting_on component unchanged', () => {
    // Setup: Target sitting on chair
    // Execute: Action
    // Assert: Target still has sitting_on pointing to original chair
  });

  // MOVEMENT AND STATE

  it('should lock actor movement', () => {
    // Setup: Standard scenario
    // Execute: Action
    // Assert: Movement lock applied (verify through successful action completion)
  });

  it('should dispatch actor_turned_back event', () => {
    // Setup: Standard scenario
    // Execute: Action
    // Assert: positioning:actor_turned_back event dispatched with correct payload
  });

  // OUTPUT VALIDATION

  it('should generate correct log message', () => {
    // Setup: Actor "Alice", target "Bob"
    // Execute: Action
    // Assert: Message is "Alice sits on Bob's lap (facing away)."
  });

  it('should dispatch successful action result event', () => {
    // Setup: Standard scenario
    // Execute: Action
    // Assert: core:display_successful_action_result event dispatched
  });

  // EDGE CASES

  it('should handle actor transitioning from same furniture as target', () => {
    // Setup: Both actors sitting on same couch (different spot indexes)
    // Execute: Action
    // Assert: Actor sitting_on removed, straddling_waist added
  });

  it('should handle actor transitioning from different furniture', () => {
    // Setup: Actor on chair, target on couch
    // Execute: Action
    // Assert: Correct component changes
  });
});
```

**File**: `tests/integration/mods/positioning/sit_on_lap_from_sitting_facing_action.test.js`

**Purpose**: Same as above but for face-to-face variant.

**Test Cases**: Mirror the facing_away tests with these differences:
- `straddling_waist.facing_away` should be `false`
- NO `facing_away` component should be added
- NO `actor_turned_back` event should be dispatched
- Log message should say "face-to-face" instead of "facing away"

#### 3. Integration Tests for Scope

**File**: `tests/integration/mods/positioning/actors_both_sitting_close_scope.test.js`

**Purpose**: Verify the `positioning:actors_both_sitting_close` scope correctly filters partners.

**Test Cases**:

```javascript
describe('actors_both_sitting_close scope', () => {
  it('should return partners where both actor and partner are sitting', () => {
    // Setup: Actor sitting, two close partners (one sitting, one standing)
    // Assert: Scope returns only the sitting partner
  });

  it('should return empty set when actor is not sitting', () => {
    // Setup: Actor standing, close partners sitting
    // Assert: Scope returns empty set
  });

  it('should return empty set when no partners are sitting', () => {
    // Setup: Actor sitting, close partners all standing
    // Assert: Scope returns empty set
  });

  it('should return all sitting close partners', () => {
    // Setup: Actor sitting, three close partners all sitting
    // Assert: Scope returns all three partners
  });
});
```

#### 4. End-to-End Workflow Tests

**File**: `tests/integration/mods/positioning/sit_on_lap_workflow.test.js`

**Purpose**: Test complete workflows involving the new actions.

**Test Cases**:

```javascript
describe('Sit on Lap from Sitting - Workflow Integration', () => {
  it('should allow complete workflow: sit down -> sit on lap -> dismount', () => {
    // Setup: Actor standing, target sitting
    // Execute: Actor sits down -> actor sits on target's lap -> actor dismounts
    // Assert: Each transition works correctly
  });

  it('should prevent movement while sitting on lap', () => {
    // Setup: Actor sitting on target's lap
    // Execute: Attempt to move
    // Assert: Movement prevented by lock
  });

  it('should allow switching from facing away to facing', () => {
    // Setup: Actor sitting on lap facing away
    // Execute: Turn around action (if exists)
    // Assert: Orientation changes correctly
  });

  it('should handle both actors sitting on same furniture', () => {
    // Setup: Two actors on same couch
    // Execute: One sits on the other's lap
    // Assert: Correct furniture spot management
  });
});
```

### Test Implementation Guidelines

1. **Setup Pattern**: Use `ModEntityBuilder` to create entities with appropriate components
   ```javascript
   const actor = new ModEntityBuilder('test:actor1')
     .withName('Alice')
     .atLocation('room1')
     .closeToEntity('test:target1')
     .asActor()
     .withComponent('positioning:sitting_on', {
       furniture_id: 'test:chair1',
       spot_index: 0
     })
     .build();
   ```

2. **Scope Resolution**: Implement test-specific scope resolver since `ModTestFixture.forAction()` doesn't load .scope files
   ```javascript
   testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
     if (scopeName === 'positioning:actors_both_sitting_close') {
       // Custom resolution logic
     }
     return originalResolveSync.call(testEnv.unifiedScopeResolver, scopeName, context);
   };
   ```

3. **Action Discovery**: Configure action index with action JSON
   ```javascript
   testEnv.actionIndex.buildIndex([sitOnLapFromSittingAction]);
   ```

4. **Assertions**: Verify component state changes
   ```javascript
   expect(actor.components['positioning:sitting_on']).toBeUndefined();
   expect(actor.components['positioning:straddling_waist']).toBeDefined();
   expect(actor.components['positioning:straddling_waist'].target_id).toBe('test:target1');
   ```

### Test Coverage Goals

- **Discovery Tests**: 100% coverage of valid/invalid scenarios
- **Execution Tests**: All component mutations verified
- **Integration Tests**: Common workflows validated
- **Edge Cases**: Furniture sharing, closeness boundaries, state transitions

## Implementation Order

### Phase 1: Core Content
1. Create new scope: `actors_both_sitting_close.scope`
2. Create new conditions (2 files)
3. Create new actions (2 files)
4. Create new rules (2 files)

### Phase 2: Testing
1. Implement scope integration tests
2. Implement action discovery tests (2 files)
3. Implement action execution tests (2 files)
4. Implement workflow integration tests

### Phase 3: Validation
1. Run all tests and verify 100% pass rate
2. Manual gameplay testing
3. Update mod manifest if needed
4. Documentation review

## Success Criteria

1. ✅ Both new actions are discoverable when both actors sitting and close
2. ✅ Actions are NOT discoverable when conditions not met
3. ✅ Actor's `sitting_on` component correctly removed on execution
4. ✅ `straddling_waist` component correctly added with proper orientation
5. ✅ Target's `sitting_on` component remains unchanged
6. ✅ Movement correctly locked for actor
7. ✅ Events correctly dispatched (including `actor_turned_back` for facing_away)
8. ✅ Log messages display correctly
9. ✅ All tests pass with 100% coverage of specified scenarios
10. ✅ Integration with existing positioning system (dismount, turn around, etc.)

## References

### Existing Files to Reference
- `data/mods/positioning/actions/straddle_waist_facing.action.json`
- `data/mods/positioning/actions/straddle_waist_facing_away.action.json`
- `data/mods/positioning/rules/straddle_waist_facing.rule.json`
- `data/mods/positioning/rules/straddle_waist_facing_away.rule.json`
- `data/mods/positioning/scopes/actors_sitting_close.scope`
- `tests/integration/mods/positioning/straddle_waist_facing_action.test.js`
- `tests/integration/mods/positioning/straddle_waist_facing_action_discovery.test.js`

### Documentation
- `docs/testing/mod-testing-guide.md` - Testing methodology
- `CLAUDE.md` - Project conventions and patterns
- Component schemas in `data/schemas/`

## Notes for Implementers

1. **Critical Reminder**: The REMOVE_COMPONENT operation for `sitting_on` is what distinguishes these actions from the existing straddling actions. Do not forget this step.

2. **Scope Complexity**: The new scope requires checking BOTH actor and partner for `sitting_on`. This is different from existing scopes that only check one entity.

3. **Target Integrity**: The target should remain completely unchanged except for potential closeness/relationship updates. Their `sitting_on` component must persist.

4. **Test Scope Resolution**: Remember that `ModTestFixture.forAction()` doesn't load .scope files, so tests must implement custom scope resolution.

5. **Visual Consistency**: Use the same visual properties (brown background) as existing straddling actions for UI consistency.

6. **Prerequisite Alignment**: Maintain the same prerequisites (mouth available) as existing straddling actions for behavioral consistency.

7. **Dismount Compatibility**: Ensure these new actions produce state compatible with existing `dismount_from_straddling` action.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-20
**Status**: Ready for Implementation
