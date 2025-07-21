# Kissing System Design Specification

## Overview

This specification outlines a comprehensive "kissing system" for the Living Narrative Engine that extends the existing intimacy mod with deep, interactive kissing mechanics. The system introduces state-based interactions where characters can engage in prolonged kissing sessions with various actions and responses available based on the kissing state.

## Core Concepts

### Kissing State Management

The kissing system revolves around a mutual state component (`intimacy:kissing`) that tracks when two characters are actively kissing. This state:

- Is mutually exclusive - each character can only kiss one partner at a time
- Enables context-specific actions only available during kissing
- Must be properly initialized and cleaned up
- Integrates with the existing closeness system

### Progressive Interaction Flow

1. **Pre-Kiss**: Characters must be in closeness and facing each other
2. **Kiss Initiation**: Entry actions establish the kissing state
3. **During Kiss**: Various contextual actions become available
4. **Kiss Conclusion**: Exit actions remove the kissing state

## Component Design

### intimacy:kissing

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "intimacy:kissing",
  "description": "Tracks an active kissing interaction between two characters. Presence indicates the character is currently kissing someone.",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["partner", "intensity", "initiator"],
    "properties": {
      "partner": {
        "description": "The entity ID of the character being kissed",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      },
      "intensity": {
        "type": "string",
        "description": "Current intensity level of the kiss",
        "enum": ["gentle", "passionate", "intense"],
        "default": "gentle"
      },
      "initiator": {
        "type": "boolean",
        "description": "Whether this character initiated the kiss",
        "default": false
      }
    }
  }
}
```

## Action Definitions

### Entry Actions (Kiss Initiation)

#### slide_tongue_into_mouth

```json
{
  "id": "intimacy:slide_tongue_into_mouth",
  "name": "Slide tongue into mouth",
  "description": "Initiate a deep, passionate kiss by sliding your tongue into their mouth",
  "scope": "intimacy:actors_with_mouth_facing_forward",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "prerequisites": [
    {
      "logic": {
        "not": { "condition_ref": "intimacy:actor-is-kissing" }
      },
      "failure_message": "You are already kissing someone."
    }
  ],
  "template": "slide tongue into {target}'s mouth"
}
```

#### lean_in_for_deep_kiss

```json
{
  "id": "intimacy:lean_in_for_deep_kiss",
  "name": "Lean in for a deep kiss",
  "description": "Move in close and initiate a deep, meaningful kiss",
  "scope": "intimacy:actors_with_mouth_facing_forward",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "prerequisites": [
    {
      "logic": {
        "not": { "condition_ref": "intimacy:actor-is-kissing" }
      },
      "failure_message": "You are already kissing someone."
    }
  ],
  "template": "lean in to kiss {target} deeply"
}
```

### During-Kiss Actions (Contextual)

#### accept_kiss_passively

```json
{
  "id": "intimacy:accept_kiss_passively",
  "name": "Accept the kiss passively",
  "description": "Let them lead the kiss, responding gently but not actively participating",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "accept {target}'s kiss passively"
}
```

#### kiss_back_passionately

```json
{
  "id": "intimacy:kiss_back_passionately",
  "name": "Kiss back passionately",
  "description": "Return the kiss with equal or greater passion",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "kiss {target} back passionately"
}
```

#### explore_with_tongue

```json
{
  "id": "intimacy:explore_with_tongue",
  "name": "Explore with tongue",
  "description": "Deepen the kiss by exploring their mouth with your tongue",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "explore {target}'s mouth with your tongue"
}
```

#### nibble_lower_lip

```json
{
  "id": "intimacy:nibble_lower_lip",
  "name": "Nibble lower lip",
  "description": "Gently nibble on their lower lip during the kiss",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "nibble on {target}'s lower lip"
}
```

#### suck_on_tongue

```json
{
  "id": "intimacy:suck_on_tongue",
  "name": "Suck on tongue",
  "description": "Intensify the kiss by gently sucking on their tongue",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "suck on {target}'s tongue"
}
```

#### moan_into_kiss

```json
{
  "id": "intimacy:moan_into_kiss",
  "name": "Moan into the kiss",
  "description": "Express pleasure by moaning softly into the kiss",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "moan softly into the kiss with {target}"
}
```

#### breathe_heavily

```json
{
  "id": "intimacy:breathe_heavily",
  "name": "Breathe heavily",
  "description": "Show your arousal through heavy breathing during the kiss",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "breathe heavily while kissing {target}"
}
```

#### cup_face_while_kissing

```json
{
  "id": "intimacy:cup_face_while_kissing",
  "name": "Cup face while kissing",
  "description": "Gently cup their face in your hands while continuing to kiss",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "cup {target}'s face while kissing"
}
```

### Exit Actions (Kiss Termination)

#### break_kiss_gently

```json
{
  "id": "intimacy:break_kiss_gently",
  "name": "Break the kiss gently",
  "description": "Slowly and gently end the kiss",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "gently break the kiss with {target}"
}
```

#### pull_back_breathlessly

```json
{
  "id": "intimacy:pull_back_breathlessly",
  "name": "Pull back breathlessly",
  "description": "End the kiss by pulling back, breathing heavily",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "pull back from {target} breathlessly"
}
```

#### rest_forehead_against

```json
{
  "id": "intimacy:rest_forehead_against",
  "name": "Rest forehead against theirs",
  "description": "End the kiss but maintain intimacy by resting your forehead against theirs",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "rest your forehead against {target}'s"
}
```

## Scope Definitions

### actors_with_mouth_facing_forward

```
intimacy:actors_with_mouth_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "mouth"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

### current_kissing_partner

```
intimacy:current_kissing_partner := entities(intimacy:kissing)[][{
  "and": [
    {"==": [{"var": "entity.id"}, {"var": "actor.components.intimacy:kissing.partner"}]},
    {"condition_ref": "core:entity-has-actor-component"}
  ]
}]
```

## Condition Definitions

### actor-is-kissing

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "intimacy:actor-is-kissing",
  "description": "Checks if the actor is currently in a kissing state",
  "logic": {
    "!!": { "var": "actor.components.intimacy:kissing" }
  }
}
```

### target-is-kissing-partner

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "intimacy:target-is-kissing-partner",
  "description": "Checks if the target is the actor's current kissing partner",
  "logic": {
    "==": [
      { "var": "target.id" },
      { "var": "actor.components.intimacy:kissing.partner" }
    ]
  }
}
```

### actor-not-kissing

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "intimacy:actor-not-kissing",
  "description": "Checks if the actor is NOT currently kissing",
  "logic": {
    "!": { "var": "actor.components.intimacy:kissing" }
  }
}
```

## Rule Processing Logic

### Kiss Initiation Rules

Rules for initiating kisses must:

1. Add the `intimacy:kissing` component to both participants
2. Set appropriate intensity levels
3. Mark the initiator
4. Provide descriptive feedback
5. Handle the perception system appropriately

Example rule structure for `slide_tongue_into_mouth`:

```json
{
  "rule_id": "handle_slide_tongue_into_mouth",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "intimacy:event-is-action-slide-tongue-into-mouth"
  },
  "actions": [
    // Get names
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
    },
    // Add kissing component to actor
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "intimacy:kissing",
        "value": {
          "partner": "{event.payload.targetId}",
          "intensity": "passionate",
          "initiator": true
        }
      }
    },
    // Add kissing component to target
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "intimacy:kissing",
        "value": {
          "partner": "{event.payload.actorId}",
          "intensity": "passionate",
          "initiator": false
        }
      }
    },
    // Set description
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} leans in close and slides their tongue into {context.targetName}'s mouth, initiating a deep, passionate kiss."
      }
    },
    // Standard perception and turn ending
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### During-Kiss Action Rules

Rules for actions during kissing should:

1. Potentially modify the intensity level
2. Provide appropriate descriptive text
3. Not remove the kissing state

### Kiss Termination Rules

Rules for ending kisses must:

1. Remove the `intimacy:kissing` component from both participants
2. Provide appropriate transition text
3. Leave characters in the closeness state

Example for `break_kiss_gently`:

```json
{
  "actions": [
    // ... name getting ...
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "intimacy:kissing"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "intimacy:kissing"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} slowly and gently breaks the kiss with {context.targetName}, pulling back with a soft smile."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

## Integration Points

### With Existing Intimacy System

- Requires `intimacy:closeness` for all kissing actions
- Respects `intimacy:facing_away` for positioning
- Compatible with other intimacy actions

### With Anatomy System

- Checks for `mouth` part type for kiss initiation
- Could be extended to check for lips, tongue sub-parts

### With Perception System

- All actions dispatch appropriate perception events
- Uses standard `action_target_general` perception type

## Edge Cases and Considerations

1. **Interrupted Kisses**: If a character moves away or turns around while kissing, the kissing state should be automatically removed
2. **Multiple Partners**: The system prevents kissing multiple people simultaneously through prerequisites
3. **State Cleanup**: If a character is removed from closeness, their kissing state should also be removed
4. **Turn Order**: Consider whether certain kissing actions should have different turn costs
5. **AI Behavior**: NPCs should have appropriate responses to kissing actions

## Future Extensions

1. **Kiss Quality**: Track kiss quality/compatibility between characters
2. **Emotional Responses**: Add emotional state changes from kissing
3. **Skill System**: Make some actions require kissing skill/experience
4. **Cultural Variations**: Different kissing styles based on character background
5. **Kiss Interruptions**: Actions or events that forcibly end kisses
6. **Group Dynamics**: How other characters react to witnessing kisses

## Implementation Priority

1. Core component and basic scopes/conditions
2. Entry actions (2-3 variations)
3. Basic during-kiss actions (3-4 core actions)
4. Exit actions (2-3 variations)
5. Additional contextual actions
6. Edge case handling and state cleanup rules
