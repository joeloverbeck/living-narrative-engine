# Domain-Driven Design: "Turn Around" Action for Intimacy Mod

## Executive Summary

Design a position-aware intimate action that toggles a "facing away" state between actors in closeness. This enables future contextual actions like massages or other position-dependent intimate interactions.

## Domain Architecture

### Bounded Context: Intimacy

- **Existing Aggregates**: Closeness (relationship management)
- **New Aggregate**: PositionalRelationship (spatial orientation between actors)
- **Domain Events**: ActorTurnedAround, ActorFacedForward

### Component Design

**New Component: `intimacy:facing_away`**

```json
{
  "id": "intimacy:facing_away",
  "schema": {
    "type": "object",
    "properties": {
      "facing_away_from": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Entity IDs this actor is facing away from"
      }
    },
    "required": ["facing_away_from"],
    "additionalProperties": false
  }
}
```

### Action Definition

**File: `data/mods/intimacy/actions/turn_around.action.json`**

```json
{
  "id": "intimacy:turn_around",
  "commandVerb": "turn-around",
  "scope": "intimacy:close_actors",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "template": "turn {target} around",
  "prerequisites": []
}
```

### Rule Implementation

You should ensure that the placeholders are used like that: '$EVENT'. Check out other existing rules.

**File: `data/mods/intimacy/rules/turn_around.rule.json`**

```json
{
  "id": "intimacy:turn_around",
  "trigger": "core:attempt_action",
  "condition": "intimacy:event-is-action-turn-around",
  "actions": [
    {
      "type": "GET_NAME",
      "params": {
        "id": "$EVENT.actor",
        "store_as": "actor_name"
      }
    },
    {
      "type": "GET_NAME",
      "params": {
        "id": "$EVENT.target",
        "store_as": "target_name"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "params": {
        "id": "$EVENT.target",
        "component": "intimacy:facing_away",
        "store_as": "facing_state"
      }
    },
    {
      "type": "CONDITIONAL",
      "params": {
        "condition": {
          "in": ["$EVENT.actor", { "var": "facing_state.facing_away_from" }]
        },
        "then": [
          {
            "type": "TOGGLE_FACING_AWAY",
            "params": {
              "target": "$EVENT.target",
              "actor": "$EVENT.actor",
              "action": "remove"
            }
          },
          {
            "type": "SET_VARIABLE",
            "params": {
              "key": "action_description",
              "value": "{target_name} turns to face {actor_name}"
            }
          },
          {
            "type": "EMIT_EVENT",
            "params": {
              "event": "intimacy:actor_faced_forward",
              "data": {
                "actor": "$EVENT.target",
                "facing": "$EVENT.actor"
              }
            }
          }
        ],
        "else": [
          {
            "type": "TOGGLE_FACING_AWAY",
            "params": {
              "target": "$EVENT.target",
              "actor": "$EVENT.actor",
              "action": "add"
            }
          },
          {
            "type": "SET_VARIABLE",
            "params": {
              "key": "action_description",
              "value": "{actor_name} turns {target_name} around"
            }
          },
          {
            "type": "EMIT_EVENT",
            "params": {
              "event": "intimacy:actor_turned_around",
              "data": {
                "actor": "$EVENT.target",
                "turned_by": "$EVENT.actor"
              }
            }
          }
        ]
      }
    },
    {
      "type": "SET_VARIABLE",
      "params": {
        "key": "perception_type",
        "value": "action_target_general"
      }
    },
    {
      "type": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### Supporting Files

**Condition: `data/mods/intimacy/conditions/event-is-action-turn-around.condition.json`**

```json
{
  "id": "intimacy:event-is-action-turn-around",
  "expression": {
    "==": [{ "var": "action.id" }, "intimacy:turn_around"]
  }
}
```

### Custom Action Type: TOGGLE_FACING_AWAY

This action type would handle the component manipulation logic:

- Check if target has `intimacy:facing_away` component
- If action is "add":
  - Create component if not exists
  - Add actor to `facing_away_from` array
- If action is "remove":
  - Remove actor from `facing_away_from` array
  - Remove component if array becomes empty

Note: creating a new OperationHandler for a TOGGLE_FACING_AWAY is likely way too granular. Please check out the existing action handlers in data/schemas/operations/ for more general options that will allow you to do the same by chaining some operations.

### Future Extension Points

- Position-aware actions can check for `intimacy:facing_away` component
- New scopes like `intimacy:actors_facing_away_in_closeness`
- Events enable UI updates or mood system integration

## Implementation Steps

1. Create the `facing_away` component definition
2. Add the `turn_around` action definition
3. Implement the `turn_around` rule with toggle logic
4. Add the event condition for action detection
5. Update UI labels for the new action
6. Figure out how to implement in the rule the 'toggle facing away' notion without creating a new OperationHandler, which would be way too granular
7. Add unit tests for the new functionality
8. Add integration tests for the new rule similar to the integration tests in tests/integration/rules/ and tests/integration/mods/

## Testing Strategy

- Test toggle behavior (add/remove facing state)
- Verify multiple actors can have different facing states
- Ensure closeness requirement is enforced
- Verify component cleanup when empty

## Alternative Implementation Without Custom Action Type

If implementing a custom `TOGGLE_FACING_AWAY` action type is not feasible, the rule can use existing action types with more complex conditional logic:

```json
{
  "type": "CONDITIONAL",
  "params": {
    "condition": {
      "in": ["$EVENT.actor", { "var": "facing_state.facing_away_from" }]
    },
    "then": [
      {
        "type": "UPDATE_COMPONENT",
        "params": {
          "id": "$EVENT.target",
          "component": "intimacy:facing_away",
          "operation": "remove_from_array",
          "field": "facing_away_from",
          "value": "$EVENT.actor"
        }
      },
      {
        "type": "CONDITIONAL",
        "params": {
          "condition": {
            "==": [{ "var": "facing_state.facing_away_from.length" }, 1]
          },
          "then": [
            {
              "type": "REMOVE_COMPONENT",
              "params": {
                "id": "$EVENT.target",
                "component": "intimacy:facing_away"
              }
            }
          ]
        }
      }
    ],
    "else": [
      {
        "type": "CONDITIONAL",
        "params": {
          "condition": {
            "!!": [{ "var": "facing_state" }]
          },
          "then": [
            {
              "type": "UPDATE_COMPONENT",
              "params": {
                "id": "$EVENT.target",
                "component": "intimacy:facing_away",
                "operation": "add_to_array",
                "field": "facing_away_from",
                "value": "$EVENT.actor"
              }
            }
          ],
          "else": [
            {
              "type": "ADD_COMPONENT",
              "params": {
                "id": "$EVENT.target",
                "component": "intimacy:facing_away",
                "data": {
                  "facing_away_from": ["$EVENT.actor"],
                  "timestamp": "$CURRENT_TIME"
                }
              }
            }
          ]
        }
      }
    ]
  }
}
```

## Domain Model Considerations

### Invariants

1. An actor can only be in the `facing_away_from` array once (no duplicates)
2. The `facing_away` component should only exist if there's at least one actor in the array
3. Only actors in closeness can modify each other's facing state

### Value Objects

- **FacingState**: Encapsulates the facing relationship between two actors

### Aggregate Boundaries

- The `facing_away` component belongs to the target actor's aggregate
- Modifications must go through the intimacy bounded context
- The closeness requirement ensures proper authorization

## Conclusion

This design maintains consistency with existing patterns while introducing positional awareness to enable richer intimate interactions. The toggle behavior provides intuitive user interaction, while the component-based architecture ensures extensibility for future position-dependent actions.
