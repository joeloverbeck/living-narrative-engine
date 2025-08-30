# Lying Down Mechanics Design Document

**Living Narrative Engine - Positioning System Extension**  
_Brainstorming Document - December 2024_

## Executive Summary

This document explores the design and implementation of lying down mechanics for the Living Narrative Engine. These mechanics will introduce actions for lying down on one's back (supine) and stomach (prone), along with a unified component system to track these states. The design supports both intimate interactions and future exercise mechanics while maintaining consistency with existing positioning patterns.

## Design Goals

### Primary Objectives

1. **Enable lying down actions** - Allow entities to lie down in supine or prone positions
2. **Track positional state** - Maintain clear state of whether entity is lying down and orientation
3. **Support multiple use cases** - Enable intimacy interactions, exercise actions, and general gameplay
4. **Maintain system consistency** - Follow established component patterns from positioning module

### Secondary Objectives

- Enable smooth transitions between lying positions (rolling over)
- Support surface-aware lying (beds, floors, mats)
- Integrate with movement locking system
- Provide foundation for future exercise actions (plank, push-ups, stretches)
- Enable intimate positioning for adult content mods

## Component Design

### Core Component: `positioning:lying_down`

Following the **Single-Target Positional State Pattern** identified in the reference guide, with adaptations for orientation tracking.

#### Component Schema

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "positioning:lying_down",
  "description": "Tracks when an entity is lying down, including orientation (prone/supine) and optional surface reference. Presence indicates the entity is in a horizontal position.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["orientation"],
    "properties": {
      "orientation": {
        "type": "string",
        "enum": ["prone", "supine"],
        "description": "Whether lying face-down (prone) or face-up (supine)"
      },
      "surface_id": {
        "description": "Optional: The entity ID of the surface being laid upon (bed, mat, etc.)",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId",
        "default": null
      }
    }
  }
}
```

#### Design Rationale

**Single Component Approach**: Rather than separate `lying_prone` and `lying_supine` components, we use a single component with an orientation field. This:

- Reduces component proliferation
- Simplifies state queries (check one component instead of two)
- Makes transitions easier (modify orientation vs remove/add components)
- Follows the pattern of `positioning:sitting_on` which tracks both state and details

**Surface Tracking**: The optional `surface_id` field enables:

- Lying on specific furniture (beds, couches)
- Surface-specific bonuses or restrictions
- Preventing multiple entities on single-person surfaces
- Future integration with comfort/rest mechanics

**Movement Locking**: Consistent with kneeling and sitting mechanics, lying down restricts movement until the entity gets up. This is handled by the `LOCK_MOVEMENT` operation handler when the action is processed, not stored in the component.

### Alternative Considered: Surface-Aware Component

An alternative design would split the component into two variants:

1. **positioning:lying_down** - For floor/ground lying
2. **positioning:lying_on** - For furniture-based lying (similar to sitting_on)

However, the unified approach is preferred for simplicity and consistency of state queries.

## Action Design

### Primary Actions

#### 1. Lie Down on Back (`positioning:lie_down_on_back`)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:lie_down_on_back",
  "name": "Lie Down on Back",
  "description": "Lie down flat on your back in a supine position",
  "targets": "none",
  "required_components": {
    "actor": ["core:actor"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:lying_down",
      "positioning:kneeling_before",
      "positioning:sitting_on"
    ]
  },
  "template": "lie down on your back",
  "visual": {
    "backgroundColor": "#8B7355",
    "textColor": "#ffffff"
  }
}
```

#### 2. Lie Down on Stomach (`positioning:lie_down_on_stomach`)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:lie_down_on_stomach",
  "name": "Lie Down on Stomach",
  "description": "Lie down flat on your stomach in a prone position",
  "targets": "none",
  "required_components": {
    "actor": ["core:actor"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:lying_down",
      "positioning:kneeling_before",
      "positioning:sitting_on"
    ]
  },
  "template": "lie down on your stomach",
  "visual": {
    "backgroundColor": "#8B7355",
    "textColor": "#ffffff"
  }
}
```

#### 3. Roll Over (`positioning:roll_over`)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:roll_over",
  "name": "Roll Over",
  "description": "Roll over to switch between lying on back and stomach",
  "targets": "none",
  "required_components": {
    "actor": ["positioning:lying_down"]
  },
  "template": "roll over",
  "visual": {
    "backgroundColor": "#A0826D",
    "textColor": "#ffffff"
  }
}
```

#### 4. Get Up from Lying (`positioning:get_up_from_lying`)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:get_up_from_lying",
  "name": "Get Up",
  "description": "Stand up from lying position",
  "targets": "none",
  "required_components": {
    "actor": ["positioning:lying_down"]
  },
  "template": "get up",
  "visual": {
    "backgroundColor": "#6B8E23",
    "textColor": "#ffffff"
  }
}
```

### Surface-Targeted Actions (Future Enhancement)

#### Lie Down on Surface (`positioning:lie_down_on`)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:lie_down_on",
  "name": "Lie Down On",
  "description": "Lie down on a specific surface like a bed or mat",
  "targets": "positioning:surfaces_that_allow_lying",
  "required_components": {
    "actor": ["core:actor"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:lying_down",
      "positioning:kneeling_before",
      "positioning:sitting_on"
    ]
  },
  "template": "lie down on {target.components.core:description.short}",
  "visual": {
    "backgroundColor": "#8B7355",
    "textColor": "#ffffff"
  }
}
```

## Rule Implementation Patterns

### State Addition Rules

#### handle_lie_down_on_back.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_lie_down_on_back",
  "comment": "Handles positioning:lie_down_on_back action",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-lie-down-on-back"
  },
  "actions": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:lying_down",
        "value": {
          "orientation": "supine",
          "surface_id": null
        }
      }
    },
    {
      "type": "LOCK_MOVEMENT",
      "comment": "Lock movement while lying down",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} lies down on their back."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### State Modification Rules

#### handle_roll_over.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_roll_over",
  "comment": "Handles positioning:roll_over action to switch orientation",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-roll-over"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:lying_down",
        "result_variable": "currentState"
      }
    },
    {
      "type": "SET_VARIABLE",
      "comment": "Determine new orientation",
      "parameters": {
        "variable_name": "newOrientation",
        "value": {
          "if": [
            { "==": [{ "var": "context.currentState.orientation" }, "supine"] },
            "prone",
            "supine"
          ]
        }
      }
    },
    {
      "type": "MODIFY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:lying_down",
        "modification": {
          "type": "set_field",
          "field": "orientation",
          "value": "{context.newOrientation}"
        }
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "orientationText",
        "value": {
          "if": [
            { "==": [{ "var": "context.newOrientation" }, "prone"] },
            "stomach",
            "back"
          ]
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} rolls over onto their {context.orientationText}."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### State Removal Rules

#### handle_get_up_from_lying.rule.json

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_get_up_from_lying",
  "comment": "Handles positioning:get_up_from_lying action",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-get-up-from-lying"
  },
  "actions": [
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:lying_down"
      }
    },
    {
      "type": "UNLOCK_MOVEMENT",
      "comment": "Restore movement after getting up",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} gets up from the ground."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

## Scope Definitions

### Basic Scopes

#### actors_lying_down.scope

```
positioning:actors_lying_down := entities(positioning:lying_down)[][{
  "condition_ref": "core:entity-has-actor-component"
}]
```

#### actors_lying_prone.scope

```
positioning:actors_lying_prone := entities(positioning:lying_down)[][{
  "and": [
    {"==": [{"var": "components.positioning:lying_down.orientation"}, "prone"]},
    {"condition_ref": "core:entity-has-actor-component"}
  ]
}]
```

#### actors_lying_supine.scope

```
positioning:actors_lying_supine := entities(positioning:lying_down)[][{
  "and": [
    {"==": [{"var": "components.positioning:lying_down.orientation"}, "supine"]},
    {"condition_ref": "core:entity-has-actor-component"}
  ]
}]
```

### Integration Scopes (Examples)

#### close_actors_lying_down.scope

```
positioning:close_actors_lying_down := actor.components.positioning:closeness.partners[][{
  "!!": {"var": "components.positioning:lying_down"}
}]
```

#### actor_lying_beside_target.scope

```
positioning:actor_lying_beside_target := actor.components.positioning:closeness.partners[][{
  "and": [
    {"!!": {"var": "components.positioning:lying_down"}},
    {"!!": {"var": "actor.components.positioning:lying_down"}},
    {"==": [
      {"var": "components.positioning:lying_down.surface_id"},
      {"var": "actor.components.positioning:lying_down.surface_id"}
    ]}
  ]
}]
```

## Condition Logic

### Basic Conditions

#### actor-is-lying-down.condition.json

```json
{
  "id": "positioning:actor-is-lying-down",
  "description": "Checks if the actor is in a lying down state",
  "logic": {
    "!!": {
      "var": "actor.components.positioning:lying_down"
    }
  }
}
```

#### actor-is-lying-prone.condition.json

```json
{
  "id": "positioning:actor-is-lying-prone",
  "description": "Checks if the actor is lying face-down",
  "logic": {
    "==": [
      { "var": "actor.components.positioning:lying_down.orientation" },
      "prone"
    ]
  }
}
```

#### actor-is-lying-supine.condition.json

```json
{
  "id": "positioning:actor-is-lying-supine",
  "description": "Checks if the actor is lying face-up",
  "logic": {
    "==": [
      { "var": "actor.components.positioning:lying_down.orientation" },
      "supine"
    ]
  }
}
```

#### actor-can-lie-down.condition.json

```json
{
  "id": "positioning:actor-can-lie-down",
  "description": "Checks if actor can lie down (not already in positional state)",
  "logic": {
    "none": [
      { "var": "actor.components.positioning:lying_down" },
      { "var": "actor.components.positioning:kneeling_before" },
      { "var": "actor.components.positioning:sitting_on" }
    ]
  }
}
```

## Integration with Existing Systems

### Movement System Integration

The lying down mechanics integrate with the existing movement locking system:

- **LOCK_MOVEMENT** operation called when lying down
- **UNLOCK_MOVEMENT** operation called when getting up
- Movement restrictions prevent location changes while lying

### Positioning Hierarchy

Positional states are mutually exclusive:

1. **Standing** (default, no component)
2. **Sitting** (positioning:sitting_on)
3. **Kneeling** (positioning:kneeling_before)
4. **Lying** (positioning:lying_down)

Transitions between states require explicit actions.

### Closeness Integration

Lying down can be combined with closeness for intimate scenarios:

- Actors can be close while one or both are lying down
- Enables "lying beside" or "lying together" scenarios
- Supports intimate actions that require horizontal positioning

### Facing Away Integration

The facing_away component can work with lying down:

- Prone position naturally faces away from those behind
- Supine position faces away from those below/beneath
- Enables positional awareness for intimate actions

## Use Case Scenarios

### Intimacy Scenarios

1. **Romantic Scene**: Two actors lying close together on a bed
   - Both have lying_down component with same surface_id
   - Both in closeness circle
   - Enables cuddling, intimate touches

2. **Medical/Care Scene**: One actor lying supine, another standing/kneeling beside
   - Patient lying_down (supine)
   - Caregiver can perform medical checks, massage

3. **Adult Content**: Various intimate positions
   - Lying down enables horizontal intimate actions
   - Orientation matters for action availability
   - Surface tracking for bed-specific actions

### Exercise Scenarios

1. **Plank Exercise**:
   - Start with lie_down_on_stomach
   - Transition to plank position (future action)
   - Track duration for fitness benefits

2. **Push-ups**:
   - Require prone position to start
   - Alternate between down and up positions
   - Count repetitions

3. **Stretching**:
   - Different stretches based on orientation
   - Supine for back stretches
   - Prone for cobra stretches

4. **Yoga Poses**:
   - Corpse pose (savasana) - supine
   - Child's pose transition from prone
   - Bridge pose from supine

### General Gameplay

1. **Resting/Sleeping**:
   - Lying on bed restores energy
   - Different rest quality based on surface
   - Sleep only possible when lying down

2. **Hiding/Stealth**:
   - Lying prone reduces visibility
   - Hide under beds or low furniture
   - Crawling movement while prone

3. **Medical/Injury**:
   - Injured characters forced to lie down
   - Medical examination requires supine position
   - Recovery faster when lying on medical surfaces

## Future Extensions

### Surface Component (`positioning:allows_lying`)

Similar to `allows_sitting`, furniture could have:

```json
{
  "id": "positioning:allows_lying",
  "dataSchema": {
    "type": "object",
    "properties": {
      "capacity": {
        "type": "integer",
        "description": "How many can lie on this surface",
        "default": 1
      },
      "comfort_level": {
        "type": "integer",
        "description": "Comfort rating 1-10",
        "default": 5
      },
      "orientations_allowed": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["prone", "supine", "both"]
        },
        "default": ["both"]
      }
    }
  }
}
```

### Advanced Movement States

1. **Crawling** (`positioning:crawling`)
   - Movement while prone
   - Slower but stealthier
   - Transition from lying prone

2. **Rolling** (`positioning:rolling`)
   - Lateral movement while lying
   - Evasive maneuver
   - Playful interaction

3. **Reclining** (`positioning:reclining`)
   - Partial lying position
   - Supported by furniture
   - Between sitting and lying

### Exercise-Specific Components

1. **Exercise Position** (`fitness:exercise_position`)
   - Track specific exercise poses
   - Duration and form quality
   - Fatigue accumulation

2. **Supported Positions** (`fitness:supported_position`)
   - Positions requiring equipment
   - Weight/resistance tracking
   - Safety considerations

### Medical/Health Integration

1. **Medical Position** (`medical:examination_position`)
   - Required positions for medical procedures
   - Patient comfort tracking
   - Procedure-specific requirements

2. **Recovery Position** (`medical:recovery_position`)
   - Optimal positions for healing
   - Injury-specific positioning
   - Automatic position changes

## Implementation Priority

### Phase 1: Core Implementation (MVP)

1. ✅ Create `positioning:lying_down` component
2. ✅ Implement basic actions (lie down supine/prone, roll over, get up)
3. ✅ Add movement locking integration
4. ✅ Create basic scopes and conditions
5. ✅ Test with existing positioning system

### Phase 2: Integration Enhancement

1. Add surface targeting (lie on bed/mat)
2. Integrate with closeness for "lying together"
3. Add orientation-aware scopes for intimacy
4. Create transition actions (sit to lie, kneel to lie)

### Phase 3: Use Case Implementation

1. Add exercise actions (plank, push-ups)
2. Implement rest/sleep mechanics
3. Create intimacy-specific actions requiring lying
4. Add medical/care scenarios

### Phase 4: Advanced Features

1. Implement crawling movement
2. Add comfort and fatigue systems
3. Create surface-specific benefits
4. Implement automatic position changes

## Testing Strategy

### Component Testing

- Validate schema with various orientation values
- Test state persistence across saves
- Verify movement lock integration
- Test surface reference handling

### Action Testing

- Verify mutual exclusivity with other positions
- Test all transitions (stand→lie, lie→stand)
- Validate roll over orientation switching
- Test surface-targeted lying

### Integration Testing

- Test with closeness circles
- Verify facing_away interactions
- Test with movement system
- Validate scope resolutions

### Scenario Testing

- Run through intimacy scenarios
- Test exercise sequences
- Verify rest/sleep mechanics
- Test medical examinations

## Design Decisions & Rationale

### Single Component vs Multiple Components

**Decision**: Use single `positioning:lying_down` with orientation field

**Rationale**:

- Simpler state queries (one component check)
- Easier transitions (modify vs remove/add)
- Consistent with `sitting_on` pattern
- Reduces component proliferation

**Alternative Rejected**: Separate prone/supine components would require checking multiple components and complex transition logic.

### Movement Locking by Default

**Decision**: Lock movement when lying down

**Rationale**:

- Consistent with sitting and kneeling
- Prevents unrealistic instant movement
- Forces deliberate position changes
- Supports rest/sleep mechanics

**Alternative Rejected**: Optional movement locking would complicate rules and create inconsistencies.

### Surface Tracking Design

**Decision**: Optional surface_id field in main component

**Rationale**:

- Allows both ground and furniture lying
- Simple queries for surface-specific actions
- Efficient component structure
- Future-proof for surface mechanics

**Alternative Rejected**: Separate components for ground vs furniture would duplicate logic and complicate queries.

## Conclusion

The lying down mechanics provide a robust foundation for horizontal positioning in the Living Narrative Engine. By following established component patterns and integrating with existing systems, these mechanics enable diverse gameplay scenarios from intimate interactions to exercise routines.

The design prioritizes:

- **Simplicity**: Single component with clear state
- **Consistency**: Follows existing positioning patterns
- **Extensibility**: Ready for future features
- **Integration**: Works with all positioning systems

This implementation will enhance the narrative possibilities while maintaining the engine's modular, data-driven architecture.

## Appendix: Quick Reference

### Component

- `positioning:lying_down` - Tracks lying state with orientation

### Actions

- `positioning:lie_down_on_back` - Lie supine
- `positioning:lie_down_on_stomach` - Lie prone
- `positioning:roll_over` - Switch orientation
- `positioning:get_up_from_lying` - Stand up

### Key Fields

- `orientation`: "prone" | "supine"
- `surface_id`: Optional surface reference

### Scopes

- `positioning:actors_lying_down` - All lying actors
- `positioning:actors_lying_prone` - Face-down actors
- `positioning:actors_lying_supine` - Face-up actors

### Integration Points

- Movement locking system
- Closeness circles
- Facing away mechanics
- Surface interactions

---

_This brainstorming document represents initial design thoughts for lying down mechanics. Implementation details may evolve based on testing and user feedback._
