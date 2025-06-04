# JSON Logic Usage

> **New!** If you only need the boolean **`and / or / not`** cheatsheet, jump to  
> [`docs/composite-logical-operators.md`](composite-logical-operators.md).

This document explains how to use JSON Logic within the game engine to define conditional
logic for various game systems.

## Introduction

JSON Logic is a standard for building logical rules using a JSON format. It provides a way to represent complex
conditions (like `if/then/else` statements, comparisons, and boolean logic) in a data structure that is both
human-readable and easily processed by machines.

In this game engine, JSON Logic is primarily used to define data-driven conditions for:

- **System Rules:** Determining if a rule's actions should run in response to a game event.
- **Action Prerequisites:** Validating if an entity can perform a specific action based on the current game state (e.g.,
  Does the player have enough mana to cast a spell? Is the door locked?).
- **IF Operations:** Implementing conditional branching within the action sequence of a System Rule.

By using JSON Logic, game designers and modders can customize game behavior by modifying data files, without needing to
write engine code directly.

## Basic Syntax

JSON Logic rules are JSON objects where the keys are operators and the values are the
arguments for that operator.

- **Logical (`and`, `or`, `not`, `!`)** – see the dedicated
  _Composite Logical Operators_ guide for full behaviour, including the engine-specific
  “vacuous truth/falsity” rules for `{"and":[]}` → `true` and `{"or":[]}` → `false`.

- **`var`**: Retrieves data from the evaluation context. Missing variables typically resolve to `null`.

  - Syntax: `{ "var": "path.to.data" }`
  - Example: `{ "var": "actor.id" }` retrieves the actor's ID.
  - Example: `{ "var": "context.queryResult" }` retrieves data stored by a `QUERY_COMPONENT` operation.

- **Comparison (`==`, `!=`, `>`, `<`, `>=`, `<=`)**: Compares two values.

  - Syntax: `{ "==": [ { "var": "a" }, { "var": "b" } ] }`
  - Example: `{ ">=": [ { "var": "actor.components.core:health.current" }, 10 ] }` checks if actor's health is 10 or
    more.
  - Example: `{ "==": [ { "var": "target.components.game:lockable.state" }, "locked" ] }` checks if the target's
    lockable state is "locked".

- **Logical Operators (`and`, `or`)**: Combine multiple conditions. `and` requires all conditions to be true, `or`
  requires at least one to be true.

  - Syntax: `{ "and": [ { condition1 }, { condition2 }, ... ] }`
  - Example: `{ "or": [ { "var": "actor.components.effect:poison" }, { "var": "actor.components.effect:disease" } ] }`
    checks if the actor is poisoned OR diseased (by checking component existence).

- **Negation (`!`, `not`)**: Inverts the boolean result of a condition. `!` is shorthand for `not` with a single
  argument.

  - Syntax: `{ "!": { condition } }` or `{ "not": [ { condition } ]}`
  - Example: `{ "!": { "var": "actor.components.status:burdened" } }` checks if the actor does NOT have the 'burdened'
    status component.
  - Example: `{ "!=": [ { "var": "target.components.game:lockable.state" }, "locked" ] }` (Using `!=` is often clearer
    than `not` + `==`).

- **Boolean Coercion (`!!`)**: Converts a value to its boolean equivalent (truthy/falsy becomes `true`/`false`). Useful
  for checking existence.

  - Syntax: `{ "!!": { "var": "optional.property" } }`
  - Example: `{ "!!": { "var": "actor.components.core:health" } }` returns `true` if the actor has a 'core:health'
    component, `false` otherwise.

- **`in`**: Checks if a value is present within an array or a substring within a string.
  - Syntax: `{ "in": [ value_to_find, { "var": "array_or_string_source" } ] }`
  - Example (Array): `{ "in": [ "quest_id", { "var": "actor.components.quest_log.active" } ] }` checks if `"quest_id"`
    is in the `active` array (assuming `active` is an array).
  - Example (String): `{ "in": [ "keyword", { "var": "event.payload.description" } ] }` checks if the string
    `"keyword"` is present within the value of `event.payload.description`. Returns `true` if found, `false`
    otherwise.
  - **Note on Empty String Search (`""`)**: When searching for an empty string within another string, the behavior
    observed with the underlying `json-logic-js` library is nuanced and crucial to understand:
    - `{"in": ["", "some string"]}` evaluates to `true`. (An empty string is considered to be "in" any non-empty
      string).
    - `{"in": ["", ""]}` evaluates to `false`. (An empty string is considered _not_ to be "in" another empty
      string).
      This differs slightly from JavaScript's native `string.includes('')` which returns `true` even for
      `("").includes("")`. Be mindful of this specific edge case when writing rules.

## Evaluation Context

When the engine evaluates a JSON Logic rule (for a System Rule condition, Action prerequisite, or IF operation), it
provides a specific data object, the `JsonLogicEvaluationContext`, to the `jsonLogic.apply` function. The `var` operator
accesses data within this context object.

The `JsonLogicEvaluationContext` has the following top-level properties:

- **`event`** (`object`): Contains information about the event that triggered the rule evaluation.

  - `event.type` (`string`): The namespaced ID of the triggering event (e.g., `"event:action_attempt"`).
  - `event.payload` (`object`): Data specific to the event (e.g.,
    `{ "interactionType": "USE", "itemId": "item:key" }`). If the original event had no payload, this will be an empty
    object `{}`.

- **`actor`** (`object | null`): Represents the entity primarily performing or initiating the action/event (e.g., the
  player character, an NPC). This can be `null` if no actor is contextually relevant for the triggering event.

  - `actor.id` (`string | number`): The unique ID of the actor entity.
  - `actor.components` (`object`): A special accessor object to retrieve the actor's component data. Use bracket
    notation for namespaced IDs (e.g., `actor.components['core:health']`) or dot notation for simple IDs. Accessing a
    component that the entity _does not_ possess (e.g., `actor.components['nonexistent:component']`) will return
    `null`. You can access nested properties directly (e.g., `actor.components.core:health.current`). If the
    component itself is `null`, further nested access will also result in `null` within JSON Logic.

- **`target`** (`object | null`): Represents the entity being acted upon or targeted by the action/event (e.g., an item
  being picked up, an NPC being attacked, a door being opened). This can be `null` if no target is contextually
  relevant.

  - `target.id` (`string | number`): The unique ID of the target entity.
  - `target.components` (`object`): A special accessor object for the target's components, working identically to
    `actor.components`. Accessing a non-existent component returns `null`. Example:
    `target.components.game:lockable.state`.

- **`context`** (`object`): A temporary storage object holding results from previous `QUERY_COMPONENT` operations
  executed _within the same SystemRule's action sequence_. This allows later actions or `IF` conditions in the sequence
  to use data fetched earlier.

  - Access variables using the `result_variable` name defined in the `QUERY_COMPONENT` operation (e.g.,
    `context.targetHealthComponent`).
  - Accessing a variable that hasn't been set in the current sequence resolves to `undefined`, which JSON Logic
    typically treats as `null`.

- **`globals`** (`object`, Optional/Future): A placeholder for potential future access to global game state variables (
  e.g., game time, world flags). Currently initialized as an empty object `{}`.

- **`entities`** (`object`, Optional/Future): A placeholder for potential future direct access to any entity's data by
  its ID, regardless of the contextual `actor` or `target`. Currently initialized as an empty object `{}`.

Understanding this context object is crucial for writing effective JSON Logic rules, as it defines exactly what data
your conditions can access using the `var` operator.

## Data Access Patterns

All data within the `JsonLogicEvaluationContext` is accessed using the JSON Logic `var` operator. The operator takes a
single string argument representing the path to the desired data, using dot notation for nested properties.

        { "var": "path.to.data.within.context" }

If the specified path does not exist or resolves to `undefined` at any point, the `var` operator typically returns
`null`.

### Accessing Event Data

The triggering event's details are available under the top-level `event` key.

- `event.type`: Accesses the namespaced string ID of the event.

        { "var": "event.type" }
        // Example: Returns "event:action_attempt"

- `event.payload`: Accesses the payload object of the event. You can access specific fields within the payload using
  further dot notation. If the event has no payload, `event.payload` will be an empty object `{}`. Accessing a field on
  an empty payload or a non-existent field will result in `null`.

        { "var": "event.payload.itemId" }
        // Example: Returns "item:key_01" if the payload was { "itemId": "item:key_01", ... }

        { "var": "event.payload.damageAmount" }
        // Example: Returns 25 if the payload was { "damageType": "fire", "damageAmount": 25 }

### Accessing Entity IDs

The unique identifiers for the contextual actor and target entities are available if they are relevant to the event.

- `actor.id`: Accesses the ID of the actor entity. Returns `null` if `actor` itself is `null`.

        { "var": "actor.id" }
        // Example: Returns "core:player"

- `target.id`: Accesses the ID of the target entity. Returns `null` if `target` itself is `null`.

        { "var": "target.id" }
        // Example: Returns "npc:goblin_sentry"

### Accessing Component Data

Accessing component data for the actor or target entity is done via the `components` property on the respective `actor`
or `target` object.

- **Dynamic Lookup (`createComponentAccessor`)**: It's crucial to understand that `actor.components` and
  `target.components` are not static objects containing all possible components. Instead, they are dynamic accessor
  proxies (created by `createComponentAccessor`). When you attempt to access a property like
  `actor.components['core:health']` or `actor.components.someSimpleId`, the accessor intercepts this request and uses
  the `EntityManager`'s `getComponentData` method
  to look up the `core:health` or `someSimpleId` component specifically for the `actor.id`.
  _(Note: While the accessor proxy has multiple traps like 'get' and 'has', standard data retrieval via the
  JsonLogic `var` operator primarily interacts with the 'get' trap, which uses `getComponentData`)._

- **Return Value (Component Access)**:

  - If the entity _has_ the specified component, accessing `actor.components.componentId` (or using brackets for
    namespaced IDs like `actor.components['namespace:id']`) returns the
    entire raw data object for that component instance when used with operators like `!!`.
  - If the entity _does not have_ the specified component, accessing it returns `null`.

    // Check existence/truthiness of the actor's 'core:health' component
    { "!!": { "var": "actor.components.core:health" } }
    // Example Return (if component exists): true
    // Example Return (if component doesn't exist): false

    // Check existence/truthiness of the target's namespaced 'game:lockable' component
    { "!!": { "var": "target.components.game:lockable" } } // Note: Dot notation used in var path
    // Example Return (if component exists): true
    // Example Return (if component doesn't exist): false

- **Nested Access (Component Properties)**: You can directly access properties within a component's data object using
  further dot notation **within the `var` path string**.

  - Syntax: `{ "var": "actor.components.componentId.propertyName" }`
  - Syntax (Namespaced Component): `{ "var": "actor.components.namespace:componentId.propertyName" }`
  - **Important:** Use dot notation to separate the component ID and its properties within the `var` path string, even
    if the component ID itself contains special characters (like `:`) that might require bracket notation in
    JavaScript. The `json-logic-js` `var` operator parses the dot-separated path.
  - Behavior: If the component itself exists and has the specified property, the value of that property is returned.
    If the component doesn't exist (the component access part resolves to `null`), accessing a property on it will
    also result in `null`. If
    the component exists but the specific property doesn't exist within its data, the result is `undefined`, which
    JSON Logic also typically treats as `null`.

    // Get the 'current' value from the actor's 'core:health' component
    { "var": "actor.components.core:health.current" }
    // Example Return: 85 (if component and property exist)
    // Example Return: null (if 'core:health' component is missing, or 'current' is missing)

    // Get the 'state' value from the target's namespaced 'game:lockable' component
    { "var": "target.components.game:lockable.state" } // Dot notation used for the path
    // Example Return: "locked" (if component and property exist)
    // Example Return: null (if 'game:lockable' component is missing, or 'state' is missing)

    // Get the 'prop' value from the actor's namespaced 'ns:compC' component
    { "var": "actor.components.ns:compC.prop" } // Dot notation used for the path
    // Example Return: "someValue" (if component and property exist)
    // Example Return: null (if 'ns:compC' component is missing, or 'prop' is missing)

### Accessing Context Variables

The `context` object holds temporary data generated during the execution of a System Rule's action sequence. This is
primarily populated by `QUERY_COMPONENT` operations.

- Source: Variables stored here correspond directly to the `result_variable` name specified in a preceding
  `QUERY_COMPONENT` operation within the same rule's action sequence.
- Syntax: `context.variableName` (where `variableName` matches the `result_variable` string).
- Return Value: Returns the data stored under that variable name (typically, the component data object fetched by the
  query, or `null` if the query found nothing). Accessing a `variableName` that was not set in the current execution
  sequence results in `undefined`, which JSON Logic treats as `null`.

        // Assuming a prior QUERY_COMPONENT operation had: "result_variable": "queriedNpcData"
        // Access the data stored in that variable.
        { "var": "context.queriedNpcData" }
        // Example Return (if query succeeded): { "current": 50, "max": 50 } (if it queried health)
        // Example Return (if query failed or variable not set): null

        // Access a nested property within the queried data
        { "var": "context.queriedNpcData.current" }
        // Example Return: 50
        // Example Return: null (if queriedNpcData is null or has no 'current' property)

### Handling Null/Missing Data

JSON Logic is generally resilient to missing data when using the `var` operator. Attempting to access properties on data
that resolves to `null` or `undefined` typically results in `null` rather than throwing an error.

- Accessing `actor.id` when `actor` is `null` yields `null`.
- Accessing `actor.components.some:Component` when the actor lacks that component yields `null`.
- Accessing `actor.components.some:Component.property` when the component is missing (`null`) yields `null`.
- Accessing `actor.components.core:health.nonExistentProperty` when the `core:health` component exists but lacks
  `nonExistentProperty` yields `undefined` (treated as `null` by most JSON Logic operations).
- Accessing `context.someVariableThatWasNeverSet` yields `undefined` (treated as `null`).

This behavior allows conditions to be written safely without excessive explicit `null` checks, as comparisons or logical
operations involving `null` often evaluate to `false` or are handled predictably by specific operators (like `!!`).

## Examples

This section provides concrete examples based on the common patterns identified earlier.

_(Note: Component access examples updated to use dot notation within the `var` path)_

### Category: Component Existence & State

Checks if the actor entity possesses the 'core:health' component. Uses '!!' to ensure a boolean result.

    {
      "!!": {
        "var": "actor.components.core:health"
      }
    }

Checks if the target entity possesses the 'game:is_container' component.

    {
      "!!": {
        "var": "target.components.game:is_container"
      }
    }

Compares a numeric value - checks if target's current health is less than or equal to 0.

    {
      "<=": [
        {
          "var": "target.components.core:health.current"
        },
        0
      ]
    }

Compares a numeric value - checks if actor has more than 5 gold (assuming `game:inventory.currency.gold` path).

    {
      ">": [
        {
          "var": "actor.components.game:inventory.currency.gold"
        },
        5
      ]
    }

Compares a numeric value - checks if context variable 'rollResult' is greater than or equal to 10.

    {
      ">=": [
        {
          "var": "context.rollResult"
        },
        10
      ]
    }

Compares a string value - checks if the target's 'game:lockable' component state is 'locked'.

    {
      "==": [
        {
          "var": "target.components.game:lockable.state"
        },
        "locked"
      ]
    }

Compares a string value - checks if the actor's class ID is 'core:class_mage' (assuming `core:class.id` path).

    {
      "==": [
        {
          "var": "actor.components.core:class.id"
        },
        "core:class_mage"
      ]
    }

Checks a boolean value - checks if the target 'game:openable' component's `isOpen` property is `true`.

    {
      "==": [
        {
          "var": "target.components.game:openable.isOpen"
        },
        true
      ]
    }

Checks a boolean value (shorthand) - checks truthiness of target 'game:openable' component's `isOpen` property.

    {
      "var": "target.components.game:openable.isOpen"
    }

Checks a boolean value (shorthand) - checks if the actor is hidden (assuming `game:status_hidden.isActive`).

    {
      "var": "actor.components.game:status_hidden.isActive"
    }

Checks for item presence - simplified check if actor has the 'game:quest_item_key' component.

    {
      "!!": {
        "var": "actor.components.game:quest_item_key"
      }
    }

Checks for item presence - checks within inventory component structure (assuming map `items.item:special_orb`).

    {
      "!!": {
        "var": "actor.components.game:inventory.items.item:special_orb"
      }
    }

### Category: Event Data Checks

Checks if the triggering event's type is exactly 'event:entity_dies'.

    {
      "==": [
        {
          "var": "event.type"
        },
        "event:entity_dies"
      ]
    }

Checks a value in the event payload - was the `interactionType` 'USE'?

    {
      "==": [
        {
          "var": "event.payload.interactionType"
        },
        "USE"
      ]
    }

Checks a value in the event payload - was the `damageAmount` greater than 10?

    {
      ">": [
        {
          "var": "event.payload.damageAmount"
        },
        10
      ]
    }

Checks a value in the event payload - did the move event specify 'north'?

    {
      "==": [
        {
          "var": "event.payload.direction"
        },
        "north"
      ]
    }

### Category: Context Variable Checks

Checks if a context variable 'findTargetHealth' exists (is not `null`).

    {
      "!=": [
        {
          "var": "context.findTargetHealth"
        },
        null
      ]
    }

Checks if a context variable 'findTargetHealth' exists (is truthy).

    {
      "!!": {
        "var": "context.findTargetHealth"
      }
    }

Checks a value within a context variable - is the queried health component's `current` value <= 0?

    {
      "<=": [
        {
          "var": "context.targetHealthComponent.current"
        },
        0
      ]
    }

Checks a value within a context variable - does queried inventory show >= 1 keys (assuming `items.key_count`)?

    {
      ">=": [
        {
          "var": "context.actorInventory.items.key_count"
        },
        1
      ]
    }

### Category: Entity Identity & Context State

Checks the ID of the target entity.

    {
      "==": [
        {
          "var": "target.id"
        },
        "npc:shopkeeper"
      ]
    }

Checks the ID of the actor entity.

    {
      "==": [
        {
          "var": "actor.id"
        },
        "core:player"
      ]
    }

Checks if the 'target' object itself exists in the evaluation context (is not `null`).

    {
      "!=": [
        {
          "var": "target"
        },
        null
      ]
    }

Checks if the 'actor' object itself exists in the evaluation context (is not `null`).

    {
      "!=": [
        {
          "var": "actor"
        },
        null
      ]
    }

### Category: Compound Logic

Combines conditions with `AND` - checks if target has 'game:lockable' and its state is 'locked'.

    {
      "and": [
        {
          "!!": { // Check component exists first (truthiness)
            "var": "target.components.game:lockable"
          }
        },
        {
          "==": [ // Then check the property
            {
              "var": "target.components.game:lockable.state"
            },
            "locked"
          ]
        }
      ]
    }

Combines conditions with `AND` - Actor has key, target is specific door, door is locked.

    {
      "and": [
        {
          "!!": {
            "var": "actor.components.game:quest_item_key"
          }
        },
        {
          "==": [
            {
              "var": "target.id"
            },
            "blocker:main_gate_door"
          ]
        },
        { // Check component exists before accessing state for robustness
          "!!": { "var": "target.components.game:lockable" }
        },
        {
          "==": [
            {
              "var": "target.components.game:lockable.state"
            },
            "locked"
          ]
        }
      ]
    }

Combines conditions with AND - demonstrating interaction with JavaScript truthiness for [].

```json
{
  "and": [true, []]
}
```

#### Evaluation:

The and operator evaluates operands from left to right (true, then []).
Since [] is truthy in standard JavaScript, and no falsy value was found, the and operator (mimicking JS behavior for
determining return value) returns the last evaluated operand: [].
(This behavior is nuanced: while [] is truthy here for and's return logic, dedicated boolean operations in json-logic-js
like !![] or using [] in an if condition treat it as falsy).
Service Coercion: The JsonLogicEvaluationService receives the raw result [] from jsonLogic.apply and applies boolean
coercion using !!.
Since [] is truthy in JavaScript, !![] evaluates to true.
Service Output: true

Combines conditions with `OR` - checks if actor has 'effect:poison' OR 'effect:disease' component.

    {
      "or": [
        {
          "!!": {
            "var": "actor.components.effect:poison"
          }
        },
        {
          "!!": {
            "var": "actor.components.effect:disease"
          }
        }
      ]
    }

Inverts a condition - checks if target is NOT locked (using 'not'). Note: '!=' is often preferred.

    {
      "not": [
        {
          "==": [
            {
              "var": "target.components.game:lockable.state"
            },
            "locked"
          ]
        }
      ]
    }

Inverts a condition - checks if target is NOT locked (using '!=').

    {
      "!=": [
        {
          "var": "target.components.game:lockable.state"
        },
        "locked"
      ]
    }

Inverts a condition - checks if actor does NOT have the 'status:burdened' component (using '!').

    {
      "!": { // Note: Same as { "!!": { ... } } == false
        "var": "actor.components.status:burdened"
      }
    }

### Category: Quest/Objective State (Conceptual - Phasing Out)

Checks if 'main:quest_1' is in the actor's active quests list (using 'in').

    {
      "in": [
        "main:quest_1",
        {
          "var": "actor.components.core:quest_log.active_quests" // Assumes active_quests is an array
        }
      ]
    }

Checks if 'main:quest_2' is NOT in the actor's completed quests list (using '!' and 'in').

    {
      "!": {
        "in": [
          "main:quest_2",
          {
            "var": "actor.components.core:quest_log.completed_quests" // Assumes completed_quests is an array
          }
        ]
      }
    }

## Full Operator Reference

The examples above cover the most common use cases within this engine. JSON Logic supports a wider array of operators
for logic, arithmetic, string manipulation, and array operations.

For a complete list of all standard operators and their detailed behavior, please refer to the Official JSON Logic
Website: [http://jsonlogic.com/operations.html](http://jsonlogic.com/operations.html)
