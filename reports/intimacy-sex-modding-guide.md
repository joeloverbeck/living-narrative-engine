# Living Narrative Engine: Intimacy & Sex Modding Guide

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Scope Reference](#scope-reference)
4. [Condition Reference](#condition-reference)
5. [Component System](#component-system)
6. [Action Prerequisites](#action-prerequisites)
7. [Rule Processing](#rule-processing)
8. [Step-by-Step Examples](#step-by-step-examples)
9. [Best Practices](#best-practices)

## Overview

This guide provides comprehensive documentation for creating mods similar to the `intimacy` and `sex` mods in the Living Narrative Engine. These mods demonstrate how to create complex, context-aware interactions between characters using the engine's Entity Component System (ECS).

### Key Features Demonstrated

- **Proximity-based interactions**: Actions that require characters to be "close"
- **Anatomy-aware actions**: Actions that check for specific body parts
- **Position tracking**: Keeping track of who is facing whom
- **State management**: Managing relationship states like closeness
- **Progressive interactions**: Building from simple to complex intimacy

### Action Flow

1. **User selects action** → Game checks scope to determine valid targets
2. **User selects target** → Game validates prerequisites
3. **Action attempt event** → Rule system processes the action
4. **Rule execution** → Modifies game state and provides feedback
5. **Turn ends** → Next character's turn begins

## Core Concepts

### Actions

Actions define what characters can do. Each action has:

- **id**: Unique identifier (e.g., `intimacy:place_hand_on_waist`)
- **name**: Display name shown to players
- **scope**: Determines valid targets for the action
- **required_components**: Components the actor must have
- **prerequisites**: Conditions that must be met
- **template**: How the action is displayed in UI

### Scopes

Scopes are queries that return a list of valid targets for an action. They use the engine's custom DSL to filter entities based on various criteria.

### Conditions

Conditions are reusable logic checks using JSON Logic. They evaluate to true/false and are used in prerequisites, scopes, and rules.

### Rules

Rules handle events (like action attempts) and execute a series of operations to modify game state and provide feedback.

### Components

Components store data on entities. The intimacy system uses:

- **closeness**: Tracks which characters are in intimate proximity
- **facing_away**: Tracks positional relationships

## Scope Reference

### From Core Module

#### `core:actors_in_location`

```
core:actors_in_location := entities(core:position)[][{
  "and": [
    { "condition_ref": "core:entity-at-location" },
    { "condition_ref": "core:entity-is-not-current-actor" },
    { "condition_ref": "core:entity-has-actor-component" }
  ]
}]
```

**Use for**: Basic interactions with any actor in the same location
**Returns**: All actors in the current location except the current actor

### From Intimacy Module

#### `intimacy:close_actors`

```
intimacy:close_actors := actor.components.intimacy:closeness.partners[]
```

**Use for**: Any action requiring characters to be in a closeness relationship
**Returns**: All partners in the actor's closeness circle

#### `intimacy:close_actors_in_front`

```
intimacy:close_actors_in_front := actor.intimacy:closeness.partners[][{
  "or": [
    {"not": {"condition_ref": "intimacy:actor-has-facing-away"}},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

**Use for**: Actions that require face-to-face interaction
**Returns**: Close actors that the current actor is facing

#### `intimacy:close_actors_facing_away`

```
intimacy:close_actors_facing_away := actor.intimacy:closeness.partners[][{
  "condition_ref": "intimacy:entity-in-facing-away"
}]
```

**Use for**: Actions targeting someone's back
**Returns**: Close actors that the current actor has turned around

#### `intimacy:close_actors_facing_forward`

```
intimacy:close_actors_facing_forward := actor.intimacy:closeness.partners[][{
  "condition_ref": "intimacy:entity-not-in-facing-away"
}]
```

**Use for**: Face-to-face intimate actions
**Returns**: Close actors facing the current actor

#### `intimacy:actors_with_arms_facing_forward`

```
intimacy:actors_with_arms_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "arm"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

**Use for**: Actions requiring arm interaction (like massages)
**Returns**: Close, facing actors who have arms

#### `intimacy:actors_with_ass_cheeks_facing_forward`

```
intimacy:actors_with_ass_cheeks_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "ass_cheek"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

**Use for**: Actions targeting the buttocks
**Returns**: Close, facing actors with the required anatomy

### From Sex Module

#### `sex:actors_with_breasts_facing_forward`

```
sex:actors_with_breasts_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "breast"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

**Use for**: Breast-related intimate actions
**Returns**: Close, facing actors with breasts

#### `sex:actors_with_penis_facing_forward`

```
sex:actors_with_penis_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "penis"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

**Use for**: Penis-related intimate actions
**Returns**: Close, facing actors with a penis

### Creating Custom Scopes

Scope files use a custom DSL. Basic syntax:

```
modId:scopeName := startingPoint[][filters]
```

Common starting points:

- `entities(componentType)`: All entities with a component
- `actor.componentType.field`: Start from actor's component data
- `actor`: The current actor

Common filters:

- `condition_ref`: Reference a condition
- `hasPartOfType`: Check for anatomy parts
- `and`/`or`: Combine conditions

## Condition Reference

### Core Conditions

#### `core:actor-can-move`

```json
{
  "logic": {
    "hasPartWithComponentValue": ["actor", "core:movement", "locked", false]
  }
}
```

**Checks**: If actor has unlocked movement capability
**Use in**: Prerequisites for movement-based actions

#### `core:entity-at-location`

**Checks**: If entity is at the same location as the actor
**Use in**: Filtering entities by location

#### `core:entity-has-actor-component`

**Checks**: If entity has the actor component (is a character)
**Use in**: Filtering to only include characters

### Intimacy Conditions

#### `intimacy:actor-is-in-closeness`

```json
{
  "logic": {
    "!!": {
      "var": "actor.components.intimacy:closeness"
    }
  }
}
```

**Checks**: If actor has the closeness component
**Use in**: Prerequisites for intimate actions

#### `intimacy:entity-not-in-facing-away`

```json
{
  "logic": {
    "not": {
      "in": [
        { "var": "entity.id" },
        { "var": "actor.components.intimacy:facing_away.facing_away_from" }
      ]
    }
  }
}
```

**Checks**: If entity is NOT in actor's facing_away list
**Use in**: Scopes for face-to-face actions

#### `intimacy:entity-in-facing-away`

**Checks**: If entity IS in actor's facing_away list
**Use in**: Scopes for back-facing actions

### Event Conditions

Each action typically has a corresponding event condition:

- `intimacy:event-is-action-get-close`
- `intimacy:event-is-action-place-hand-on-waist`
- `sex:event-is-action-fondle-breasts`

These check if the current event matches a specific action type.

### Creating Custom Conditions

Conditions use JSON Logic syntax. Common patterns:

**Check for component existence:**

```json
{
  "logic": {
    "!!": { "var": "actor.components.yourMod:componentName" }
  }
}
```

**Check component value:**

```json
{
  "logic": {
    "==": [
      { "var": "actor.components.yourMod:component.field" },
      "expectedValue"
    ]
  }
}
```

**Check array membership:**

```json
{
  "logic": {
    "in": [
      "searchValue",
      { "var": "actor.components.yourMod:component.arrayField" }
    ]
  }
}
```

## Component System

### Closeness Component (`intimacy:closeness`)

**Purpose**: Maintains a fully-connected graph of characters in intimate proximity

**Structure:**

```json
{
  "partners": ["entity1", "entity2", "entity3"]
}
```

**Key features:**

- All partners have identical partner lists
- Adding/removing updates all connected entities
- Enables proximity-based action filtering

### Facing Away Component (`intimacy:facing_away`)

**Purpose**: Tracks positional relationships between intimate partners

**Structure:**

```json
{
  "facing_away_from": ["entity1", "entity2"]
}
```

**Key features:**

- Asymmetric - A can face away from B while B faces A
- Dynamically added/removed as positions change
- Enables position-aware actions

### Creating Custom Components

1. Define the component schema:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "yourMod:componentName",
  "description": "What this component represents",
  "dataSchema": {
    "type": "object",
    "required": ["requiredField"],
    "properties": {
      "requiredField": {
        "type": "string",
        "description": "Field description"
      }
    }
  }
}
```

2. Register in mod-manifest.json
3. Use in actions, conditions, and rules

## Action Prerequisites

Prerequisites are conditions that must be met before an action can be attempted.

### Basic Prerequisites

```json
{
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    }
  ]
}
```

### Complex Prerequisites

You can combine multiple conditions:

```json
{
  "prerequisites": [
    {
      "logic": {
        "and": [
          { "condition_ref": "core:actor-can-move" },
          { "condition_ref": "intimacy:actor-is-in-closeness" }
        ]
      },
      "failure_message": "You must be close to someone and able to move."
    }
  ]
}
```

### No Prerequisites

Many intimate actions have empty prerequisites:

```json
{
  "prerequisites": []
}
```

This means they only need to pass scope validation.

## Rule Processing

Rules handle events and execute operations. Common patterns:

### Basic Action Handler

```json
{
  "rule_id": "handle_action_name",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "yourMod:event-is-action-name"
  },
  "actions": [
    // Get actor and target names
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
    // Set up logging
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} performs action on {context.targetName}."
      }
    },
    // Use macro to log and end turn
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### State Modification

The closeness system uses special operations:

```json
{
  "type": "MERGE_CLOSENESS_CIRCLE",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}"
  }
}
```

### Component Manipulation

```json
// Add component
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "target",
    "component_type": "yourMod:component",
    "value": {
      "field": "value"
    }
  }
}

// Modify array field
{
  "type": "MODIFY_ARRAY_FIELD",
  "parameters": {
    "entity_ref": "target",
    "component_type": "yourMod:component",
    "field": "arrayField",
    "mode": "push_unique",
    "value": "newValue"
  }
}
```

### Conditional Logic

```json
{
  "type": "IF",
  "parameters": {
    "condition": {
      "var": "context.someVariable"
    },
    "then_actions": [
      // Actions if true
    ],
    "else_actions": [
      // Actions if false
    ]
  }
}
```

## Step-by-Step Examples

### Example 1: Simple Intimate Action

Create a "Hold Hands" action:

**1. Create the action (`hold_hands.action.json`):**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "yourMod:hold_hands",
  "name": "Hold Hands",
  "description": "Hold someone's hand affectionately",
  "scope": "intimacy:close_actors",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "template": "hold {target}'s hand",
  "prerequisites": []
}
```

**2. Create the event condition (`event-is-action-hold-hands.condition.json`):**

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "yourMod:event-is-action-hold-hands",
  "description": "Checks if event is hold hands action",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "yourMod:hold_hands"]
  }
}
```

**3. Create the rule (`hold_hands.rule.json`):**

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_hold_hands",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "yourMod:event-is-action-hold-hands"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} gently takes {context.targetName}'s hand."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Example 2: Anatomy-Aware Action

Create a "Kiss Neck" action that requires the target to have a neck:

**1. Create a custom scope (`actors_with_neck_facing_forward.scope`):**

```
yourMod:actors_with_neck_facing_forward := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "neck"]},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

**2. Create the action:**

```json
{
  "id": "yourMod:kiss_neck",
  "name": "Kiss Neck",
  "scope": "yourMod:actors_with_neck_facing_forward",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "template": "kiss {target}'s neck"
}
```

### Example 3: State-Modifying Action

Create an "Embrace" action that adds a custom state:

**1. Create the component (`embracing.component.json`):**

```json
{
  "id": "yourMod:embracing",
  "description": "Tracks who is embracing whom",
  "dataSchema": {
    "type": "object",
    "required": ["embracing"],
    "properties": {
      "embracing": {
        "type": "string",
        "description": "Entity ID being embraced"
      }
    }
  }
}
```

**2. Create the rule with state modification:**

```json
{
  "actions": [
    // ... name getting ...
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "yourMod:embracing",
        "value": {
          "embracing": "{event.payload.targetId}"
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_ref": "target",
        "component_type": "yourMod:embracing",
        "value": {
          "embracing": "{event.payload.actorId}"
        }
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} embraces {context.targetName} warmly."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

## Best Practices

### Naming Conventions

- **Action IDs**: `modId:verb_object` (e.g., `intimacy:place_hand_on_waist`)
- **Component IDs**: `modId:stateName` (e.g., `intimacy:closeness`)
- **Condition IDs**: `modId:descriptive-check` (e.g., `intimacy:actor-is-in-closeness`)
- **Scope names**: `modId:plural_descriptive` (e.g., `intimacy:close_actors_facing_forward`)

### Dependency Management

1. **Declare dependencies** in mod-manifest.json:

```json
{
  "dependencies": [
    { "id": "anatomy", "version": "^1.0.0" },
    { "id": "intimacy", "version": "^1.0.0" }
  ]
}
```

2. **Build on existing systems** - the sex mod extends intimacy
3. **Check for required components** before using them

### Testing Your Mod

1. **Start simple** - Test basic actions before complex ones
2. **Check scopes** - Use the debug UI to see available targets
3. **Verify prerequisites** - Ensure failure messages are helpful
4. **Test edge cases**:
   - What if no valid targets?
   - What if components are missing?
   - What if multiple actors are involved?

### Performance Considerations

1. **Scope efficiency** - More specific scopes perform better
2. **Condition complexity** - Simple conditions evaluate faster
3. **Rule size** - Break complex rules into smaller ones
4. **Component data** - Keep component data structures simple

### User Experience

1. **Clear action names** - Users should understand what actions do
2. **Helpful failure messages** - Explain why actions can't be performed
3. **Logical progression** - Build from simple to complex interactions
4. **Consistent behavior** - Similar actions should work similarly

### Mod Compatibility

1. **Use namespaced IDs** - Always prefix with your mod ID
2. **Don't modify core components** - Extend instead
3. **Document requirements** - List all dependencies
4. **Handle missing dependencies** - Graceful degradation

### Common Patterns

**Progressive Intimacy:**

1. Start with distance (get_close)
2. Enable simple touch (hold_hands, touch_shoulder)
3. Allow positioning (turn_around)
4. Enable complex interactions

**Anatomy Checking:**

- Use `hasPartOfType` in scopes
- Provide alternative actions for different anatomies
- Consider clothing/equipment blocking access

**State Management:**

- Use components to track relationship states
- Keep state synchronized between participants
- Clean up states when relationships end

**Action Feedback:**

- Always provide descriptive messages
- Include both participants' names
- Describe the action clearly
- Consider observers' perspectives

This guide should provide everything needed to create rich, interactive mods similar to the intimacy and sex systems. Remember to test thoroughly and consider player experience in your designs!
