# Straddling Waist System Specification

**Created:** 2025-01-XX
**Status:** Design
**Mod:** positioning

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Design](#component-design)
3. [Action Definitions](#action-definitions)
4. [Rule Implementations](#rule-implementations)
5. [Scope Queries](#scope-queries)
6. [Conditions](#conditions)
7. [Implementation Details](#implementation-details)
8. [Testing Strategy](#testing-strategy)
9. [References](#references)

---

## System Overview

### Purpose

Implement a positioning system that allows actors to straddle the waist of other actors who are sitting down. This adds intimate positioning options with two distinct orientations: facing the target or facing away from them.

### Core Mechanics

The straddling waist system introduces three new actions and one new component:

1. **Straddle Waist (Facing)** - Actor straddles target's waist while facing them
2. **Straddle Waist (Facing Away)** - Actor straddles target's waist while facing away
3. **Dismount from Straddling** - Actor stops straddling and removes the positioning state

### Design Principles

Following existing positioning mod patterns:

- **Component-based state tracking** - Similar to `kneeling_before`, `bending_over`, `sitting_on`
- **Movement locking** - Straddling locks movement like other positioning states
- **Closeness integration** - Works within the existing closeness circle system
- **Facing orientation** - Uses `facing_away` component for orientation tracking
- **Clean state transitions** - Proper cleanup when dismounting
- **Action schema compliance** - All actions include `$schema` property for validation

---

## Component Design

### `straddling_waist.component.json`

**Purpose:** Tracks which actor is being straddled and the orientation of the straddling actor.

**Location:** `data/mods/positioning/components/straddling_waist.component.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:straddling_waist",
  "description": "Tracks which entity this actor is currently straddling and the orientation (facing or facing away).",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["target_id", "facing_away"],
    "properties": {
      "target_id": {
        "description": "The ID of the entity being straddled",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "facing_away": {
        "type": "boolean",
        "description": "Whether the straddling actor is facing away from the target (true) or facing them (false)"
      }
    }
  }
}
```

**Design Notes:**

- The `target_id` must reference an actor with `positioning:sitting_on` component
- The `facing_away` boolean tracks orientation, eliminating need to query `facing_away` component separately
- Component presence on actor indicates active straddling state
- Mutually exclusive with: `sitting_on`, `kneeling_before`, `bending_over`, `lying_down`

---

## Action Definitions

### Action 1: `straddle_waist_facing.action.json`

**Purpose:** Straddle the waist of a sitting target while facing them.

**Location:** `data/mods/positioning/actions/straddle_waist_facing.action.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:straddle_waist_facing",
  "name": "Straddle Waist (Facing)",
  "description": "Straddle the waist of a sitting actor while facing them",
  "targets": {
    "primary": {
      "scope": "positioning:actors_sitting_close",
      "placeholder": "target",
      "description": "Sitting actor to straddle"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"],
    "target": ["positioning:sitting_on", "positioning:closeness"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:kneeling_before",
      "positioning:bending_over",
      "positioning:lying_down",
      "positioning:straddling_waist"
    ]
  },
  "template": "straddle {target}'s waist while facing them",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "movement:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    },
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

**Design Notes:**

- Requires both actors to have closeness (must be in same closeness circle)
- Target must be sitting (`sitting_on` component)
- Actor cannot already be in another positioning state
- Uses same prerequisites as similar positioning actions (movement, mouth availability)
- Scope `positioning:actors_sitting_close` filters for sitting actors in closeness circle
- Uses modern target format with `primary` object (legacy string format also supported by engine)

---

### Action 2: `straddle_waist_facing_away.action.json`

**Purpose:** Straddle the waist of a sitting target while facing away from them.

**Location:** `data/mods/positioning/actions/straddle_waist_facing_away.action.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:straddle_waist_facing_away",
  "name": "Straddle Waist (Facing Away)",
  "description": "Straddle the waist of a sitting actor while facing away from them",
  "targets": {
    "primary": {
      "scope": "positioning:actors_sitting_close",
      "placeholder": "target",
      "description": "Sitting actor to straddle"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"],
    "target": ["positioning:sitting_on", "positioning:closeness"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:kneeling_before",
      "positioning:bending_over",
      "positioning:lying_down",
      "positioning:straddling_waist",
      "positioning:facing_away"
    ]
  },
  "template": "straddle {target}'s waist while facing away",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "movement:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    },
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

**Design Notes:**

- Same requirements as facing variant
- Additionally forbids `facing_away` component (will be added by rule)
- Same scope and prerequisites
- Different rule implementation will add `facing_away` component

---

### Action 3: `dismount_from_straddling.action.json`

**Purpose:** Stop straddling and return to standing close position.

**Location:** `data/mods/positioning/actions/dismount_from_straddling.action.json`

**Schema:**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:dismount_from_straddling",
  "name": "Dismount",
  "description": "Stop straddling and return to standing position",
  "targets": {
    "primary": {
      "scope": "positioning:actor_im_straddling",
      "placeholder": "target",
      "description": "Actor you're straddling"
    }
  },
  "required_components": {
    "actor": ["positioning:straddling_waist"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "dismount from straddling {target}",
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

**Design Notes:**

- Requires actor to be straddling (`straddling_waist` component)
- Target is the actor being straddled (from scope query)
- Simpler prerequisites than straddling actions
- Single action handles both orientations (facing/facing away)

---

## Rule Implementations

### Rule 1: `straddle_waist_facing.rule.json`

**Purpose:** Handles `positioning:straddle_waist_facing` action execution.

**Location:** `data/mods/positioning/rules/straddle_waist_facing.rule.json`

**Implementation:**

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_straddle_waist_facing",
  "comment": "Handles the 'positioning:straddle_waist_facing' action. Adds straddling_waist component with facing_away=false, locks movement.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-straddle-waist-facing"
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
        "value": "{context.actorName} straddles {context.targetName}'s waist while facing them."
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

**Design Notes:**

- Follows `kneel_before` pattern closely
- Sets `facing_away` to `false` in component
- Locks movement after straddling
- No need to modify closeness (already required by action)
- Dispatches perceptible event through macro

---

### Rule 2: `straddle_waist_facing_away.rule.json`

**Purpose:** Handles `positioning:straddle_waist_facing_away` action execution.

**Location:** `data/mods/positioning/rules/straddle_waist_facing_away.rule.json`

**Implementation:**

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_straddle_waist_facing_away",
  "comment": "Handles the 'positioning:straddle_waist_facing_away' action. Adds straddling_waist component with facing_away=true, adds facing_away component, locks movement.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-straddle-waist-facing-away"
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
      "type": "ADD_COMPONENT",
      "comment": "Add straddling_waist component with facing_away orientation",
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
      "comment": "Add facing_away component to track orientation",
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} straddles {context.targetName}'s waist while facing away."
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
      "type": "DISPATCH_EVENT",
      "comment": "Dispatch event for facing_away state change",
      "parameters": {
        "eventType": "positioning:actor_turned_back",
        "payload": {
          "actor": "{event.payload.actorId}",
          "target": "{event.payload.targetId}"
        }
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Design Notes:**

- Similar to facing variant but adds TWO components
- `straddling_waist` with `facing_away: true`
- `facing_away` component for orientation tracking (consistent with `turn_your_back` pattern)
- Dispatches `positioning:actor_turned_back` event like `turn_your_back` action
- Both components must be cleaned up when dismounting

---

### Rule 3: `dismount_from_straddling.rule.json`

**Purpose:** Handles `positioning:dismount_from_straddling` action execution.

**Location:** `data/mods/positioning/rules/dismount_from_straddling.rule.json`

**Implementation:**

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_dismount_from_straddling",
  "comment": "Handles the 'positioning:dismount_from_straddling' action. Removes straddling_waist component, removes facing_away if present, unlocks movement.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-dismount-from-straddling"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get straddling_waist data to check orientation",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "result_variable": "straddlingData"
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
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "comment": "Remove straddling_waist component",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist"
      }
    },
    {
      "type": "IF",
      "comment": "Remove facing_away component if actor was facing away",
      "parameters": {
        "condition": {
          "var": "context.straddlingData.facing_away"
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:facing_away"
            }
          }
        ]
      }
    },
    {
      "type": "UNLOCK_MOVEMENT",
      "comment": "Unlock movement after dismounting",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} dismounts from straddling {context.targetName}."
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

**Design Notes:**

- Queries `straddling_waist` component to check `facing_away` boolean
- Always removes `straddling_waist` component
- Conditionally removes `facing_away` component (only if `facing_away` was true)
- Unlocks movement to return actor to normal state
- Single rule handles both orientations cleanly
- Follows `get_up_from_furniture` cleanup pattern

---

## Scope Queries

### Scope 1: `actors_sitting_close.scope`

**Purpose:** Find actors in closeness circle who are currently sitting.

**Location:** `data/mods/positioning/scopes/actors_sitting_close.scope`

**Query:**

```
positioning:actors_sitting_close := actor.components.positioning:closeness.partners[][{
  "and": [
    {
      "!!": {
        "var": "entity.components.positioning:sitting_on"
      }
    }
  ]
}]
```

**Design Notes:**

- Starts with closeness partners (requires `closeness` component on actor)
- Filters for entities with `sitting_on` component
- Returns array of sitting actors in same closeness circle
- Used by both straddling actions for target selection

---

### Scope 2: `actor_im_straddling.scope`

**Purpose:** Find the actor currently being straddled.

**Location:** `data/mods/positioning/scopes/actor_im_straddling.scope`

**Query:**

```
positioning:actor_im_straddling := entities(core:actor)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.positioning:straddling_waist.target_id"}
  ]
}]
```

**Design Notes:**

- Queries all actors and filters by matching ID
- Matches against `target_id` in actor's `straddling_waist` component
- Returns single-element array (the straddled actor)
- Used by `dismount_from_straddling` action for target

---

## Conditions

### Condition 1: `event-is-action-straddle-waist-facing.condition.json`

**Location:** `data/mods/positioning/conditions/event-is-action-straddle-waist-facing.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-straddle-waist-facing",
  "description": "Checks if event is attempting the straddle_waist_facing action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:straddle_waist_facing"
    ]
  }
}
```

---

### Condition 2: `event-is-action-straddle-waist-facing-away.condition.json`

**Location:** `data/mods/positioning/conditions/event-is-action-straddle-waist-facing-away.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-straddle-waist-facing-away",
  "description": "Checks if event is attempting the straddle_waist_facing_away action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:straddle_waist_facing_away"
    ]
  }
}
```

---

### Condition 3: `event-is-action-dismount-from-straddling.condition.json`

**Location:** `data/mods/positioning/conditions/event-is-action-dismount-from-straddling.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-dismount-from-straddling",
  "description": "Checks if event is attempting the dismount_from_straddling action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:dismount_from_straddling"
    ]
  }
}
```

---

## Implementation Details

### Component State Transitions

#### Straddling (Facing) Flow

```
Initial State:
- Actor: closeness (with target)
- Target: closeness (with actor) + sitting_on

Action: straddle_waist_facing
↓
Rule: handle_straddle_waist_facing
↓
Final State:
- Actor: closeness + straddling_waist(target_id, facing_away=false) + movement_locked
- Target: closeness + sitting_on + movement_locked
```

#### Straddling (Facing Away) Flow

```
Initial State:
- Actor: closeness (with target)
- Target: closeness (with actor) + sitting_on

Action: straddle_waist_facing_away
↓
Rule: handle_straddle_waist_facing_away
↓
Final State:
- Actor: closeness + straddling_waist(target_id, facing_away=true) + facing_away(target_id) + movement_locked
- Target: closeness + sitting_on + movement_locked
```

#### Dismounting Flow

```
Initial State (Facing):
- Actor: closeness + straddling_waist(facing_away=false) + movement_locked
- Target: closeness + sitting_on + movement_locked

OR

Initial State (Facing Away):
- Actor: closeness + straddling_waist(facing_away=true) + facing_away + movement_locked
- Target: closeness + sitting_on + movement_locked

Action: dismount_from_straddling
↓
Rule: handle_dismount_from_straddling
↓
Final State:
- Actor: closeness + movement_unlocked
- Target: closeness + sitting_on + movement_locked
```

### Movement Locking Strategy

The straddling system follows the positioning mod's movement locking pattern:

1. **When straddling**: Actor gets `movement_locked` via `LOCK_MOVEMENT` operation
2. **When dismounting**: Actor loses `movement_locked` via `UNLOCK_MOVEMENT` operation
3. **Target remains locked**: Target's sitting state keeps them locked independently

### Closeness Integration

**Key Points:**

- Both actors MUST already be in closeness circle (action requirement)
- No closeness modification needed when straddling (already close)
- No closeness modification needed when dismounting (remain close)
- If closeness is broken separately (via `step_back`), straddling should be auto-removed
  - **Note:** This edge case requires additional rules not in this spec

### Forbidden Component Combinations

The `straddling_waist` component is mutually exclusive with:

- `sitting_on` - Can't sit while straddling
- `kneeling_before` - Can't kneel while straddling
- `bending_over` - Can't bend over while straddling
- `lying_down` - Can't lie down while straddling
- Another `straddling_waist` - Can't straddle two actors simultaneously

This is enforced via `forbidden_components` in action definitions.

### Orientation Tracking

Two mechanisms track orientation:

1. **`straddling_waist.facing_away` boolean** - Primary source of truth
2. **`facing_away` component** - Only added when `facing_away=true`

The boolean in `straddling_waist` is the authoritative source. The `facing_away` component is added for consistency with other positioning actions and for potential queries/scopes that filter by facing orientation.

### Error Handling

#### Invalid States

If an actor attempts to straddle without required components:

- Action won't appear in discovery (scope filters properly)
- If somehow triggered, action's `required_components` will prevent execution

#### Edge Cases

1. **Target stands up while being straddled**
   - Target's `get_up_from_furniture` should check for straddling actors
   - **Not covered in this spec** - requires modification to existing rule

2. **Closeness broken while straddling**
   - `step_back` or similar actions should auto-dismount
   - **Not covered in this spec** - requires additional reactive rules

3. **Target leaves location while being straddled**
   - Movement lock should prevent this
   - Failsafe: location change event should trigger auto-dismount
   - **Not covered in this spec** - requires event handler

### Performance Considerations

- Scope queries are efficient (filter on component presence)
- No complex operation handlers needed (simple component add/remove)
- Movement locking prevents invalid state transitions
- Minimal rule execution overhead

---

## Testing Strategy

### Unit Tests

#### Component Tests

**File:** `tests/unit/mods/positioning/components/straddling_waist.test.js`

Test cases:
- ✅ Valid component data passes schema validation
- ✅ Missing `target_id` fails validation
- ✅ Missing `facing_away` boolean fails validation
- ✅ Invalid `target_id` format fails validation
- ✅ Invalid `facing_away` type fails validation

#### Scope Tests

**File:** `tests/unit/mods/positioning/scopes/actors_sitting_close.test.js`

Test cases:
- ✅ Returns sitting actors in closeness circle
- ✅ Filters out non-sitting actors
- ✅ Returns empty array when no sitting close actors
- ✅ Returns empty array when actor has no closeness

**File:** `tests/unit/mods/positioning/scopes/actor_im_straddling.test.js`

Test cases:
- ✅ Returns straddled actor from `straddling_waist.target_id`
- ✅ Returns empty array when not straddling
- ✅ Returns correct actor when multiple actors exist

#### Condition Tests

**File:** `tests/unit/mods/positioning/conditions/straddling-conditions.test.js`

Test cases:
- ✅ Each condition correctly identifies its action
- ✅ Conditions reject other action IDs
- ✅ Conditions handle missing action ID

### Integration Tests

#### Action Discovery Tests

**File:** `tests/integration/mods/positioning/straddle_waist_facing_action_discovery.test.js`

Test cases:
- ✅ Action appears when actor is close to sitting target
- ✅ Action doesn't appear when not close to target
- ✅ Action doesn't appear when target is not sitting
- ✅ Action doesn't appear when actor is already straddling
- ✅ Action doesn't appear when actor has forbidden components

**File:** `tests/integration/mods/positioning/straddle_waist_facing_away_action_discovery.test.js`

Test cases:
- Same as facing variant
- ✅ Action doesn't appear when actor has `facing_away` component

**File:** `tests/integration/mods/positioning/dismount_from_straddling_action_discovery.test.js`

Test cases:
- ✅ Action appears when actor has `straddling_waist` component
- ✅ Action doesn't appear when not straddling
- ✅ Target is correctly identified from `straddling_waist.target_id`

#### Action Execution Tests

**File:** `tests/integration/mods/positioning/straddle_waist_facing_action.test.js`

Test cases:
- ✅ Adds `straddling_waist` component with `facing_away=false`
- ✅ Locks actor movement
- ✅ Target remains sitting with movement locked
- ✅ Generates correct log message
- ✅ Dispatches perceptible event
- ✅ Both actors remain in closeness circle

**File:** `tests/integration/mods/positioning/straddle_waist_facing_away_action.test.js`

Test cases:
- ✅ Adds `straddling_waist` component with `facing_away=true`
- ✅ Adds `facing_away` component with target in array
- ✅ Locks actor movement
- ✅ Dispatches `positioning:actor_turned_back` event
- ✅ Generates correct log message
- ✅ Both actors remain in closeness circle

**File:** `tests/integration/mods/positioning/dismount_from_straddling_action.test.js`

Test cases:
- ✅ Removes `straddling_waist` component (facing variant)
- ✅ Removes `straddling_waist` and `facing_away` components (facing away variant)
- ✅ Unlocks actor movement
- ✅ Target remains sitting with movement locked
- ✅ Generates correct log message
- ✅ Both actors remain in closeness circle

### Edge Case Tests

**File:** `tests/integration/mods/positioning/straddling_edge_cases.test.js`

Test cases:
- ✅ Straddling prevents actor from sitting down
- ✅ Straddling prevents actor from kneeling
- ✅ Straddling prevents actor from bending over
- ✅ Can't straddle while already straddling
- ✅ Can't straddle target who is not sitting
- ✅ Can't straddle without closeness
- ⚠️ **Future:** Target standing up auto-dismounts straddler (not implemented yet)
- ⚠️ **Future:** Breaking closeness auto-dismounts straddler (not implemented yet)

### Performance Tests

**File:** `tests/performance/mods/positioning/straddling_performance.test.js`

Test cases:
- ✅ Action discovery completes in <10ms with 100 actors
- ✅ Straddling action execution completes in <50ms
- ✅ Dismounting action execution completes in <50ms
- ✅ Scope queries scale linearly with closeness circle size

---

## References

### Similar Systems

This specification draws patterns from:

1. **`kneeling_before` system** - Component tracks single target entity
2. **`sitting_on` system** - Component tracks furniture with index
3. **`bending_over` system** - Simple target tracking with movement lock
4. **`facing_away` system** - Orientation tracking with array of entities
5. **`turn_your_back` action** - Adding `facing_away` component
6. **`get_close` action** - Closeness circle integration
7. **`handle_sit_down` rule** - Movement locking pattern
8. **`establishSittingClosenessHandler`** - Sitting + closeness interaction

### Operation Handlers Referenced

No new operation handlers needed! Existing handlers cover all requirements:

- `LOCK_MOVEMENT` / `UNLOCK_MOVEMENT` - Movement locking
- `ADD_COMPONENT` - Adding straddling and facing components
- `REMOVE_COMPONENT` - Cleanup when dismounting
- `QUERY_COMPONENT` - Reading component data
- Standard macro: `core:logSuccessAndEndTurn`

### Component Dependencies

Required existing components:

- `core:actor` - Entity type
- `core:position` - Location tracking
- `positioning:closeness` - Closeness circle membership
- `positioning:sitting_on` - Target's sitting state
- `positioning:facing_away` - Orientation tracking (for facing away variant)
- `movement:movement_locked` - Movement prevention

### File Checklist

Total files to create: **13**

#### Components (1)
- [ ] `data/mods/positioning/components/straddling_waist.component.json`

#### Actions (3)
- [ ] `data/mods/positioning/actions/straddle_waist_facing.action.json`
- [ ] `data/mods/positioning/actions/straddle_waist_facing_away.action.json`
- [ ] `data/mods/positioning/actions/dismount_from_straddling.action.json`

#### Rules (3)
- [ ] `data/mods/positioning/rules/straddle_waist_facing.rule.json`
- [ ] `data/mods/positioning/rules/straddle_waist_facing_away.rule.json`
- [ ] `data/mods/positioning/rules/dismount_from_straddling.rule.json`

#### Scopes (2)
- [ ] `data/mods/positioning/scopes/actors_sitting_close.scope`
- [ ] `data/mods/positioning/scopes/actor_im_straddling.scope`

#### Conditions (3)
- [ ] `data/mods/positioning/conditions/event-is-action-straddle-waist-facing.condition.json`
- [ ] `data/mods/positioning/conditions/event-is-action-straddle-waist-facing-away.condition.json`
- [ ] `data/mods/positioning/conditions/event-is-action-dismount-from-straddling.condition.json`

#### Tests (1 base file, more detailed test files as described in Testing Strategy)
- [ ] `tests/integration/mods/positioning/straddling_waist_system.test.js`

---

## Future Enhancements

### Auto-Dismount Scenarios

**Not included in this specification** but recommended for future implementation:

1. **Target stands up** - `get_up_from_furniture` should auto-dismount straddlers
2. **Closeness breaks** - `step_back` should auto-dismount if breaking closeness
3. **Location change** - Either prevent or auto-dismount on location change

These would require:
- Reactive rules listening to component removal events
- Additional event handlers for state transitions
- Cascading cleanup logic

### Alternative Actions

Potential future actions:

- `turn_around_while_straddling` - Flip orientation without dismounting
- `shift_position_on_lap` - Adjust straddling position
- Multiple-actor straddling scenarios

### Integration with Other Systems

- **Anatomy system** - Check leg availability for straddling
- **Clothing system** - Restrict based on clothing restrictions
- **Weight/size system** - Validate physical compatibility

---

## Conclusion

This specification provides a complete design for implementing a straddling waist positioning system in the Living Narrative Engine's positioning mod. The design:

- ✅ Follows existing positioning mod patterns consistently
- ✅ Reuses existing operation handlers (no new handlers needed)
- ✅ Integrates cleanly with closeness and sitting systems
- ✅ Handles both facing orientations elegantly
- ✅ Provides comprehensive testing strategy
- ✅ Maintains proper component state isolation
- ✅ Uses movement locking correctly

**Total Implementation Scope:** 13 files (1 component, 3 actions, 3 rules, 2 scopes, 3 conditions, 1+ test file)

**No code modifications required to existing systems** - purely additive implementation.

---

**End of Specification**
