# Kissing Initiation and Breaking Up

## Overview

This specification outlines the feature specifications to extend the existing intimacy mod with the beginnings of a kissing system. It introduces state-based interactions so in the future the characters can engage in prolonged kissing sessions with various actions and responses available based on the kissing state.

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
    "required": ["partner", "initiator"],
    "properties": {
      "partner": {
        "description": "The entity ID of the character being kissed",
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
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

Note: given that now we have a 'forbidden_components' property in the action.schema.json, the prerequisite could be removed, and instead use the 'forbidden_components' with the 'intimacy:kissing' component.

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
  "template": "pull back from {target}'s kiss breathlessly"
}
```

#### pull_back_in_revulsion

```json
{
  "id": "intimacy:pull_back_in_revulsion",
  "name": "Pull back breathlessly",
  "description": "End the kiss by pulling back in revulsion of being kissed deeply by the initiator.",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "pull back from {target}'s kiss in revulsion"
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

## Rule Processing Logic

### Kiss Initiation Rules

Rules for initiating kisses must:

1. Add the `intimacy:kissing` component to both participants
2. Mark the initiator
3. Provide descriptive feedback
4. Handle the perception system appropriately

Example rule structure for `lean_in_for_deep_kiss`:

```json
{
  "rule_id": "handle_lean_in_for_deep_kiss",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "intimacy:event-is-action-lean-in-for-deep-kiss"
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

You should add the perceptible events logs as well to the rule.

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

### With Perception System

- All actions dispatch appropriate perception events
- Uses standard `action_target_general` perception type

## Edge Cases and Considerations

2. **Multiple Partners**: The system prevents kissing multiple people simultaneously through prerequisites
3. **State Cleanup**: If a character is removed from closeness, their kissing state should also be removed

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
3. Exit actions (2-3 variations)
4. Additional contextual actions
5. Edge case handling and state cleanup rules
