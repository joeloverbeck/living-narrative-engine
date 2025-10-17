# Scoot Closer Action Specification

## Overview

This specification defines a new action/rule combination that allows actors sitting on furniture to move one spot closer to another occupant seated to their left. This feature complements the existing `sit_down` and `sit_down_at_distance` actions by providing a way for actors to reduce the physical gap after initially sitting with distance.

## Motivation

The positioning mod currently supports:
- **`sit_down`**: Sits as close as possible to the leftmost person (immediate adjacency)
- **`sit_down_at_distance`**: Sits with a one-seat buffer from a selected occupant

However, there's no mechanism for an actor who has sat at a distance to subsequently move closer. The `scoot_closer` action fills this gap, enabling dynamic social proximity adjustments.

## System Context

### Existing Components Referenced

#### Actions
- `data/mods/positioning/actions/sit_down.action.json`
- `data/mods/positioning/actions/sit_down_at_distance.action.json`

#### Scopes
- `data/mods/positioning/scopes/actors_sitting_with_space_to_right.scope`
- `positioning:available_furniture` (defined elsewhere in positioning mod)

#### Operators
- `src/logic/operators/hasSittingSpaceToRightOperator.js`
- `src/logic/operators/base/BaseFurnitureOperator.js` (provides utility methods like `isSittingOn()` for operators, not Scope DSL)

#### Components
- `positioning:sitting_on` - Tracks actor's furniture and spot index
- `positioning:allows_sitting` - Defines furniture spots array
- `positioning:close_to` - Represents closeness relationship between actors
- `core:movement` - Controls movement locking

## Detailed Design

### 1. Action Definition

**File**: `data/mods/positioning/actions/scoot_closer.action.json`

**Schema**: `schema://living-narrative-engine/action.schema.json`

**Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:scoot_closer",
  "name": "Scoot Closer",
  "description": "Move one seat closer to an adjacent occupant on the same furniture",
  "targets": {
    "primary": {
      "scope": "positioning:furniture_actor_sitting_on",
      "placeholder": "seat",
      "description": "Furniture where the actor is currently sitting"
    },
    "secondary": {
      "scope": "positioning:closest_leftmost_occupant",
      "placeholder": "occupant",
      "contextFrom": "primary",
      "description": "The closest occupant to the actor's left"
    }
  },
  "required_components": {
    "actor": ["positioning:sitting_on"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "scoot closer to {occupant} on {seat}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Rationale**:
- **Multi-target design**: Follows the pattern established by `sit_down_at_distance`
- **Primary target**: The furniture itself (actor must be sitting on it)
- **Secondary target**: The specific occupant to scoot toward
- **Required component**: `positioning:sitting_on` ensures actor is seated
- **Template**: Clear, natural language matching existing patterns

### 2. Custom JSON Logic Operator

**File**: `src/logic/operators/canScootCloserOperator.js`

**Purpose**: Validates whether an actor can scoot closer on specific furniture

**Class**: `CanScootCloserOperator extends BaseFurnitureOperator`

**Operator Signature**:
```javascript
{"canScootCloser": ["entity", "target"]}
```

**Validation Logic**:
```javascript
/**
 * @class CanScootCloserOperator
 * @augments BaseFurnitureOperator
 * @description Checks if an actor can move one spot to the left on furniture
 *
 * Validation steps:
 * 1. Verify entity is sitting on target furniture
 * 2. Verify entity's spot_index > 0 (not leftmost)
 * 3. Verify spot to the left (spot_index - 1) is empty
 * 4. Verify there's at least one occupied spot further left (to scoot toward)
 * 5. Verify no gaps between entity and leftmost occupant
 */
```

**Implementation Details**:

```javascript
evaluateInternal(entityId, targetId, params, context) {
  // Step 1: Validate entity is sitting
  const sittingOn = this.getSittingOnData(entityId);
  if (!sittingOn) {
    return false;
  }

  // Step 2: Validate sitting on target furniture
  if (sittingOn.furniture_id !== targetId) {
    return false;
  }

  // Step 3: Get furniture spots configuration
  const { spots, isValid } = this.getFurnitureSpots(targetId);
  if (!isValid) {
    return false;
  }

  const currentIndex = sittingOn.spot_index;

  // Step 4: Validate not in leftmost position
  if (currentIndex <= 0) {
    return false;
  }

  // Step 5: Validate spot to the left is empty
  if (spots[currentIndex - 1] !== null) {
    return false;
  }

  // Step 6: Find closest occupant to the left
  let hasOccupantToLeft = false;
  for (let i = currentIndex - 2; i >= 0; i--) {
    if (spots[i] !== null) {
      hasOccupantToLeft = true;
      break;
    }
  }

  // Step 7: Validate there's an occupant to scoot toward
  if (!hasOccupantToLeft) {
    return false;
  }

  // Step 8: Validate no gaps between entity and leftmost occupant
  // (All spots between entity and first occupied spot to left must be empty)
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (spots[i] !== null) {
      // Found the closest occupant - verify continuity
      // All spots between i and currentIndex should be empty
      for (let j = i + 1; j < currentIndex; j++) {
        if (spots[j] !== null) {
          return false; // Gap detected
        }
      }
      break;
    }
  }

  return true;
}
```

**Error Handling**:
- Invalid furniture ID → return `false`
- Missing `sitting_on` component → return `false`
- Out-of-bounds spot_index → return `false`
- Invalid spots array → return `false`

**Logging**:
- Debug logs for each validation step
- Warnings for invalid states (spot_index mismatch, etc.)

### 3. Scope Definitions

#### 3.1 Furniture Actor Sitting On Scope

**File**: `data/mods/positioning/scopes/furniture_actor_sitting_on.scope`

**Purpose**: Returns the furniture entity where the actor is currently sitting

**Scope DSL**:
```
positioning:furniture_actor_sitting_on := entities(positioning:allows_sitting)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.positioning:sitting_on.furniture_id"}
  ]
}]
```

**Logic**:
1. Get all furniture entities with `positioning:allows_sitting` component
2. Use `[]` operator to iterate over entities
3. Filter to only furniture where entity.id matches actor's sitting_on.furniture_id
4. Returns single furniture entity or empty set

**Note**: Uses standard Scope DSL operators - no custom operator needed.

#### 3.2 Closest Leftmost Occupant Scope

**File**: `data/mods/positioning/scopes/closest_leftmost_occupant.scope`

**Purpose**: Finds the closest occupant to the actor's left on the same furniture

**Scope DSL**:
```
positioning:closest_leftmost_occupant := entities(core:actor)[{
  "isClosestLeftOccupant": ["entity", "target", "actor"]
}]
```

**Custom Operator Required**: `isClosestLeftOccupant`

**Operator Logic**:
```javascript
/**
 * Finds the closest occupant to the left of the actor on target furniture
 *
 * Algorithm:
 * 1. Get actor's spot_index on target furniture
 * 2. Iterate from (spot_index - 1) down to 0
 * 3. Return first non-null entity encountered
 * 4. Return false if gap detected before finding occupant
 */
isClosestLeftOccupant(candidateId, furnitureId, actorId) {
  // Get actor's sitting position
  const actorSitting = this.getSittingOnData(actorId);
  if (!actorSitting || actorSitting.furniture_id !== furnitureId) {
    return false;
  }

  // Get candidate's sitting position
  const candidateSitting = this.getSittingOnData(candidateId);
  if (!candidateSitting || candidateSitting.furniture_id !== furnitureId) {
    return false;
  }

  const actorIndex = actorSitting.spot_index;
  const candidateIndex = candidateSitting.spot_index;

  // Candidate must be to the left of actor
  if (candidateIndex >= actorIndex) {
    return false;
  }

  // Get furniture spots
  const { spots, isValid } = this.getFurnitureSpots(furnitureId);
  if (!isValid) {
    return false;
  }

  // Find closest occupant to the left
  for (let i = actorIndex - 1; i >= 0; i--) {
    if (spots[i] !== null) {
      // Found closest occupant
      return spots[i] === candidateId;
    }
  }

  return false;
}
```

### 4. Rule Definition

**File**: `data/mods/positioning/rules/handle_scoot_closer.rule.json`

**Rule ID**: `handle_scoot_closer`

**Event Type**: `core:attempt_action`

**Condition**: `positioning:event-is-action-scoot-closer`

**Action Sequence**:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_scoot_closer",
  "comment": "Handles positioning:scoot_closer action - moves actor one seat to the left",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-scoot-closer"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get current furniture spots array",
      "parameters": {
        "entity_ref": "target",
        "component_type": "positioning:allows_sitting",
        "result_variable": "furnitureData"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get actor's current sitting position",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:sitting_on",
        "result_variable": "actorSittingData"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Extract current spot index",
      "parameters": {
        "variable_name": "currentIndex",
        "value": "{context.actorSittingData.spot_index}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Calculate new spot index (current - 1)",
      "parameters": {
        "variable_name": "newIndex",
        "value": {"-": [{"var": "context.currentIndex"}, 1]}
      }
    },
    {
      "type": "IF",
      "comment": "Validate new index is valid and spot is empty",
      "parameters": {
        "condition": {
          "and": [
            {">=": [{"var": "context.newIndex"}, 0]},
            {
              "===": [
                {
                  "var": {
                    "cat": ["context.furnitureData.spots.", {"var": "context.newIndex"}]
                  }
                },
                null
              ]
            }
          ]
        },
        "then_actions": [
          {
            "type": "ATOMIC_MODIFY_COMPONENT",
            "comment": "Free the current spot",
            "parameters": {
              "entity_ref": "target",
              "component_type": "positioning:allows_sitting",
              "field": {"cat": ["spots.", {"var": "context.currentIndex"}]},
              "expected_value": "{event.payload.actorId}",
              "new_value": null,
              "result_variable": "spotFreed"
            }
          },
          {
            "type": "IF",
            "comment": "Proceed only if spot was freed successfully",
            "parameters": {
              "condition": {"var": "context.spotFreed"},
              "then_actions": [
                {
                  "type": "ATOMIC_MODIFY_COMPONENT",
                  "comment": "Claim the new spot",
                  "parameters": {
                    "entity_ref": "target",
                    "component_type": "positioning:allows_sitting",
                    "field": {"cat": ["spots.", {"var": "context.newIndex"}]},
                    "expected_value": null,
                    "new_value": "{event.payload.actorId}",
                    "result_variable": "spotClaimed"
                  }
                },
                {
                  "type": "IF",
                  "comment": "Proceed only if new spot was claimed",
                  "parameters": {
                    "condition": {"var": "context.spotClaimed"},
                    "then_actions": [
                      {
                        "type": "REMOVE_COMPONENT",
                        "comment": "Remove old sitting_on component",
                        "parameters": {
                          "entity_ref": "actor",
                          "component_type": "positioning:sitting_on"
                        }
                      },
                      {
                        "type": "ADD_COMPONENT",
                        "comment": "Add updated sitting_on component with new index",
                        "parameters": {
                          "entity_ref": "actor",
                          "component_type": "positioning:sitting_on",
                          "component": {
                            "furniture_id": "{event.payload.targetId}",
                            "spot_index": "{context.newIndex}"
                          }
                        }
                      },
                      {
                        "type": "ESTABLISH_SITTING_CLOSENESS",
                        "comment": "Establish closeness with target occupant",
                        "parameters": {
                          "furniture_id": "{event.payload.targetId}",
                          "actor_id": "{event.payload.actorId}",
                          "spot_index": "{context.newIndex}",
                          "result_variable": "closenessEstablished"
                        }
                      },
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
                        "type": "GET_NAME",
                        "parameters": {
                          "entity_ref": "{event.payload.secondaryId}",
                          "result_variable": "occupantName"
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
                        "type": "SET_VARIABLE",
                        "parameters": {
                          "variable_name": "logMessage",
                          "value": "{context.actorName} scoots closer to {context.occupantName} on {context.targetName}."
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
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

**Defensive Features**:
- **Atomic operations**: Both spot freeing and claiming use `ATOMIC_MODIFY_COMPONENT`
- **Expected value validation**: Ensures no race conditions
- **Nested validation**: Only proceeds if each step succeeds
- **Rollback safety**: Failed atomic operations leave state unchanged

### 5. Condition Definition

**File**: `data/mods/positioning/conditions/event-is-action-scoot-closer.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-scoot-closer",
  "description": "Validates that the event is a scoot_closer action",
  "logic": {
    "===": [
      {"var": "event.payload.actionId"},
      "positioning:scoot_closer"
    ]
  }
}
```

## Integration Test Specifications

### Test Suite 1: Action Discovery

**File**: `tests/integration/mods/positioning/scoot_closer_action_discovery.test.js`

**Test Categories**:

#### 1. Action Metadata Validation
```javascript
describe('Action metadata validation', () => {
  it('should have correct action structure');
  it('should use correct scope for primary target (furniture)');
  it('should use correct scope for secondary target (occupant)');
  it('should have correct required components');
  it('should have correct template string');
});
```

#### 2. Positive Discoverability Scenarios
```javascript
describe('Positive discoverability scenarios', () => {
  it('should discover when actor has empty spot to left and occupant beyond', () => {
    // Furniture: [occupant, null, actor]
    // Should discover scoot_closer action
  });

  it('should discover with multiple empty spots to left', () => {
    // Furniture: [occupant, null, null, actor]
    // Should discover scoot_closer action
  });

  it('should include both furniture and occupant in action instance', () => {
    // Verify action has correct template with both placeholders
  });

  it('should work with different furniture configurations', () => {
    // Furniture: [occ1, occ2, null, actor]
    // Should target occ2 as closest left occupant
  });
});
```

#### 3. Negative Discoverability Scenarios
```javascript
describe('Negative discoverability scenarios', () => {
  it('should NOT appear when actor in leftmost position', () => {
    // Furniture: [actor, null, null]
    // No scoot_closer action available
  });

  it('should NOT appear when no empty spot to left', () => {
    // Furniture: [occupant, actor, null]
    // Already adjacent, can't scoot closer
  });

  it('should NOT appear when gap exists between actor and leftmost occupant', () => {
    // Furniture: [occupant, null, null, actor]
    // Would need to check for continuity
  });

  it('should NOT appear when actor not sitting');

  it('should NOT appear when no occupant to the left', () => {
    // Furniture: [null, null, actor]
    // No one to scoot toward
  });

  it('should NOT appear when occupied spot to the left', () => {
    // Furniture: [occ1, occ2, actor]
    // Can't scoot into occupied spot
  });
});
```

#### 4. Scope Resolution Tests
```javascript
describe('Scope resolution integration', () => {
  it('should resolve correct furniture (actor is sitting on)');
  it('should resolve closest leftmost occupant');
  it('should handle multiple occupants correctly');
  it('should return empty when no valid targets');
});
```

### Test Suite 2: Rule Execution

**File**: `tests/integration/mods/positioning/scoot_closer_action.test.js`

**Test Categories**:

#### 1. Successful Execution Path
```javascript
describe('Rule execution success path', () => {
  it('successfully scoots actor one spot to the left', () => {
    // Setup: [occupant, null, actor]
    // Execute scoot_closer
    // Assert: [occupant, actor, null]
    // Assert: actor.sitting_on.spot_index === 1 (was 2)
  });

  it('frees old spot and claims new spot', () => {
    // Verify furniture spots array updates correctly
  });

  it('establishes closeness with target occupant', () => {
    // Verify positioning:close_to components created
  });

  it('maintains movement lock from initial sit action', () => {
    // Verify core:movement.locked remains true
    // Note: Movement lock was set during initial sit action, not re-applied here
  });

  it('generates success log with all names', () => {
    // Verify perceptible event includes actor, occupant, furniture
  });

  it('ends turn successfully', () => {
    // Verify core:turn_ended event with success=true
  });

  it('works with occupants at different positions', () => {
    // Test various spot configurations
  });
});
```

#### 2. Defensive Behavior & Race Conditions
```javascript
describe('Defensive behavior and race conditions', () => {
  it('aborts when target spot occupied during execution', () => {
    // Simulate race condition - someone claims spot first
    // Verify actor remains at original position
    // Verify no turn ended event
  });

  it('aborts when actor no longer sitting', () => {
    // Remove sitting_on component mid-execution
    // Verify clean failure
  });

  it('handles missing secondary target gracefully', () => {
    // Execute without secondaryId in payload
    // Verify appropriate error handling
  });

  it('validates spot_index bounds', () => {
    // Test edge cases: index 0, invalid indices
  });
});
```

#### 3. Turn Management
```javascript
describe('Turn management', () => {
  it('ends turn after successful execution');
  it('does not end turn on failure');
});
```

#### 4. Perception Logging
```javascript
describe('Perception logging', () => {
  it('dispatches perceptible event on success');
  it('includes all key details in message', () => {
    // Actor name, occupant name, furniture name
  });
  it('uses correct perception type');
});
```

### Test Suite 3: Custom Operator Unit Tests

**File**: `tests/unit/logic/operators/canScootCloserOperator.test.js`

**Test Categories**:

#### 1. Validation Logic
```javascript
describe('CanScootCloserOperator validation', () => {
  it('returns true when all conditions met');
  it('returns false when entity not sitting');
  it('returns false when sitting on different furniture');
  it('returns false when in leftmost position');
  it('returns false when spot to left occupied');
  it('returns false when no occupant to the left');
  it('returns false when gap exists to leftmost occupant');
});
```

#### 2. Edge Cases
```javascript
describe('Edge cases', () => {
  it('handles single-spot furniture');
  it('handles two-spot furniture');
  it('handles invalid furniture ID');
  it('handles missing sitting_on component');
  it('handles out-of-bounds spot_index');
  it('handles invalid spots array');
});
```

#### 3. Parameter Validation
```javascript
describe('Parameter validation', () => {
  it('handles missing parameters');
  it('handles null entity ID');
  it('handles null target ID');
});
```

## Test Coverage Requirements

### Minimum Coverage Targets
- **Action discovery tests**: ≥80% code coverage
- **Rule execution tests**: ≥90% code coverage
- **Custom operator tests**: ≥95% code coverage

### Critical Path Coverage
All integration tests must cover:
1. **Happy path**: Successful execution with valid inputs
2. **Validation failures**: All condition checks that prevent action
3. **Race conditions**: Concurrent modifications to furniture state
4. **Defensive behavior**: Invalid states, missing data, boundary conditions
5. **Perception system**: Event dispatching and message formatting
6. **Turn management**: Proper turn ending on success/failure

### Regression Coverage
- Existing `sit_down` action tests must continue passing
- Existing `sit_down_at_distance` action tests must continue passing
- No breaking changes to `positioning:sitting_on` component behavior
- No breaking changes to closeness establishment logic

## Implementation Sequence

### Phase 1: Foundation (Operators & Scopes)
1. Create `CanScootCloserOperator` with comprehensive unit tests
2. Create `isClosestLeftOccupant` operator (if needed as separate file)
3. Create scope definitions:
   - `furniture_actor_sitting_on.scope`
   - `closest_leftmost_occupant.scope`
4. Register operators in JSON Logic configuration

### Phase 2: Action & Rule Definition
1. Create action definition: `scoot_closer.action.json`
2. Create condition: `event-is-action-scoot-closer.condition.json`
3. Create rule: `handle_scoot_closer.rule.json`
4. Update mod manifest to include new files

### Phase 3: Integration Testing
1. Implement `scoot_closer_action_discovery.test.js`
   - Run tests, verify action discovery logic
2. Implement `scoot_closer_action.test.js`
   - Run tests, verify rule execution
   - Test defensive scenarios and race conditions
3. Implement `canScootCloserOperator.test.js`
   - Comprehensive unit test coverage

### Phase 4: Validation & Refinement
1. Run full test suite: `npm run test:ci`
2. Verify no regressions in existing tests
3. Achieve target code coverage (≥80% overall)
4. Review and refine based on test results

## Success Criteria

### Functional Requirements
✅ Action appears in discovery only when all conditions met:
- Actor is sitting on furniture
- Actor is not in leftmost position
- Spot to the left is empty
- There exists an occupant further to the left
- No gaps between actor and leftmost occupant

✅ Execution correctly:
- Decrements actor's spot_index by 1
- Updates furniture spots array atomically
- Establishes closeness with target occupant
- Preserves movement lock
- Dispatches appropriate events

✅ Defensive behavior:
- Handles race conditions gracefully
- Validates all inputs and state
- Rolls back cleanly on failures
- Never leaves inconsistent state

### Technical Requirements
✅ Code quality:
- Follows existing patterns (`BaseFurnitureOperator`, action schemas)
- Proper error handling and logging
- JSDoc comments for all public methods
- Dependency injection for testability

✅ Test coverage:
- All critical paths tested
- Edge cases covered
- Defensive scenarios validated
- Integration with existing system verified

✅ Documentation:
- Inline comments explain non-obvious logic
- Test descriptions are clear and specific
- This spec serves as implementation guide

### Integration Requirements
✅ No breaking changes:
- Existing tests pass without modification
- Existing actions continue to function
- Component schemas unchanged
- Event payloads compatible

✅ Consistent behavior:
- Visual styling matches existing actions
- Event dispatching follows established patterns
- Turn management consistent with other actions
- Perception logging format matches conventions

## Additional Notes

### Design Decisions

#### Why One Spot at a Time?
Scooting exactly one spot keeps the action simple, predictable, and allows for gradual social proximity adjustment. Players can chain multiple scoots if needed.

#### Why Require Empty Spot to Left?
This ensures the action can always execute atomically. The alternative (scooting past occupied spots) would require complex multi-spot shuffling logic.

#### Why Check for Gaps?
Gap checking ensures the actor is scooting toward someone, not just moving left into empty space. This maintains the social intent of the action.

### Future Enhancements

Potential extensions not in current scope:
1. **Scoot away**: Inverse action to increase distance
2. **Scoot right**: Support movement in both directions
3. **Multi-spot scoot**: Move multiple spots in one action
4. **Swap positions**: Exchange spots with adjacent occupant

### Dependencies

This feature requires:
- Existing `positioning:sitting_on` component
- Existing `positioning:allows_sitting` component
- Existing `ESTABLISH_SITTING_CLOSENESS` operation
- Existing `ATOMIC_MODIFY_COMPONENT` operation
- Existing `REMOVE_COMPONENT` and `ADD_COMPONENT` operations (for updating sitting_on component)
- Existing `core:logSuccessAndEndTurn` macro

**Note**: The codebase uses `REMOVE_COMPONENT` + `ADD_COMPONENT` pattern to update components, not `UPDATE_COMPONENT` (which doesn't exist). This pattern matches the existing `sit_down_at_distance` action implementation.

No new dependencies introduced beyond custom operators/scopes.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-17
**Status**: Approved for Implementation
